import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { reportError } from '../../utils/errorReporting';

/** Calls onReady after the first frame has rendered, so a loader can fade out. */
export function SceneReady({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // Wait one more tick so the frame is actually on screen.
    requestAnimationFrame(onReady);
  });
  return null;
}

const NUDGE_DURATION = 0.4;
const NUDGE_AMPLITUDE = 0.06;

/**
 * A short, small camera shake when a king is put in check. Each frame removes
 * the previous offset before applying the next, so the user's orbit is left
 * exactly where it was. Skipped with prefers-reduced-motion.
 */
export function CheckNudge({ trigger }: { trigger: number }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = usePrefersReducedMotion();
  const startedAt = useRef<number | null>(null);
  const applied = useRef(new THREE.Vector3());
  const right = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (trigger > 0 && !reducedMotion) {
      startedAt.current = performance.now() / 1000;
      invalidate();
    }
  }, [trigger, reducedMotion, invalidate]);

  useFrame((state) => {
    camera.position.sub(applied.current);
    applied.current.set(0, 0, 0);
    if (startedAt.current === null) return;
    const t = performance.now() / 1000 - startedAt.current;
    if (t > NUDGE_DURATION) {
      startedAt.current = null;
      return;
    }
    const decay = 1 - t / NUDGE_DURATION;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    applied.current.copy(right).multiplyScalar(Math.sin(t * 45) * NUDGE_AMPLITUDE * decay);
    camera.position.add(applied.current);
    state.invalidate();
  });
  return null;
}

const CONFETTI_COUNT = 160;
const CONFETTI_COLORS = ['#F59E0B', '#3FB6A8', '#E5534B', '#4FA3E0', '#F2E35B', '#FFFFFF'];
const CONFETTI_SECONDS = 4.5;

/** A burst of confetti over the board when the player wins. */
export function Confetti({ trigger }: { trigger: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = usePrefersReducedMotion();
  const startedAt = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, () => ({
        x: (Math.random() - 0.5) * 9,
        z: (Math.random() - 0.5) * 9,
        y: 6 + Math.random() * 4,
        speed: 1.2 + Math.random() * 1.6,
        spin: (Math.random() - 0.5) * 8,
        sway: Math.random() * Math.PI * 2,
      })),
    // Re-randomise for each celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      mesh.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (trigger > 0 && !reducedMotion) {
      startedAt.current = performance.now() / 1000;
      invalidate();
    }
  }, [trigger, reducedMotion, invalidate]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const start = startedAt.current;
    const t = start === null ? Infinity : performance.now() / 1000 - start;
    mesh.visible = t < CONFETTI_SECONDS;
    if (!mesh.visible) return;
    state.invalidate();
    particles.forEach((p, i) => {
      dummy.position.set(p.x + Math.sin(t * 2 + p.sway) * 0.3, p.y - t * p.speed, p.z);
      dummy.rotation.set(t * p.spin, t * p.spin * 0.7, 0);
      dummy.scale.setScalar(dummy.position.y < 0 ? 0 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CONFETTI_COUNT]} visible={false}>
      <planeGeometry args={[0.12, 0.2]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** Dev-only: exposes the renderer and scene so tests and tooling can read render stats. */
export function DevSceneHandle() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __three?: unknown }).__three = { gl, scene, invalidate };
  }, [gl, scene, invalidate]);
  return null;
}

/**
 * Watches for the browser dropping the WebGL context (GPU reset, driver
 * update, too many tabs). three.js restores the scene by itself when the
 * context comes back; this just tells the UI so it can explain the pause.
 */
export function ContextLossWatcher({ onChange }: { onChange: (lost: boolean) => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = () => {
      reportError(new Error('WebGL context lost'), 'webgl');
      onChange(true);
    };
    const restored = () => {
      onChange(false);
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, invalidate, onChange]);
  return null;
}
