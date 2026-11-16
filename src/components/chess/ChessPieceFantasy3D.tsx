import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { PieceSymbol, Color } from 'chess.js';

/**
 * Fantasy chess set.
 *
 *   King   — crowned tower with a floating gem
 *   Queen  — slender spire holding a crescent moon and a glowing orb
 *   Rook   — stone keep with battlements, a turret and a banner
 *   Bishop — wizard: robe, wide-brimmed pointed hat with a star band
 *   Knight — dragon head on an arched neck, horns and folded wings
 *   Pawn   — foot soldier's helm with a plume
 *
 * White is marble with gold fittings and ice-blue gems; black is obsidian with
 * silver fittings and ember gems. Same props as ChessPiece3D, so it's a
 * drop-in swap in ChessBoard3D.
 */

interface ChessPiece3DProps {
  type: PieceSymbol;
  color: Color;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}

const SCALE = 0.85;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
type ProfilePoint = [number, number] | [number, number, 'sharp'];

const smoothProfile = (pts: ProfilePoint[], samplesPerSegment = 6): THREE.Vector2[] => {
  const runs: THREE.Vector2[][] = [[]];
  for (const [x, y, flag] of pts) {
    const v = new THREE.Vector2(x, y);
    runs[runs.length - 1].push(v);
    if (flag === 'sharp') runs.push([v]);
  }
  const out: THREE.Vector2[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    const sampled = new THREE.SplineCurve(run).getPoints((run.length - 1) * samplesPerSegment);
    for (let i = 0; i < sampled.length; i++) {
      if (out.length && i === 0) continue;
      const p = sampled[i];
      p.x = Math.max(0, p.x);
      const last = out[out.length - 1];
      if (last && last.distanceToSquared(p) < 1e-8) continue;
      out.push(p);
    }
  }
  return out;
};

const geometryCache = new Map<string, THREE.BufferGeometry>();

const getLathe = (key: string, profile: ProfilePoint[], segments = 64) => {
  let g = geometryCache.get(key);
  if (!g) {
    g = new THREE.LatheGeometry(smoothProfile(profile), segments);
    g.computeVertexNormals();
    geometryCache.set(key, g);
  }
  return g;
};

const getExtrude = (key: string, outline: [number, number][], depth: number, bevel = 0.015) => {
  let g = geometryCache.get(key);
  if (!g) {
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    shape.closePath();
    g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
    });
    g.translate(0, 0, -depth / 2 + bevel);
    g.computeVertexNormals();
    geometryCache.set(key, g);
  }
  return g;
};

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const STONE = {
  w: { color: '#E9E3D7', roughness: 0.5, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.4 },
  b: { color: '#2A292E', roughness: 0.22, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.15 },
};

const METAL = {
  w: { color: '#C9A85C', metalness: 1.0, roughness: 0.32 }, // gold
  b: { color: '#A3A8B0', metalness: 1.0, roughness: 0.28 }, // silver
};

const GEM: Record<Color, string> = {
  w: '#8FD3FF', // ice
  b: '#FF6A3D', // ember
};

type PartProps = { pieceColor: Color; isSelected: boolean };

function StoneMaterial({ pieceColor, isSelected }: PartProps) {
  return (
    <meshPhysicalMaterial
      {...STONE[pieceColor]}
      emissive={GEM[pieceColor]}
      emissiveIntensity={isSelected ? 0.15 : 0}
    />
  );
}

function MetalMaterial({ pieceColor }: { pieceColor: Color }) {
  return <meshStandardMaterial {...METAL[pieceColor]} />;
}

function GemMaterial({ pieceColor, isSelected, intensity = 1.4 }: PartProps & { intensity?: number }) {
  return (
    <meshStandardMaterial
      color={GEM[pieceColor]}
      emissive={GEM[pieceColor]}
      emissiveIntensity={isSelected ? intensity * 2.2 : intensity}
      toneMapped={false}
    />
  );
}

function CrystalMaterial({ pieceColor }: { pieceColor: Color }) {
  return (
    <meshPhysicalMaterial
      color={GEM[pieceColor]}
      transparent
      opacity={0.4}
      roughness={0.05}
      clearcoat={1}
      depthWrite={false}
    />
  );
}

function DarkMaterial() {
  return <meshStandardMaterial color="#0B0A0A" roughness={0.9} />;
}

// ---------------------------------------------------------------------------
// Shared octagonal stone plinth with a metal bead
// ---------------------------------------------------------------------------
const PLINTH_TOP = 0.13;

function Plinth({ radius, pieceColor, isSelected }: PartProps & { radius: number }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius - 0.02, radius, 0.10, 8]} />
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.105, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius - 0.045, 0.02, 10, 48]} />
        <MetalMaterial pieceColor={pieceColor} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pawn — foot soldier's helm
// ---------------------------------------------------------------------------
const PAWN_BODY: ProfilePoint[] = [
  [0, PLINTH_TOP, 'sharp'], [0.21, PLINTH_TOP, 'sharp'],
  [0.20, 0.22], [0.17, 0.34], [0.14, 0.42],
  [0, 0.43, 'sharp'],
];

function Pawn({ pieceColor, isSelected }: PartProps) {
  const body = getLathe('fantasy-pawn-body', PAWN_BODY);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.27} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={body} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* helm */}
      <mesh position={[0, 0.44, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.03, 32]} />
        <MetalMaterial pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <MetalMaterial pieceColor={pieceColor} />
      </mesh>
      {/* visor slit and nose guard (front is +z for white, -z for black) */}
      <group rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0.46, 0.14]}>
          <boxGeometry args={[0.16, 0.025, 0.03]} />
          <DarkMaterial />
        </mesh>
        <mesh position={[0, 0.42, 0.155]}>
          <boxGeometry args={[0.025, 0.10, 0.02]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
      </group>
      {/* plume */}
      <mesh position={[0, 0.66, 0]} castShadow>
        <coneGeometry args={[0.035, 0.14, 12]} />
        <GemMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={0.9} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rook — stone keep
// ---------------------------------------------------------------------------
const KEEP_PROFILE: ProfilePoint[] = [
  [0, PLINTH_TOP, 'sharp'], [0.28, PLINTH_TOP, 'sharp'],
  [0.26, 0.20], [0.23, 0.32], [0.22, 0.70],
  [0.25, 0.74, 'sharp'], [0.27, 0.78, 'sharp'], [0.27, 0.90, 'sharp'],
  [0.19, 0.90, 'sharp'], [0.19, 0.85, 'sharp'], [0, 0.85, 'sharp'],
];

const BANNER_OUTLINE: [number, number][] = [
  [0, 0], [0.16, 0.03], [0.11, 0.08], [0.16, 0.13], [0, 0.16],
];

function Rook({ pieceColor, isSelected }: PartProps) {
  const keep = getLathe('fantasy-keep', KEEP_PROFILE);
  const banner = getExtrude('fantasy-banner', BANNER_OUTLINE, 0.012, 0.004);
  const merlons = 8;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.34} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={keep} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* string course */}
      <mesh position={[0, 0.50, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.012, 8, 48]} />
        <MetalMaterial pieceColor={pieceColor} />
      </mesh>
      {/* battlements */}
      {Array.from({ length: merlons }, (_, i) => {
        const a = (i / merlons) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.23, 0.95, Math.sin(a) * 0.23]}
            rotation={[0, Math.PI / 2 - a, 0]}
            castShadow
          >
            <boxGeometry args={[0.10, 0.10, 0.08]} />
            <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        );
      })}
      {/* arched door and arrow slit, facing the opponent */}
      <group rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0.21, 0.24]}>
          <boxGeometry args={[0.10, 0.14, 0.04]} />
          <DarkMaterial />
        </mesh>
        <mesh position={[0, 0.28, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 16, 1, false, 0, Math.PI]} />
          <DarkMaterial />
        </mesh>
        <mesh position={[0, 0.62, 0.22]}>
          <boxGeometry args={[0.02, 0.10, 0.03]} />
          <DarkMaterial />
        </mesh>
      </group>
      {/* corner turret with a conical roof and banner */}
      <group position={[0.17, 0, -0.10]}>
        <mesh position={[0, 0.96, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.16, 20]} />
          <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        <mesh position={[0, 1.11, 0]} castShadow>
          <coneGeometry args={[0.09, 0.16, 20]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
        <mesh position={[0, 1.28, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.22, 8]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
        <mesh geometry={banner} position={[0.006, 1.22, 0]} rotation={[0, 0, 0]}>
          <GemMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bishop — wizard
// ---------------------------------------------------------------------------
const ROBE_PROFILE: ProfilePoint[] = [
  [0, PLINTH_TOP, 'sharp'], [0.30, PLINTH_TOP, 'sharp'],
  [0.28, 0.17], [0.21, 0.36], [0.16, 0.56], [0.14, 0.64],
  [0, 0.66, 'sharp'],
];

const HAT_PROFILE: ProfilePoint[] = [
  [0, 0.64, 'sharp'], [0.31, 0.61, 'sharp'],
  [0.32, 0.64], [0.27, 0.69], [0.19, 0.72], [0.15, 0.75],
  [0.12, 0.86], [0.08, 0.98], [0.045, 1.08], [0.02, 1.13],
  [0, 1.14, 'sharp'],
];

function Bishop({ pieceColor, isSelected }: PartProps) {
  const robe = getLathe('fantasy-robe', ROBE_PROFILE);
  const hat = getLathe('fantasy-hat', HAT_PROFILE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.33} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={robe} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* belt and beard */}
      <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.205, 0.014, 8, 48]} />
        <MetalMaterial pieceColor={pieceColor} />
      </mesh>
      <group rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0.52, 0.15]} rotation={[0.25, 0, 0]} castShadow>
          <coneGeometry args={[0.06, 0.22, 12]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
      </group>
      {/* hat */}
      <mesh geometry={hat} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.155, 0.014, 8, 48]} />
        <MetalMaterial pieceColor={pieceColor} />
      </mesh>
      {/* star on the band, facing the opponent */}
      <group rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0.76, 0.16]} rotation={[0, 0, Math.PI / 4]}>
          <octahedronGeometry args={[0.035, 0]} />
          <GemMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      </group>
      {/* floppy tip */}
      <mesh position={[0.05, 1.14, 0]} rotation={[0, 0, -1.1]} castShadow>
        <coneGeometry args={[0.025, 0.12, 10]} />
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Knight — dragon
// ---------------------------------------------------------------------------
const NECK_BASE: ProfilePoint[] = [
  [0, PLINTH_TOP, 'sharp'], [0.28, PLINTH_TOP, 'sharp'],
  [0.26, 0.17], [0.20, 0.22], [0.18, 0.26, 'sharp'], [0, 0.26, 'sharp'],
];

// (forward, up) silhouette, +x is forward
const DRAGON_OUTLINE: [number, number][] = [
  [-0.14, 0.24],
  [-0.20, 0.34], [-0.19, 0.50], [-0.13, 0.62], [-0.10, 0.72],
  // spine spikes
  [-0.17, 0.80], [-0.10, 0.80], [-0.15, 0.89], [-0.07, 0.87], [-0.09, 0.95],
  [-0.02, 0.94],                          // back of skull
  [0.06, 0.97], [0.14, 0.95], [0.22, 0.90], [0.30, 0.84],
  [0.37, 0.78],                           // snout
  [0.35, 0.72], [0.28, 0.70], [0.21, 0.70],
  [0.31, 0.63],                           // lower jaw, open
  [0.27, 0.58], [0.16, 0.60],
  [0.09, 0.62],                           // throat
  [0.03, 0.52], [0.01, 0.40],             // chest
  [0.08, 0.28], [0.14, 0.24],
];

const WING_OUTLINE: [number, number][] = [
  [0, 0], [0.30, 0.10], [0.24, 0.16], [0.30, 0.26], [0.20, 0.28], [0.22, 0.36], [0.06, 0.34],
];

function Knight({ pieceColor, isSelected }: PartProps) {
  const base = getLathe('fantasy-neckbase', NECK_BASE);
  const head = getExtrude('fantasy-dragon', DRAGON_OUTLINE, 0.16, 0.02);
  const wing = getExtrude('fantasy-wing', WING_OUTLINE, 0.02, 0.005);
  const facing = pieceColor === 'w' ? -Math.PI / 2 : Math.PI / 2;
  const half = 0.08;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.33} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={base} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <group rotation={[0, facing, 0]}>
        <mesh geometry={head} castShadow receiveShadow>
          <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        {/* horns */}
        {[-0.05, 0.05].map((z) => (
          <mesh key={z} position={[0.0, 1.0, z]} rotation={[0, 0, 0.7]} castShadow>
            <coneGeometry args={[0.022, 0.18, 8]} />
            <MetalMaterial pieceColor={pieceColor} />
          </mesh>
        ))}
        {/* eyes */}
        {[-half, half].map((z) => (
          <mesh key={z} position={[0.15, 0.86, z]}>
            <sphereGeometry args={[0.022, 12, 12]} />
            <GemMaterial pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        ))}
        {/* folded wings on the neck */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            geometry={wing}
            position={[-0.14, 0.50, s * 0.09]}
            rotation={[0, s * -0.55, 0.35]}
            scale={[-1, 1, 1]}
            castShadow
          >
            <MetalMaterial pieceColor={pieceColor} />
          </mesh>
        ))}
        {/* breath ember at the mouth */}
        <mesh position={[0.30, 0.67, 0]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <GemMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={1.8} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Queen — crescent spire
// ---------------------------------------------------------------------------
const QUEEN_SPIRE: ProfilePoint[] = [
  [0, PLINTH_TOP, 'sharp'], [0.24, PLINTH_TOP, 'sharp'],
  [0.20, 0.18], [0.13, 0.30], [0.10, 0.50], [0.09, 0.80],
  [0.07, 0.98], [0.05, 1.02],
  [0, 1.03, 'sharp'],
];

function Queen({ pieceColor, isSelected }: PartProps) {
  const spire = getLathe('fantasy-queen', QUEEN_SPIRE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.36} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={spire} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {[0.30, 0.62].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[i === 0 ? 0.135 : 0.10, 0.014, 8, 48]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
      ))}
      {/* crescent, opening upward; both sides show the moon face-on */}
      <group position={[0, 1.08, 0]} rotation={[0, pieceColor === 'w' ? 0 : Math.PI, -1.15 * Math.PI]}>
        <mesh castShadow>
          <torusGeometry args={[0.19, 0.03, 12, 48, Math.PI * 1.3]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
      </group>
      {/* orb held in the crescent */}
      <mesh position={[0, 1.17, 0]}>
        <sphereGeometry args={[0.065, 24, 24]} />
        <GemMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={1.8} />
      </mesh>
      <mesh position={[0, 1.17, 0]}>
        <sphereGeometry args={[0.10, 24, 24]} />
        <CrystalMaterial pieceColor={pieceColor} />
      </mesh>
      {/* small stars */}
      {[[0.16, 0.90, 0.10], [-0.14, 0.82, -0.12]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.4, 0.2, Math.PI / 4]}>
          <octahedronGeometry args={[0.03, 0]} />
          <GemMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// King — crowned tower
// ---------------------------------------------------------------------------
const KING_TOWER: ProfilePoint[] = [
  [0, PLINTH_TOP, 'sharp'], [0.30, PLINTH_TOP, 'sharp'],
  [0.28, 0.18], [0.22, 0.28], [0.18, 0.45], [0.16, 0.70], [0.16, 0.95],
  [0.20, 1.00, 'sharp'], [0.22, 1.04, 'sharp'], [0.22, 1.10, 'sharp'],
  [0.14, 1.10, 'sharp'], [0.14, 1.05, 'sharp'], [0, 1.05, 'sharp'],
];

function King({ pieceColor, isSelected }: PartProps) {
  const tower = getLathe('fantasy-king', KING_TOWER);
  const points = 8;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.40} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={tower} castShadow receiveShadow>
        <StoneMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {[0.46, 0.95].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[i === 0 ? 0.185 : 0.165, 0.016, 8, 48]} />
          <MetalMaterial pieceColor={pieceColor} />
        </mesh>
      ))}
      {/* crown of alternating tall and short points */}
      {Array.from({ length: points }, (_, i) => {
        const a = (i / points) * Math.PI * 2;
        const tall = i % 2 === 0;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.19, 1.10 + (tall ? 0.09 : 0.05), Math.sin(a) * 0.19]}
            rotation={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]}
            castShadow
          >
            <coneGeometry args={[0.035, tall ? 0.18 : 0.10, 8]} />
            <MetalMaterial pieceColor={pieceColor} />
          </mesh>
        );
      })}
      {/* floating gem above the crown */}
      <mesh position={[0, 1.30, 0]} scale={[1, 1.6, 1]}>
        <octahedronGeometry args={[0.075, 0]} />
        <GemMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={1.8} />
      </mesh>
      <mesh position={[0, 1.30, 0]} scale={[1, 1.6, 1]}>
        <octahedronGeometry args={[0.105, 0]} />
        <CrystalMaterial pieceColor={pieceColor} />
      </mesh>
    </group>
  );
}

const PIECE_MAP: Record<PieceSymbol, React.FC<PartProps>> = {
  k: King,
  q: Queen,
  r: Rook,
  b: Bishop,
  n: Knight,
  p: Pawn,
};

export function ChessPieceFantasy3D({ type, color, position, isSelected, onClick }: ChessPiece3DProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const Piece = PIECE_MAP[type];

  const { pos } = useSpring({
    pos: position,
    config: { mass: 1, tension: 280, friction: 60 },
  });

  useFrame((state) => {
    if (!groupRef.current) return;
    const p = pos.get();
    groupRef.current.position.x = p[0];
    groupRef.current.position.z = p[2];
    groupRef.current.position.y = isSelected
      ? p[1] + 0.04 + Math.sin(state.clock.elapsedTime * 3) * 0.02
      : p[1];
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Piece pieceColor={color} isSelected={isSelected} />
      {isSelected && (
        <pointLight position={[0, 0.6, 0]} intensity={1.6} color={GEM[color]} distance={2.2} decay={2} />
      )}
    </group>
  );
}
