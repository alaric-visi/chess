import { AnimatedPiece, PieceProps } from './AnimatedPiece';
import { Geo, SharedMaterial } from './Shared';
import * as THREE from 'three';
import { PieceSymbol, Color } from 'chess.js';

const SCALE = 0.85;
// 40 radial segments and 4 samples per profile span keep pieces smooth at play
// distance at well under half the triangles of 64 / 6.
const LATHE_SEGMENTS = 40;

// ---------------------------------------------------------------------------
// Profile helpers
//
// A profile is a list of [radius, height] control points. By default runs of
// points are passed through a Catmull-Rom spline so the turned silhouette is
// smooth like a real lathed piece. Marking a point 'sharp' breaks the spline
// there, which is how we get crisp edges on collars, base beads and rims.
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
    if (run.length < 2) {
      if (run.length === 1 && out.length === 0) out.push(run[0]);
      continue;
    }
    const curve = new THREE.SplineCurve(run);
    const sampled = curve.getPoints((run.length - 1) * samplesPerSegment);
    for (let i = 0; i < sampled.length; i++) {
      if (out.length && i === 0) continue; // shared corner already emitted
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

const getLathe = (key: string, profile: ProfilePoint[]) => {
  let g = geometryCache.get(key);
  if (!g) {
    g = new THREE.LatheGeometry(smoothProfile(profile), LATHE_SEGMENTS);
    g.computeVertexNormals();
    geometryCache.set(key, g);
  }
  return g;
};

// Shared base treatment: flat foot, rounded bead, then the piece starts.
const foot = (r: number): ProfilePoint[] => [
  [0, 0, 'sharp'],
  [r, 0, 'sharp'],
  [r, 0.05],
  [r - 0.01, 0.09],
  [r - 0.04, 0.12],
  [r - 0.1, 0.15],
  [r - 0.14, 0.19],
];

// A raised collar ring: crisp on both edges.
const collar = (r: number, y: number): ProfilePoint[] => [
  [r, y, 'sharp'],
  [r + 0.02, y + 0.03],
  [r, y + 0.06, 'sharp'],
];

// ---------------------------------------------------------------------------
// Staunton profiles (pre-scale units; one board square = 1)
// ---------------------------------------------------------------------------
const KING_PROFILE: ProfilePoint[] = [
  ...foot(0.4),
  [0.22, 0.24],
  [0.19, 0.32],
  [0.17, 0.44],
  [0.17, 0.56],
  ...collar(0.2, 0.61),
  [0.18, 0.72],
  [0.16, 0.82],
  [0.14, 0.92],
  [0.14, 1.0],
  [0.18, 1.04],
  [0.22, 1.08],
  [0.23, 1.12],
  [0.2, 1.16],
  [0.14, 1.2],
  [0.09, 1.26],
  [0.07, 1.3],
  [0, 1.32, 'sharp'],
];

const QUEEN_PROFILE: ProfilePoint[] = [
  ...foot(0.37),
  [0.2, 0.24],
  [0.17, 0.32],
  [0.15, 0.44],
  [0.15, 0.54],
  ...collar(0.18, 0.59),
  [0.16, 0.7],
  [0.14, 0.8],
  [0.12, 0.9],
  [0.12, 0.98],
  [0.15, 1.02],
  [0.19, 1.06],
  [0.21, 1.1],
  [0.2, 1.14],
  [0.16, 1.16],
  [0.1, 1.18],
  [0.06, 1.2],
  [0, 1.21, 'sharp'],
];

const BISHOP_PROFILE: ProfilePoint[] = [
  ...foot(0.34),
  [0.17, 0.24],
  [0.14, 0.32],
  [0.13, 0.44],
  [0.13, 0.52],
  ...collar(0.16, 0.56),
  [0.14, 0.66],
  [0.13, 0.7],
  // mitre
  [0.17, 0.76],
  [0.19, 0.84],
  [0.17, 0.92],
  [0.12, 0.99],
  [0.07, 1.03],
  [0.04, 1.05],
  [0, 1.06, 'sharp'],
];

const ROOK_PROFILE: ProfilePoint[] = [
  ...foot(0.36),
  [0.21, 0.28],
  [0.2, 0.4],
  [0.2, 0.55],
  [0.22, 0.62],
  // tower
  [0.26, 0.66, 'sharp'],
  [0.27, 0.7, 'sharp'],
  [0.27, 0.9, 'sharp'],
  // recessed top
  [0.18, 0.9, 'sharp'],
  [0.18, 0.85, 'sharp'],
  [0, 0.85, 'sharp'],
];

const KNIGHT_BASE_PROFILE: ProfilePoint[] = [
  ...foot(0.34),
  [0.17, 0.24],
  [0.16, 0.3],
  [0.18, 0.33, 'sharp'],
  [0.18, 0.36, 'sharp'],
  [0, 0.36, 'sharp'],
];

const PAWN_PROFILE: ProfilePoint[] = [
  [0, 0, 'sharp'],
  [0.3, 0, 'sharp'],
  [0.3, 0.04],
  [0.29, 0.07],
  [0.26, 0.1],
  [0.2, 0.13],
  [0.16, 0.17],
  [0.13, 0.22],
  [0.1, 0.3],
  [0.09, 0.38],
  ...collar(0.12, 0.41),
  [0.09, 0.49],
  [0, 0.5, 'sharp'],
];

// ---------------------------------------------------------------------------
// Knight head: a bevelled extrusion of a horse-head silhouette.
// Drawn in (forward, up) space; the extrude axis becomes left/right.
// ---------------------------------------------------------------------------
const KNIGHT_HEAD_THICKNESS = 0.18;

const KNIGHT_HEAD_OUTLINE: [number, number][] = [
  [-0.16, 0.34], // back of neck, sitting on the base
  [-0.2, 0.48],
  [-0.21, 0.56],
  // mane scallops up the back of the neck
  [-0.17, 0.61],
  [-0.21, 0.66],
  [-0.16, 0.71],
  [-0.2, 0.76],
  [-0.15, 0.81],
  [-0.17, 0.86],
  [-0.11, 0.9], // crown
  // ears
  [-0.06, 0.92],
  [-0.04, 1.02],
  [0.0, 0.94],
  [0.04, 0.95],
  [0.07, 1.03],
  [0.09, 0.92],
  // forehead and nose
  [0.15, 0.88],
  [0.22, 0.8],
  [0.29, 0.71],
  [0.33, 0.63], // nose tip
  [0.31, 0.57],
  [0.26, 0.54], // mouth
  [0.2, 0.55], // jaw
  [0.14, 0.57],
  [0.08, 0.51], // throat
  [0.03, 0.44],
  [0.1, 0.38],
  [0.16, 0.34], // front of neck
];

const getKnightHead = () => {
  const key = 'knight-head';
  let g = geometryCache.get(key);
  if (!g) {
    const shape = new THREE.Shape();
    KNIGHT_HEAD_OUTLINE.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    shape.closePath();
    const bevel = 0.025;
    g = new THREE.ExtrudeGeometry(shape, {
      depth: KNIGHT_HEAD_THICKNESS - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 8,
    });
    g.center();
    // center() also recentres x/y; put the neck back on the base.
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(-(bb.min.x + bb.max.x) / 2 + 0.02, 0.34 - bb.min.y, 0);
    g.computeVertexNormals();
    geometryCache.set(key, g);
  }
  return g;
};

// ---------------------------------------------------------------------------
// Materials: lacquered boxwood / ebony look. Clearcoat gives the glassy
// highlight the site's glassmorphic aesthetic wants; add an <Environment>
// in the scene so there is something for the clearcoat to reflect.
// ---------------------------------------------------------------------------
const WHITE_MATERIAL = {
  color: '#F1EBDF',
  roughness: 0.38,
  metalness: 0.0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.25,
  envMapIntensity: 0.9,
};

const BLACK_MATERIAL = {
  color: '#1A1917',
  roughness: 0.3,
  metalness: 0.05,
  clearcoat: 0.9,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.1,
};

function PieceMaterial({ pieceColor, isSelected }: { pieceColor: Color; isSelected: boolean }) {
  return (
    <SharedMaterial
      id={`classic-body-${pieceColor}-${isSelected}`}
      create={() =>
        new THREE.MeshPhysicalMaterial({
          ...(pieceColor === 'w' ? WHITE_MATERIAL : BLACK_MATERIAL),
          emissive: pieceColor === 'w' ? '#E8C97A' : '#C9A24E',
          emissiveIntensity: isSelected ? 0.35 : 0,
        })
      }
    />
  );
}

// Soft contact shadow under the foot so pieces feel seated on the board.
function ContactShadow({ radius }: { radius: number }) {
  return (
    <mesh position={[0, 0.002, 0]}>
      <Geo kind="cylinder" args={[radius + 0.03, radius + 0.03, 0.004, 48]} />
      <SharedMaterial
        id="classic-contact-shadow"
        create={() =>
          new THREE.MeshBasicMaterial({
            color: '#000000',
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          })
        }
      />
    </mesh>
  );
}

type PartProps = { pieceColor: Color; isSelected: boolean };

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
function King({ pieceColor, isSelected }: PartProps) {
  const geo = getLathe('king', KING_PROFILE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <ContactShadow radius={0.4} />
      <mesh geometry={geo} castShadow receiveShadow>
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* cross */}
      <mesh position={[0, 1.42, 0]} castShadow>
        <Geo kind="box" args={[0.05, 0.22, 0.05]} />
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 1.46, 0]} castShadow>
        <Geo kind="box" args={[0.17, 0.05, 0.05]} />
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

function Queen({ pieceColor, isSelected }: PartProps) {
  const geo = getLathe('queen', QUEEN_PROFILE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <ContactShadow radius={0.37} />
      <mesh geometry={geo} castShadow receiveShadow>
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* coronet points */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.185, 1.135, Math.sin(a) * 0.185]} castShadow>
            <Geo kind="sphere" args={[0.032, 16, 16]} />
            <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        );
      })}
      {/* finial */}
      <mesh position={[0, 1.27, 0]} castShadow>
        <Geo kind="sphere" args={[0.07, 32, 32]} />
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

function Bishop({ pieceColor, isSelected }: PartProps) {
  const geo = getLathe('bishop', BISHOP_PROFILE);
  const slitColor = pieceColor === 'w' ? '#7A6F5C' : '#050505';
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <ContactShadow radius={0.34} />
      <mesh geometry={geo} castShadow receiveShadow>
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* diagonal mitre slit: a thin dark plate that pokes through the front and back */}
      <mesh position={[0.02, 0.88, 0]} rotation={[0, 0, 0.55]}>
        <Geo kind="box" args={[0.012, 0.24, 0.5]} />
        <SharedMaterial
          id={`classic-slit-${slitColor}`}
          create={() => new THREE.MeshStandardMaterial({ color: slitColor, roughness: 0.9 })}
        />
      </mesh>
      <mesh position={[0, 1.09, 0]} castShadow>
        <Geo kind="sphere" args={[0.042, 24, 24]} />
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

function Rook({ pieceColor, isSelected }: PartProps) {
  const geo = getLathe('rook', ROOK_PROFILE);
  const merlons = 6;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <ContactShadow radius={0.36} />
      <mesh geometry={geo} castShadow receiveShadow>
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* battlements */}
      {Array.from({ length: merlons }, (_, i) => {
        const a = (i / merlons) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.225, 0.955, Math.sin(a) * 0.225]}
            rotation={[0, Math.PI / 2 - a, 0]}
            castShadow
          >
            <Geo kind="box" args={[0.13, 0.12, 0.09]} />
            <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        );
      })}
    </group>
  );
}

function Knight({ pieceColor, isSelected }: PartProps) {
  const baseGeo = getLathe('knight-base', KNIGHT_BASE_PROFILE);
  const headGeo = getKnightHead();
  const eyeColor = pieceColor === 'w' ? '#2A2622' : '#6B665E';
  // White faces +z (toward black), black faces -z.
  const facing = pieceColor === 'w' ? -Math.PI / 2 : Math.PI / 2;
  const eyeX = KNIGHT_HEAD_THICKNESS / 2 - 0.005;

  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <ContactShadow radius={0.34} />
      <mesh geometry={baseGeo} castShadow receiveShadow>
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <group rotation={[0, facing, 0]}>
        <mesh geometry={headGeo} castShadow receiveShadow>
          <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        {[-eyeX, eyeX].map((x) => (
          <mesh key={x} position={[0.13, 0.82, x]} castShadow>
            <Geo kind="sphere" args={[0.022, 12, 12]} />
            <SharedMaterial
              id={`classic-eye-${eyeColor}`}
              create={() => new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.2 })}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Pawn({ pieceColor, isSelected }: PartProps) {
  const geo = getLathe('pawn', PAWN_PROFILE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <ContactShadow radius={0.3} />
      <mesh geometry={geo} castShadow receiveShadow>
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.59, 0]} castShadow>
        <Geo kind="sphere" args={[0.11, 32, 32]} />
        <PieceMaterial pieceColor={pieceColor} isSelected={isSelected} />
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

export function ChessPiece3D(props: PieceProps) {
  const { type, color, isSelected } = props;
  const Piece = PIECE_MAP[type];
  return (
    <AnimatedPiece {...props} hover={{ lift: 0.03, amp: 0.025, speed: 4 }} glowColor={'#F3D98B'}>
      <Piece pieceColor={color} isSelected={isSelected} />
    </AnimatedPiece>
  );
}
