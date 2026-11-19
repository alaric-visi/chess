import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Chess, Square, Color, Move } from 'chess.js';
import { ChessPiece3D } from './ChessPiece3D';
import { loadFantasy, loadForest, loadSciFi, loadUnderwater } from './pieceSetLoaders';
import type { DragPosition, PieceProps } from './AnimatedPiece';
import { BoardTheme, createBoardTexture, createFrameTexture, createGlowTexture } from './boardThemes';
import { PieceSet } from '../../types/chess/chess';
import { piecesFromFen, syncPieces, TrackedPiece } from '../../game/pieceTracking';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export interface BoardArrow {
  from: Square;
  to: Square;
  color: string;
}

interface ChessBoard3DProps {
  fen: string;
  selectedSquare: Square | null;
  validMoves: Square[];
  lastMove: Move | null;
  playerColor: Color;
  pieceSet: PieceSet;
  theme: BoardTheme;
  /** Arrows on the board: hints and the analysis's best move. */
  arrows: BoardArrow[];
  /** Keyboard focus square, drawn as an outline. */
  cursor: Square | null;
  /** Whether the player may pick up the piece on this square now. */
  canSelect: (square: Square) => boolean;
  onSquareClick: (square: Square) => void;
  onSelect: (square: Square) => void;
  /** Drag-and-drop; returns false if the move isn't legal. */
  onDrop: (from: Square, to: Square) => boolean;
}

const SQUARE_SIZE = 1;
const BOARD_SIZE = 8;
const BOARD_OFFSET = ((BOARD_SIZE - 1) * SQUARE_SIZE) / 2;
const FRAME_SIZE = BOARD_SIZE + 0.9;
/** Screen pixels the pointer may wander and still count as a click. */
const CLICK_SLOP_PX = 6;

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

const CURSOR_COLOR = '#3B82F6';
const CHECK_GLOW = createGlowTexture('rgba(229, 57, 53, 0.95)');

const PIECE_COMPONENTS = {
  classic: ChessPiece3D,
  scifi: lazy(loadSciFi),
  fantasy: lazy(loadFantasy),
  forest: lazy(loadForest),
  underwater: lazy(loadUnderwater),
} as const;

/**
 * Square centre in board-local coordinates: files run along +x (a on the
 * left) and rank 1 sits at +z, so with no rotation White's side faces a
 * camera on the +z axis with a1 bottom-left, as on a real board.
 */
const squareToPosition = (square: Square): { x: number; z: number } => {
  const col = square.charCodeAt(0) - 97;
  const row = parseInt(square[1]) - 1;
  return { x: col * SQUARE_SIZE - BOARD_OFFSET, z: BOARD_OFFSET - row * SQUARE_SIZE };
};

/** Board-local point to square, or null when off the board. */
const positionToSquare = (x: number, z: number): Square | null => {
  const col = Math.round(x / SQUARE_SIZE + BOARD_OFFSET);
  const row = Math.round(BOARD_OFFSET - z / SQUARE_SIZE);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return `${files[col]}${ranks[row]}` as Square;
};

const BOARD_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

interface DragState {
  from: Square;
  /** Was this piece already selected before the press? Decides what a plain click does. */
  wasSelected: boolean;
  draggable: boolean;
  moved: boolean;
  startX: number;
  startY: number;
}

/** A captured piece shrinking into the board, then removed. */
interface Ghost extends TrackedPiece {
  bornAt: number;
}

/** Flat arrow lying on the board from one square to another. */
function Arrow({ from, to, color }: BoardArrow) {
  const a = squareToPosition(from);
  const b = squareToPosition(to);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const headLength = 0.35;
  const shaft = Math.max(0.1, length - headLength);
  return (
    <group position={[a.x, 0.08, a.z]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0, shaft / 2]}>
        <boxGeometry args={[0.14, 0.02, shaft]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0, shaft + headLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.24, headLength, 3]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Tinted square overlay (last move, selection). */
function SquareTint({
  square,
  color,
  opacity,
  y = 0.004,
}: {
  square: Square;
  color: string;
  opacity: number;
  y?: number;
}) {
  const { x, z } = squareToPosition(square);
  return (
    <mesh position={[x, y, z]} rotation={FLAT} renderOrder={1}>
      <planeGeometry args={[SQUARE_SIZE, SQUARE_SIZE]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

const GHOST_DELAY = 0.12; // let the capturing piece arrive first
const GHOST_DURATION = 0.35;

/** Captured piece sinking and shrinking away. */
function CapturedGhost({
  ghost,
  pieceSet,
  onDone,
}: {
  ghost: Ghost;
  pieceSet: PieceSet;
  onDone: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null!);
  const { x, z } = squareToPosition(ghost.square);
  const PieceComponent = PIECE_COMPONENTS[pieceSet];
  const done = useRef(false);

  useFrame((state) => {
    const t = (performance.now() / 1000 - ghost.bornAt - GHOST_DELAY) / GHOST_DURATION;
    if (t < 1) state.invalidate();
    const k = THREE.MathUtils.clamp(t, 0, 1);
    const eased = k * k;
    ref.current.scale.setScalar(1 - eased * 0.9);
    ref.current.position.y = -eased * 0.4;
    if (k >= 1 && !done.current) {
      done.current = true;
      onDone(ghost.id);
    }
  });

  return (
    <group ref={ref} position={[x, 0, z]}>
      <PieceComponent type={ghost.type} color={ghost.color} position={[0, 0, 0]} isSelected={false} />
    </group>
  );
}

export function ChessBoard3D({
  fen,
  selectedSquare,
  validMoves,
  lastMove,
  playerColor,
  pieceSet,
  theme,
  arrows,
  cursor,
  canSelect,
  onSquareClick,
  onSelect,
  onDrop,
}: ChessBoard3DProps) {
  const reducedMotion = usePrefersReducedMotion();

  // Tracked pieces keep their identity across moves so they slide rather
  // than pop. Updated during render when the FEN changes (React's
  // "adjust state when a prop changes" pattern). Pieces removed by a move
  // become ghosts that animate away.
  const [tracked, setTracked] = useState(() => ({
    fen,
    pieces: piecesFromFen(fen),
    ghosts: [] as Ghost[],
  }));
  if (tracked.fen !== fen) {
    const pieces = syncPieces(tracked.pieces, tracked.fen, fen, lastMove);
    const animated = !reducedMotion && lastMove?.before === tracked.fen;
    const ids = new Set(pieces.map((p) => p.id));
    const bornAt = performance.now() / 1000;
    const newGhosts = animated
      ? tracked.pieces.filter((p) => !ids.has(p.id)).map((p) => ({ ...p, bornAt }))
      : [];
    setTracked({ fen, pieces, ghosts: [...tracked.ghosts, ...newGhosts] });
  }
  const removeGhost = (id: string) =>
    setTracked((t) => ({ ...t, ghosts: t.ghosts.filter((g) => g.id !== id) }));

  const { checkSquare, matedSquare } = useMemo(() => {
    const chess = new Chess(fen);
    const king = chess.inCheck()
      ? chess
          .board()
          .flat()
          .find((p) => p?.type === 'k' && p.color === chess.turn())?.square
      : undefined;
    return { checkSquare: king ?? null, matedSquare: chess.isCheckmate() ? (king ?? null) : null };
  }, [fen]);
  const occupied = useMemo(() => new Set(tracked.pieces.map((p) => p.square)), [tracked.pieces]);

  // Textures are regenerated only when the theme (or orientation, for coordinates) changes.
  const boardTexture = useMemo(() => createBoardTexture(theme), [theme]);
  const frameTexture = useMemo(
    () => createFrameTexture(theme, playerColor, FRAME_SIZE),
    [theme, playerColor],
  );
  useEffect(() => () => boardTexture.dispose(), [boardTexture]);
  useEffect(() => () => frameTexture.dispose(), [frameTexture]);

  const groupRef = useRef<THREE.Group>(null!);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const press = useRef<DragState | null>(null);
  const dragPos = useRef<[number, number]>([0, 0]) as DragPosition;
  const [draggingSquare, setDraggingSquare] = useState<Square | null>(null);

  /** Where the pointer ray meets the board, in board-local coordinates. */
  const localPoint = (e: ThreeEvent<PointerEvent>): THREE.Vector3 | null => {
    const hit = e.ray.intersectPlane(BOARD_PLANE, new THREE.Vector3());
    return hit ? groupRef.current.worldToLocal(hit) : null;
  };

  const endPress = () => {
    press.current = null;
    setDraggingSquare(null);
    if (controls) controls.enabled = true;
    gl.domElement.style.cursor = '';
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const p = localPoint(e);
    const square = p && positionToSquare(p.x, p.z);
    if (!square) return;
    e.stopPropagation();
    const draggable = canSelect(square);
    press.current = {
      from: square,
      wasSelected: selectedSquare === square,
      draggable,
      moved: false,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
    };
    if (draggable) {
      // Stop the camera orbiting while a piece is held, and keep receiving
      // pointer events even if the pointer leaves the board.
      if (controls) controls.enabled = false;
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
      if (selectedSquare !== square) onSelect(square);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const pr = press.current;
    if (!pr) {
      const p = localPoint(e);
      const sq = p && positionToSquare(p.x, p.z);
      gl.domElement.style.cursor = sq && (canSelect(sq) || validMoves.includes(sq)) ? 'pointer' : '';
      return;
    }
    if (!pr.draggable) return;
    const distance = Math.hypot(e.nativeEvent.clientX - pr.startX, e.nativeEvent.clientY - pr.startY);
    if (!pr.moved && distance > CLICK_SLOP_PX) {
      pr.moved = true;
      setDraggingSquare(pr.from);
      gl.domElement.style.cursor = 'grabbing';
    }
    if (pr.moved) {
      const p = localPoint(e);
      if (p) dragPos.current = [p.x, p.z];
      invalidate();
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    const pr = press.current;
    if (!pr) return;
    e.stopPropagation();
    if (pr.draggable) (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    const p = localPoint(e);
    const square = p && positionToSquare(p.x, p.z);

    if (pr.moved) {
      if (square && square !== pr.from) onDrop(pr.from, square);
    } else {
      const distance = Math.hypot(e.nativeEvent.clientX - pr.startX, e.nativeEvent.clientY - pr.startY);
      const isClick = distance <= CLICK_SLOP_PX && square === pr.from;
      // A press on an unselected own piece already selected it; a click on
      // the selected piece (or any other square) goes through normal click handling.
      if (isClick && (!pr.draggable || pr.wasSelected)) onSquareClick(square);
    }
    endPress();
  };

  // Turn the board 180° for Black so the player's pieces are always nearest the camera.
  const boardRotation = playerColor === 'w' ? 0 : Math.PI;
  const PieceComponent = PIECE_COMPONENTS[pieceSet];

  return (
    <group>
      {/* Frame and coordinates stay fixed to the viewer; the labels are drawn per side. */}
      <mesh position={[0, -0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[FRAME_SIZE, 0.24, FRAME_SIZE]} />
        <meshStandardMaterial color={theme.frame} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.0005, 0]} rotation={FLAT} receiveShadow>
        <planeGeometry args={[FRAME_SIZE, FRAME_SIZE]} />
        <meshStandardMaterial map={frameTexture} roughness={0.6} />
      </mesh>

      <group
        ref={groupRef}
        rotation={[0, boardRotation, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endPress}
      >
        {/* Playing surface: one textured plane for all 64 squares */}
        <mesh position={[0, 0.002, 0]} rotation={FLAT} receiveShadow>
          <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
          <meshPhysicalMaterial
            map={boardTexture}
            roughness={theme.roughness}
            metalness={theme.metalness}
            clearcoat={theme.clearcoat}
            clearcoatRoughness={0.3}
          />
        </mesh>

        {lastMove && (
          <>
            <SquareTint square={lastMove.from} color={theme.lastMove} opacity={0.4} />
            <SquareTint square={lastMove.to} color={theme.lastMove} opacity={0.5} />
          </>
        )}
        {selectedSquare && (
          <SquareTint square={selectedSquare} color={theme.selected} opacity={0.55} y={0.005} />
        )}
        {checkSquare && (
          <mesh
            position={[squareToPosition(checkSquare).x, 0.006, squareToPosition(checkSquare).z]}
            rotation={FLAT}
          >
            <planeGeometry args={[1.25, 1.25]} />
            <meshBasicMaterial map={CHECK_GLOW} transparent depthWrite={false} />
          </mesh>
        )}

        {validMoves.map((square) => {
          const { x, z } = squareToPosition(square);
          const capture = occupied.has(square);
          return (
            <mesh key={square} position={[x, 0.008, z]} rotation={FLAT} renderOrder={2}>
              {capture ? <ringGeometry args={[0.38, 0.48, 48]} /> : <circleGeometry args={[0.17, 32]} />}
              <meshBasicMaterial
                color={theme.marker}
                transparent
                opacity={theme.markerOpacity}
                depthWrite={false}
              />
            </mesh>
          );
        })}

        {cursor && (
          <mesh
            position={[squareToPosition(cursor).x, 0.01, squareToPosition(cursor).z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
          >
            <ringGeometry args={[0.6, 0.68, 4, 1]} />
            <meshBasicMaterial color={CURSOR_COLOR} depthWrite={false} />
          </mesh>
        )}

        {arrows.map((a) => (
          <Arrow key={`${a.from}${a.to}${a.color}`} {...a} />
        ))}

        <Suspense fallback={null}>
          {tracked.ghosts.map((g) => (
            <CapturedGhost key={g.id} ghost={g} pieceSet={pieceSet} onDone={removeGhost} />
          ))}

          {tracked.pieces.map((piece) => {
            const { x, z } = squareToPosition(piece.square);
            const props: PieceProps = {
              type: piece.type,
              color: piece.color,
              position: [x, 0, z],
              isSelected: selectedSquare === piece.square,
              dragPosition: draggingSquare === piece.square ? dragPos : null,
              toppled: matedSquare === piece.square,
            };
            return <PieceComponent key={piece.id} {...props} />;
          })}
        </Suspense>
      </group>
    </group>
  );
}
