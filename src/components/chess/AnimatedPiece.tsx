import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring } from '@react-spring/three';
import * as THREE from 'three';
import type { Color, PieceSymbol } from 'chess.js';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { createGlowTexture } from './boardThemes';

export interface PieceProps {
  type: PieceSymbol;
  color: Color;
  position: [number, number, number];
  isSelected: boolean;
  /** Live board-space [x, z] while the player drags this piece; null otherwise. */
  dragPosition?: DragPosition | null;
  /** A checkmated king falls over. */
  toppled?: boolean;
}

/** Mutable so the dragged piece follows the pointer without re-rendering React every move. */
export type DragPosition = { current: [number, number] };

interface AnimatedPieceProps extends PieceProps {
  /** Selected-piece hover: height, bob amplitude, bob speed. */
  hover: { lift: number; amp: number; speed: number };
  /** Colour of the glow under a selected piece. */
  glowColor: string;
  children: ReactNode;
}

const DRAG_LIFT = 0.35;
/** Knights hop over other pieces instead of sliding through them. */
const KNIGHT_ARC = 0.7;
const TOPPLE_ANGLE = Math.PI / 2 - 0.12;

const glowCache = new Map<string, THREE.Texture>();
const glowTexture = (color: string) => {
  let t = glowCache.get(color);
  if (!t) {
    t = createGlowTexture(color);
    glowCache.set(color, t);
  }
  return t;
};

/**
 * Shared motion for every piece set: springs between squares (knights in an
 * arc), follows the pointer while dragged, bobs and glows when selected, and
 * topples when checkmated. With prefers-reduced-motion, moves are instant
 * and nothing bobs or falls.
 *
 * The selection glow is a textured disc rather than a point light: adding a
 * light changes every material's shader and caused a visible hitch.
 */
export function AnimatedPiece({
  type,
  position,
  isSelected,
  dragPosition,
  toppled,
  hover,
  glowColor,
  children,
}: AnimatedPieceProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const tiltRef = useRef<THREE.Group>(null!);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null!);
  const reducedMotion = usePrefersReducedMotion();
  const glow = useMemo(() => glowTexture(glowColor), [glowColor]);

  const [{ pos }, api] = useSpring(() => ({
    pos: position,
    config: { mass: 1, tension: 280, friction: 60 },
  }));

  // Where the current move started, for the knight's arc.
  const moveFrom = useRef<[number, number]>([position[0], position[2]]);
  const [x, y, z] = position;
  const isDragging = Boolean(dragPosition);
  useEffect(() => {
    if (isDragging) return;
    const p = pos.get();
    moveFrom.current = [p[0], p[2]];
    api.start({ pos: [x, y, z], immediate: reducedMotion });
  }, [api, pos, x, y, z, reducedMotion, isDragging]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    // The canvas renders on demand: ask for another frame while anything here is moving.
    const keepAlive = () => state.invalidate();

    // Topple (or stand back up after an undo).
    const targetTilt = toppled ? TOPPLE_ANGLE : 0;
    const tilt = tiltRef.current;
    tilt.rotation.z = reducedMotion
      ? targetTilt
      : THREE.MathUtils.damp(tilt.rotation.z, targetTilt, 6, delta);
    if (Math.abs(tilt.rotation.z - targetTilt) > 0.001) keepAlive();

    if (glowRef.current) {
      glowRef.current.opacity = reducedMotion ? 0.7 : 0.55 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }

    if (dragPosition) {
      // Keep the spring at the pointer so the piece glides from the drop point.
      const [dx, dz] = dragPosition.current;
      pos.set([dx, 0, dz]);
      moveFrom.current = [dx, dz];
      g.position.set(dx, DRAG_LIFT, dz);
      keepAlive();
      return;
    }

    const p = pos.get();
    g.position.x = p[0];
    g.position.z = p[2];

    let lift = 0;
    if (type === 'n' && !reducedMotion) {
      const total = Math.hypot(x - moveFrom.current[0], z - moveFrom.current[1]);
      if (total > 0.01) {
        const remaining = Math.hypot(x - p[0], z - p[2]);
        const progress = THREE.MathUtils.clamp(1 - remaining / total, 0, 1);
        lift = Math.sin(progress * Math.PI) * KNIGHT_ARC;
      }
    }
    const bob = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * hover.speed) * hover.amp;
    g.position.y = p[1] + lift + (isSelected ? hover.lift + bob : 0);
    // Selected pieces bob and glow, so they keep animating (unless motion is reduced).
    if (pos.isAnimating || (isSelected && !reducedMotion)) keepAlive();
  });

  return (
    <group ref={groupRef} position={position}>
      <group ref={tiltRef}>
        {/* Piece models face +z for White (toward Black). On the board, rank 8
            lies toward -z, so turn the model round to keep that true. */}
        <group rotation={[0, Math.PI, 0]}>{children}</group>
      </group>
      {isSelected && !dragPosition && (
        <mesh position={[0, 0.012 - hover.lift, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshBasicMaterial
            ref={glowRef}
            map={glow}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}
