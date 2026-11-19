import { AnimatedPiece, PieceProps } from './AnimatedPiece';
import { Geo, SharedMaterial } from './Shared';
import * as THREE from 'three';
import { PieceSymbol, Color } from 'chess.js';

const SCALE = 0.85;

// ---------------------------------------------------------------------------
// Profile helper (Catmull-Rom smoothed lathe profiles, 'sharp' breaks the spline)
// ---------------------------------------------------------------------------
type ProfilePoint = [number, number] | [number, number, 'sharp'];

const smoothProfile = (pts: ProfilePoint[], samplesPerSegment = 4): THREE.Vector2[] => {
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

const getLathe = (key: string, profile: ProfilePoint[], segments = 40) => {
  let g = geometryCache.get(key);
  if (!g) {
    g = new THREE.LatheGeometry(smoothProfile(profile), segments);
    g.computeVertexNormals();
    geometryCache.set(key, g);
  }
  return g;
};

const getExtrude = (key: string, outline: [number, number][], depth: number, bevel = 0.012) => {
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
const HULL = {
  w: { color: '#E9ECEF', metalness: 0.25, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 },
  b: { color: '#262A2F', metalness: 0.9, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.3 },
};

const TRIM = {
  w: { color: '#B9C2CC', metalness: 0.95, roughness: 0.25 },
  b: { color: '#5B6168', metalness: 0.95, roughness: 0.3 },
};

const ACCENT: Record<Color, string> = {
  w: '#8FE3FF',
  b: '#FFB05A',
};

type PartProps = { pieceColor: Color; isSelected: boolean };

function HullMaterial({ pieceColor, isSelected }: PartProps) {
  return (
    <SharedMaterial
      id={`scifi-hull-${pieceColor}-${isSelected}`}
      create={() =>
        new THREE.MeshPhysicalMaterial({
          ...HULL[pieceColor],
          emissive: ACCENT[pieceColor],
          emissiveIntensity: isSelected ? 0.18 : 0,
        })
      }
    />
  );
}

function TrimMaterial({ pieceColor }: { pieceColor: Color }) {
  return (
    <SharedMaterial
      id={`scifi-trim-${pieceColor}`}
      create={() => new THREE.MeshStandardMaterial(TRIM[pieceColor])}
    />
  );
}

function LightMaterial({ pieceColor, isSelected, intensity = 1.6 }: PartProps & { intensity?: number }) {
  const strength = isSelected ? intensity * 2.2 : intensity;
  return (
    <SharedMaterial
      id={`scifi-light-${pieceColor}-${strength}`}
      create={() =>
        new THREE.MeshStandardMaterial({
          color: ACCENT[pieceColor],
          emissive: ACCENT[pieceColor],
          emissiveIntensity: strength,
          toneMapped: false,
        })
      }
    />
  );
}

function GlassMaterial({ pieceColor }: { pieceColor: Color }) {
  return (
    <SharedMaterial
      id={`scifi-glass-${pieceColor}`}
      create={() =>
        new THREE.MeshPhysicalMaterial({
          color: ACCENT[pieceColor],
          transparent: true,
          opacity: 0.45,
          roughness: 0.05,
          metalness: 0,
          clearcoat: 1,
          depthWrite: false,
        })
      }
    />
  );
}

function Pedestal({ radius, pieceColor, isSelected }: PartProps & { radius: number }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <Geo kind="cylinder" args={[radius, radius, 0.1, 6]} />
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <Geo kind="cylinder" args={[radius - 0.035, radius - 0.035, 0.02, 6]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={1.2} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <Geo kind="cylinder" args={[radius - 0.06, radius - 0.02, 0.04, 6]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
    </group>
  );
}

const PEDESTAL_TOP = 0.16;

function Pawn({ pieceColor, isSelected }: PartProps) {
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Pedestal radius={0.27} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh position={[0, PEDESTAL_TOP + 0.08, 0]} castShadow>
        <Geo kind="cylinder" args={[0.035, 0.05, 0.16, 16]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <Geo kind="sphere" args={[0.14, 32, 32]} />
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Geo kind="torus" args={[0.14, 0.016, 12, 48]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.63, 0]}>
        <Geo kind="cylinder" args={[0.008, 0.008, 0.12, 8]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <Geo kind="sphere" args={[0.018, 12, 12]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

const ROCKET_PROFILE: ProfilePoint[] = [
  [0, 0.22, 'sharp'],
  [0.12, 0.22, 'sharp'],
  [0.09, 0.28],
  [0.1, 0.32],
  [0.16, 0.38],
  [0.17, 0.46],
  [0.17, 0.8],
  [0.15, 0.88],
  [0.1, 0.96],
  [0.04, 1.03],
  [0, 1.05, 'sharp'],
];

const FIN_OUTLINE: [number, number][] = [
  [0, 0],
  [0.19, 0],
  [0.19, 0.07],
  [0.03, 0.36],
  [0, 0.36],
];

function Rook({ pieceColor, isSelected }: PartProps) {
  const body = getLathe('scifi-rocket', ROCKET_PROFILE);
  const fin = getExtrude('scifi-fin', FIN_OUTLINE, 0.035);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Pedestal radius={0.34} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={body} castShadow receiveShadow>
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <Geo kind="sphere" args={[0.075, 16, 16]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={2.2} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        return (
          <mesh
            key={i}
            geometry={fin}
            position={[Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15]}
            rotation={[0, -a, 0]}
            castShadow
          >
            <TrimMaterial pieceColor={pieceColor} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Geo kind="torus" args={[0.165, 0.012, 8, 48]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <Geo kind="cylinder" args={[0.18, 0.18, 0.03, 32]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
    </group>
  );
}

const DISH_PROFILE: ProfilePoint[] = [
  [0, 0, 'sharp'],
  [0.1, 0.008],
  [0.18, 0.03],
  [0.24, 0.065],
  [0.28, 0.1, 'sharp'],
  [0.28, 0.12, 'sharp'],
  [0.24, 0.085],
  [0.18, 0.05],
  [0.1, 0.028],
  [0, 0.02, 'sharp'],
];

function Bishop({ pieceColor, isSelected }: PartProps) {
  const dish = getLathe('scifi-dish', DISH_PROFILE, 48);
  const tilt = pieceColor === 'w' ? 0.95 : -0.95;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Pedestal radius={0.31} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh position={[0, PEDESTAL_TOP + 0.26, 0]} castShadow>
        <Geo kind="cylinder" args={[0.03, 0.05, 0.52, 16]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <Geo kind="cylinder" args={[0.07, 0.07, 0.04, 16]} />
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.71, 0]} castShadow>
        <Geo kind="sphere" args={[0.065, 24, 24]} />
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <group position={[0, 0.78, 0]} rotation={[tilt, 0, 0]}>
        <mesh geometry={dish} castShadow receiveShadow>
          <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <Geo kind="cylinder" args={[0.012, 0.012, 0.2, 8]} />
          <TrimMaterial pieceColor={pieceColor} />
        </mesh>
        <mesh position={[0, 0.21, 0]}>
          <Geo kind="sphere" args={[0.03, 16, 16]} />
          <LightMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={2} />
        </mesh>
      </group>
    </group>
  );
}

const FIGHTER_OUTLINE: [number, number][] = [
  [0.34, 0],
  [0.16, 0.06],
  [0.02, 0.25],
  [-0.09, 0.28],
  [-0.12, 0.13],
  [-0.21, 0.15],
  [-0.23, 0.05],
  [-0.23, -0.05],
  [-0.21, -0.15],
  [-0.12, -0.13],
  [-0.09, -0.28],
  [0.02, -0.25],
  [0.16, -0.06],
];

function Knight({ pieceColor, isSelected }: PartProps) {
  const hull = getExtrude('scifi-fighter', FIGHTER_OUTLINE, 0.06);
  const facing = pieceColor === 'w' ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Pedestal radius={0.31} pieceColor={pieceColor} isSelected={isSelected} />
      <group rotation={[0, facing, 0]}>
        <mesh position={[-0.05, PEDESTAL_TOP + 0.22, 0]} rotation={[0, 0, 0.15]} castShadow>
          <Geo kind="cylinder" args={[0.025, 0.05, 0.44, 12]} />
          <TrimMaterial pieceColor={pieceColor} />
        </mesh>
        <group position={[0, 0.62, 0]} rotation={[0, 0, 0.32]}>
          <mesh geometry={hull} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
          <mesh position={[0.08, 0.04, 0]} scale={[0.11, 0.05, 0.06]}>
            <Geo kind="sphere" args={[1, 24, 16]} />
            <GlassMaterial pieceColor={pieceColor} />
          </mesh>
          {[-0.09, 0.09].map((z) => (
            <group key={z} position={[-0.2, 0, z]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <Geo kind="cylinder" args={[0.035, 0.035, 0.12, 16]} />
                <TrimMaterial pieceColor={pieceColor} />
              </mesh>
              <mesh position={[-0.065, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <Geo kind="cylinder" args={[0.026, 0.026, 0.01, 16]} />
                <LightMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={2.4} />
              </mesh>
            </group>
          ))}
          {[-0.27, 0.27].map((z) => (
            <mesh key={z} position={[-0.06, 0, z]}>
              <Geo kind="sphere" args={[0.015, 10, 10]} />
              <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

const SAUCER_PROFILE: ProfilePoint[] = [
  [0, 0.64, 'sharp'],
  [0.14, 0.64],
  [0.28, 0.68],
  [0.38, 0.74, 'sharp'],
  [0.3, 0.8],
  [0.18, 0.84],
  [0.13, 0.85, 'sharp'],
  [0, 0.85, 'sharp'],
];

function Queen({ pieceColor, isSelected }: PartProps) {
  const saucer = getLathe('scifi-saucer', SAUCER_PROFILE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Pedestal radius={0.36} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh position={[0, PEDESTAL_TOP + 0.25, 0]} castShadow>
        <Geo kind="cylinder" args={[0.05, 0.08, 0.5, 24]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
      {[0.3, 0.5].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Geo kind="torus" args={[0.065, 0.01, 8, 32]} />
          <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      <mesh geometry={saucer} castShadow receiveShadow>
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.34, 0.755, Math.sin(a) * 0.34]}>
            <Geo kind="sphere" args={[0.018, 10, 10]} />
            <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.86, 0]}>
        <Geo kind="sphere" args={[0.055, 20, 20]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={2} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <Geo kind="sphere" args={[0.13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <GlassMaterial pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 1.07, 0]}>
        <Geo kind="cylinder" args={[0.008, 0.014, 0.2, 8]} />
        <TrimMaterial pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <Geo kind="sphere" args={[0.022, 12, 12]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

const SPIRE_PROFILE: ProfilePoint[] = [
  [0, PEDESTAL_TOP, 'sharp'],
  [0.15, PEDESTAL_TOP, 'sharp'],
  [0.13, 0.3],
  [0.11, 0.6],
  [0.1, 0.9],
  [0.08, 1.12],
  [0.05, 1.2],
  [0, 1.22, 'sharp'],
];

function King({ pieceColor, isSelected }: PartProps) {
  const spire = getLathe('scifi-spire', SPIRE_PROFILE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Pedestal radius={0.4} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={spire} castShadow receiveShadow>
        <HullMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {[0.4, 0.7, 1.0].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Geo kind="torus" args={[0.118 - (y - 0.4) * 0.03, 0.008, 8, 40]} />
          <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      <group position={[0, 0.84, 0]} rotation={[0.55, 0, 0.35]}>
        <mesh castShadow>
          <Geo kind="torus" args={[0.3, 0.025, 12, 64]} />
          <TrimMaterial pieceColor={pieceColor} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0]}>
              <Geo kind="sphere" args={[0.035, 14, 14]} />
              <LightMaterial pieceColor={pieceColor} isSelected={isSelected} />
            </mesh>
          );
        })}
      </group>
      <mesh position={[0, 1.32, 0]} castShadow>
        <Geo kind="octahedron" args={[0.09, 0]} />
        <LightMaterial pieceColor={pieceColor} isSelected={isSelected} intensity={2} />
      </mesh>
      <mesh position={[0, 1.32, 0]}>
        <Geo kind="octahedron" args={[0.12, 0]} />
        <GlassMaterial pieceColor={pieceColor} />
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

export function ChessPieceSciFi3D(props: PieceProps) {
  const { type, color, isSelected } = props;
  const Piece = PIECE_MAP[type];
  return (
    <AnimatedPiece {...props} hover={{ lift: 0.06, amp: 0.02, speed: 3 }} glowColor={ACCENT[color]}>
      <Piece pieceColor={color} isSelected={isSelected} />
    </AnimatedPiece>
  );
}
