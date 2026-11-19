import * as THREE from 'three';
import { PieceSymbol, Color } from 'chess.js';
import { AnimatedPiece, PieceProps } from './AnimatedPiece';
import { Geo, SharedMaterial } from './Shared';
import { extrude, lathe, ProfilePoint, ringAngles, tube } from './pieceGeometry';

/**
 * Forest chess set.
 *
 *   King   — great oak with a golden cross in its crown
 *   Queen  — blossom tree wearing a coronet of flowers
 *   Rook   — tree stump with splintered battlements and a mushroom
 *   Bishop — pine tree with a glowing star
 *   Knight — stag's head whose antlers sprout leaves
 *   Pawn   — acorn
 *
 * White is pale birch with spring leaves and firefly-yellow accents; black is
 * dark walnut with autumn leaves and ember accents. Every piece stands on a
 * root mound. Fronts face +z for White, as in the other sets.
 */

const SCALE = 0.85;
const MOUND_TOP = 0.13;

type PartProps = { pieceColor: Color; isSelected: boolean };

// ---------------------------------------------------------------------------
// Materials (shared across every piece; see sharedResources.ts)
// ---------------------------------------------------------------------------
const BARK = {
  w: { color: '#E6DFD0', roughness: 0.85 },
  b: { color: '#4A3322', roughness: 0.8 },
};
const LEAF = {
  w: { color: '#8CCB6A', roughness: 0.6, sheen: 0.6, sheenColor: '#D8FFC0' },
  b: { color: '#B5452A', roughness: 0.6, sheen: 0.6, sheenColor: '#FFC08A' },
};
const NUT = { w: '#E3CC93', b: '#7A4524' };
const CUT_WOOD = { w: '#F3E7C9', b: '#C48B57' };
const MOSS = { w: '#7DA25E', b: '#3E5A31' };
const ACCENT: Record<Color, string> = { w: '#FFE680', b: '#FF8C42' };

function Bark({ pieceColor, isSelected }: PartProps) {
  return (
    <SharedMaterial
      id={`forest-bark-${pieceColor}-${isSelected}`}
      create={() =>
        new THREE.MeshStandardMaterial({
          ...BARK[pieceColor],
          emissive: ACCENT[pieceColor],
          emissiveIntensity: isSelected ? 0.12 : 0,
        })
      }
    />
  );
}

function Leaf({ pieceColor, isSelected }: PartProps) {
  return (
    <SharedMaterial
      id={`forest-leaf-${pieceColor}-${isSelected}`}
      create={() =>
        new THREE.MeshPhysicalMaterial({
          ...LEAF[pieceColor],
          emissive: LEAF[pieceColor].color,
          emissiveIntensity: isSelected ? 0.3 : 0,
        })
      }
    />
  );
}

function Flat({ id, color, roughness = 0.7 }: { id: string; color: string; roughness?: number }) {
  return (
    <SharedMaterial
      id={`forest-${id}-${color}`}
      create={() => new THREE.MeshStandardMaterial({ color, roughness })}
    />
  );
}

function Glow({ pieceColor, isSelected, intensity = 1.2 }: PartProps & { intensity?: number }) {
  const strength = isSelected ? intensity * 2 : intensity;
  return (
    <SharedMaterial
      id={`forest-glow-${pieceColor}-${strength}`}
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

const Dark = () => <Flat id="dark" color="#1A120C" roughness={0.4} />;

/** Faces +z for White and -z for Black. */
const Front = ({ pieceColor, children }: { pieceColor: Color; children: React.ReactNode }) => (
  <group rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>{children}</group>
);

// ---------------------------------------------------------------------------
// Root mound, shared base
// ---------------------------------------------------------------------------
const moundProfile = (r: number): ProfilePoint[] => [
  [0, 0, 'sharp'],
  [r, 0, 'sharp'],
  [r * 0.97, 0.05],
  [r * 0.8, 0.1],
  [r * 0.55, MOUND_TOP],
  [0, MOUND_TOP + 0.01, 'sharp'],
];

function Mound({ radius, pieceColor, isSelected }: PartProps & { radius: number }) {
  const mound = lathe(`forest-mound-${radius}`, moundProfile(radius));
  const root = tube(
    `forest-root-${radius}`,
    [
      [0, 0.1, 0],
      [radius * 0.6, 0.07, 0],
      [radius * 1.05, 0.015, 0],
    ],
    0.04,
    0.35,
    16,
    8,
  );
  return (
    <group>
      <mesh geometry={mound} castShadow receiveShadow>
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {ringAngles(4, Math.PI / 4).map((a) => (
        <mesh key={a} geometry={root} rotation={[0, a, 0]} castShadow>
          <Bark pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      {/* moss tufts between the roots */}
      {ringAngles(4).map((a, i) => (
        <mesh
          key={a}
          position={[Math.cos(a) * radius * 0.72, 0.07, Math.sin(a) * radius * 0.72]}
          scale={[1, 0.55, 1]}
        >
          <Geo kind="sphere" args={[0.045 + (i % 2) * 0.015, 10, 8]} />
          <Flat id="moss" color={MOSS[pieceColor]} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

const LEAF_OUTLINE: [number, number][] = [
  [0, 0],
  [0.05, 0.03],
  [0.09, 0.08],
  [0.1, 0.13],
  [0.06, 0.12],
  [0.02, 0.07],
];

// ---------------------------------------------------------------------------
// Pawn — acorn
// ---------------------------------------------------------------------------
function Pawn({ pieceColor, isSelected }: PartProps) {
  const leaf = extrude('forest-leaf', LEAF_OUTLINE, 0.012, 0.004);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Mound radius={0.27} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh position={[0, 0.17, 0]} castShadow>
        <Geo kind="cylinder" args={[0.03, 0.045, 0.08, 10]} />
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* the nut */}
      <mesh position={[0, 0.33, 0]} scale={[1, 1.25, 1]} castShadow receiveShadow>
        <Geo kind="sphere" args={[0.15, 28, 20]} />
        <Flat id="nut" color={NUT[pieceColor]} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.505, 0]}>
        <Geo kind="cone" args={[0.02, 0.05, 10]} />
        <Flat id="nut" color={NUT[pieceColor]} roughness={0.35} />
      </mesh>
      {/* scaly cap */}
      <mesh position={[0, 0.42, 0]} scale={[1, 0.75, 1]} castShadow>
        <Geo kind="sphere" args={[0.172, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.425, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Geo kind="torus" args={[0.165, 0.016, 8, 32]} />
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.58, 0]} rotation={[0, 0, 0.25]} castShadow>
        <Geo kind="cylinder" args={[0.016, 0.026, 0.1, 8]} />
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh geometry={leaf} position={[0.015, 0.6, 0]} rotation={[0.3, 0.4, -0.5]} castShadow>
        <Leaf pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rook — tree stump
// ---------------------------------------------------------------------------
const STUMP: ProfilePoint[] = [
  [0, MOUND_TOP - 0.03, 'sharp'],
  [0.3, MOUND_TOP - 0.03, 'sharp'],
  [0.27, 0.2],
  [0.245, 0.35],
  [0.24, 0.7],
  [0.255, 0.74, 'sharp'],
  [0, 0.74, 'sharp'],
];

function Rook({ pieceColor, isSelected }: PartProps) {
  const stump = lathe('forest-stump', STUMP);
  const splinters = 7;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Mound radius={0.35} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={stump} castShadow receiveShadow>
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* sawn top with growth rings */}
      <mesh position={[0, 0.744, 0]}>
        <Geo kind="cylinder" args={[0.235, 0.235, 0.01, 40]} />
        <Flat id="cut" color={CUT_WOOD[pieceColor]} roughness={0.75} />
      </mesh>
      {[0.07, 0.13, 0.19].map((r) => (
        <mesh key={r} position={[0, 0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Geo kind="torus" args={[r, 0.005, 6, 40]} />
          <Bark pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      {/* splintered rim, like battlements */}
      {ringAngles(splinters).map((a, i) => (
        <mesh
          key={a}
          position={[Math.cos(a) * 0.2, 0.82 + (i % 2) * 0.03, Math.sin(a) * 0.2]}
          rotation={[Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]}
          castShadow
        >
          <Geo kind="cone" args={[0.06, 0.18 + (i % 2) * 0.06, 6]} />
          <Bark pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      <Front pieceColor={pieceColor}>
        {/* knot hole */}
        <mesh position={[0, 0.48, 0.235]} scale={[1, 1.4, 0.4]}>
          <Geo kind="sphere" args={[0.06, 16, 12]} />
          <Dark />
        </mesh>
        {/* mushroom on the side */}
        <group position={[0.17, 0.24, 0.19]} rotation={[0.25, 0, -0.3]}>
          <mesh position={[0, 0.04, 0]}>
            <Geo kind="cylinder" args={[0.022, 0.03, 0.08, 10]} />
            <Flat id="cut" color={CUT_WOOD[pieceColor]} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <Geo kind="sphere" args={[0.065, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.6} />
          </mesh>
        </group>
      </Front>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bishop — pine tree
// ---------------------------------------------------------------------------
function Bishop({ pieceColor, isSelected }: PartProps) {
  const tiers: [number, number, number][] = [
    // radius, height, centre y
    [0.31, 0.38, 0.5],
    [0.24, 0.33, 0.72],
    [0.16, 0.29, 0.93],
  ];
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Mound radius={0.31} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh position={[0, 0.24, 0]} castShadow>
        <Geo kind="cylinder" args={[0.06, 0.085, 0.24, 12]} />
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {tiers.map(([r, h, y]) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <Geo kind="cone" args={[r, h, 9]} />
          <Leaf pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      <mesh position={[0, 1.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <Geo kind="octahedron" args={[0.05, 0]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Knight — stag's head with leafy antlers (+x is forward before facing)
// ---------------------------------------------------------------------------
const NECK_BASE: ProfilePoint[] = [
  [0, MOUND_TOP - 0.02, 'sharp'],
  [0.22, MOUND_TOP - 0.02, 'sharp'],
  [0.2, 0.18],
  [0.17, 0.24, 'sharp'],
  [0, 0.24, 'sharp'],
];

const STAG_OUTLINE: [number, number][] = [
  [-0.15, 0.22],
  [-0.19, 0.36],
  [-0.17, 0.52],
  [-0.11, 0.66],
  [-0.06, 0.78],
  [0.0, 0.86],
  [0.07, 0.88],
  [0.14, 0.84],
  [0.24, 0.76],
  [0.33, 0.68],
  [0.36, 0.62],
  [0.33, 0.57],
  [0.24, 0.56],
  [0.13, 0.58],
  [0.06, 0.52],
  [0.03, 0.4],
  [0.06, 0.28],
  [0.12, 0.22],
];

const antler = (side: 1 | -1) => ({
  beam: tube(
    `forest-antler-beam-${side}`,
    [
      [0.0, 0.85, side * 0.05],
      [-0.06, 1.0, side * 0.11],
      [-0.11, 1.15, side * 0.16],
    ],
    0.024,
    0.5,
    20,
    8,
  ),
  tine1: tube(
    `forest-antler-t1-${side}`,
    [
      [-0.04, 0.96, side * 0.095],
      [0.03, 1.03, side * 0.11],
      [0.07, 1.08, side * 0.12],
    ],
    0.016,
    0.45,
    12,
    6,
  ),
  tine2: tube(
    `forest-antler-t2-${side}`,
    [
      [-0.08, 1.07, side * 0.14],
      [-0.02, 1.14, side * 0.15],
      [0.01, 1.19, side * 0.16],
    ],
    0.014,
    0.45,
    12,
    6,
  ),
});

function Knight({ pieceColor, isSelected }: PartProps) {
  const base = lathe('forest-neckbase', NECK_BASE);
  const head = extrude('forest-stag', STAG_OUTLINE, 0.15, 0.02);
  const facing = pieceColor === 'w' ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Mound radius={0.33} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={base} castShadow receiveShadow>
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <group rotation={[0, facing, 0]}>
        <mesh geometry={head} castShadow receiveShadow>
          <Bark pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        {([1, -1] as const).map((side) => {
          const a = antler(side);
          return (
            <group key={side}>
              <mesh geometry={a.beam} castShadow>
                <Bark pieceColor={pieceColor} isSelected={isSelected} />
              </mesh>
              <mesh geometry={a.tine1} castShadow>
                <Bark pieceColor={pieceColor} isSelected={isSelected} />
              </mesh>
              <mesh geometry={a.tine2} castShadow>
                <Bark pieceColor={pieceColor} isSelected={isSelected} />
              </mesh>
              {/* leaves sprouting from the tips */}
              {(
                [
                  [-0.11, 1.16, side * 0.16],
                  [0.07, 1.09, side * 0.12],
                  [0.01, 1.2, side * 0.16],
                ] as [number, number, number][]
              ).map((p) => (
                <mesh key={p.join()} position={p} scale={[1, 0.7, 1]} castShadow>
                  <Geo kind="sphere" args={[0.04, 10, 8]} />
                  <Leaf pieceColor={pieceColor} isSelected={isSelected} />
                </mesh>
              ))}
              {/* ear */}
              <mesh position={[-0.04, 0.86, side * 0.08]} rotation={[side * -0.9, 0, 0.5]} castShadow>
                <Geo kind="cone" args={[0.03, 0.1, 8]} />
                <Bark pieceColor={pieceColor} isSelected={isSelected} />
              </mesh>
              {/* eye */}
              <mesh position={[0.17, 0.77, side * 0.075]}>
                <Geo kind="sphere" args={[0.02, 10, 8]} />
                <Dark />
              </mesh>
            </group>
          );
        })}
        {/* nose */}
        <mesh position={[0.355, 0.625, 0]}>
          <Geo kind="sphere" args={[0.028, 10, 8]} />
          <Dark />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Queen — blossom tree with a coronet of flowers
// ---------------------------------------------------------------------------
const SLENDER_TRUNK: ProfilePoint[] = [
  [0, MOUND_TOP - 0.03, 'sharp'],
  [0.13, MOUND_TOP - 0.03, 'sharp'],
  [0.09, 0.25],
  [0.07, 0.45],
  [0.08, 0.62],
  [0, 0.64, 'sharp'],
];

const CANOPY_QUEEN: [number, number, number, number][] = [
  [0, 0.86, 0, 0.22],
  [0.16, 0.79, 0, 0.14],
  [-0.16, 0.79, 0, 0.14],
  [0, 0.79, 0.16, 0.14],
  [0, 0.79, -0.16, 0.14],
  [0, 1.0, 0, 0.14],
];

function Queen({ pieceColor, isSelected }: PartProps) {
  const trunk = lathe('forest-trunk-slender', SLENDER_TRUNK);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Mound radius={0.33} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={trunk} castShadow receiveShadow>
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {CANOPY_QUEEN.map(([x, y, z, r]) => (
        <mesh key={`${x}${y}${z}`} position={[x, y, z]} castShadow receiveShadow>
          <Geo kind="icosahedron" args={[r, 1]} />
          <Leaf pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      {/* coronet of blossoms */}
      {ringAngles(7).map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.1, 1.11, Math.sin(a) * 0.1]}>
          <Geo kind="sphere" args={[0.035, 10, 8]} />
          <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.18, 0]}>
        <Geo kind="sphere" args={[0.05, 12, 10]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* a few blossoms in the leaves */}
      {(
        [
          [0.18, 0.88, 0.1],
          [-0.12, 0.92, 0.15],
          [0.05, 0.75, -0.21],
        ] as [number, number, number][]
      ).map((p) => (
        <mesh key={p.join()} position={p}>
          <Geo kind="sphere" args={[0.028, 8, 6]} />
          <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// King — great oak with a golden cross
// ---------------------------------------------------------------------------
const OAK_TRUNK: ProfilePoint[] = [
  [0, MOUND_TOP - 0.03, 'sharp'],
  [0.19, MOUND_TOP - 0.03, 'sharp'],
  [0.13, 0.22],
  [0.105, 0.4],
  [0.1, 0.6],
  [0.12, 0.7],
  [0, 0.72, 'sharp'],
];

const CANOPY_KING: [number, number, number, number][] = [
  [0, 0.95, 0, 0.28],
  [0.21, 0.87, 0.04, 0.17],
  [-0.21, 0.87, -0.04, 0.17],
  [0.03, 0.88, 0.21, 0.17],
  [-0.03, 0.88, -0.21, 0.17],
  [0, 1.15, 0, 0.18],
];

function King({ pieceColor, isSelected }: PartProps) {
  const trunk = lathe('forest-trunk-oak', OAK_TRUNK);
  const branch = tube(
    'forest-oak-branch',
    [
      [0, 0.52, 0],
      [0.17, 0.66, 0],
      [0.24, 0.8, 0],
    ],
    0.04,
    0.5,
    16,
    8,
  );
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Mound radius={0.37} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={trunk} castShadow receiveShadow>
        <Bark pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {[0, Math.PI].map((a) => (
        <mesh key={a} geometry={branch} rotation={[0, a + 0.4, 0]} castShadow>
          <Bark pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      {CANOPY_KING.map(([x, y, z, r]) => (
        <mesh key={`${x}${y}${z}`} position={[x, y, z]} castShadow receiveShadow>
          <Geo kind="icosahedron" args={[r, 1]} />
          <Leaf pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      {/* golden cross */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <Geo kind="box" args={[0.045, 0.2, 0.045]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.8} />
      </mesh>
      <mesh position={[0, 1.43, 0]} castShadow>
        <Geo kind="box" args={[0.14, 0.045, 0.045]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.8} />
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

export function ChessPieceForest3D(props: PieceProps) {
  const { type, color, isSelected } = props;
  const Piece = PIECE_MAP[type];
  return (
    <AnimatedPiece {...props} hover={{ lift: 0.04, amp: 0.02, speed: 2.5 }} glowColor={ACCENT[color]}>
      <Piece pieceColor={color} isSelected={isSelected} />
    </AnimatedPiece>
  );
}
