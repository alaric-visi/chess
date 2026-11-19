import * as THREE from 'three';
import { PieceSymbol, Color } from 'chess.js';
import { AnimatedPiece, PieceProps } from './AnimatedPiece';
import { Geo, SharedMaterial } from './Shared';
import { extrude, lathe, ProfilePoint, ringAngles, tube } from './pieceGeometry';

/**
 * Underwater chess set.
 *
 *   King   — spiral shell column wrapped in kelp, crowned with a trident
 *   Queen  — octopus wearing a crown of pearls
 *   Rook   — coral-topped turret with a lit porthole
 *   Bishop — tall spiral conch
 *   Knight — seahorse
 *   Pawn   — jellyfish
 *
 * White is iridescent pearl with pink coral and cyan bioluminescence; black is
 * deep navy with orange coral and violet glow. Fronts face +z for White.
 */

const SCALE = 0.85;
const PLINTH_TOP = 0.11;

type PartProps = { pieceColor: Color; isSelected: boolean };

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const SHELL = {
  w: {
    color: '#F3EEE6',
    roughness: 0.25,
    clearcoat: 0.8,
    iridescence: 0.7,
    iridescenceIOR: 1.35,
  },
  b: {
    color: '#22344D',
    roughness: 0.3,
    metalness: 0.15,
    clearcoat: 0.8,
    iridescence: 0.5,
    iridescenceIOR: 1.3,
  },
};
const CORAL = { w: '#F4A6B8', b: '#E8673A' };
const GLOW: Record<Color, string> = { w: '#7FF5FF', b: '#B98CFF' };
const JELLY = {
  w: { color: '#D9F6FF', opacity: 0.82 },
  b: { color: '#4A3A80', opacity: 0.88 },
};
const METAL = {
  // Slightly less than fully metallic so the gold stays bright from every angle.
  w: { color: '#F2D27A', metalness: 0.8, roughness: 0.35 },
  b: { color: '#C9D2DC', metalness: 1, roughness: 0.25 },
};

function Shell({ pieceColor, isSelected }: PartProps) {
  return (
    <SharedMaterial
      id={`sea-shell-${pieceColor}-${isSelected}`}
      create={() =>
        new THREE.MeshPhysicalMaterial({
          ...SHELL[pieceColor],
          emissive: GLOW[pieceColor],
          emissiveIntensity: isSelected ? 0.18 : 0,
        })
      }
    />
  );
}

function Coral({ pieceColor }: { pieceColor: Color }) {
  return (
    <SharedMaterial
      id={`sea-coral-${pieceColor}`}
      create={() => new THREE.MeshStandardMaterial({ color: CORAL[pieceColor], roughness: 0.7 })}
    />
  );
}

function Glow({ pieceColor, isSelected, intensity = 1.4 }: PartProps & { intensity?: number }) {
  const strength = isSelected ? intensity * 2 : intensity;
  return (
    <SharedMaterial
      id={`sea-glow-${pieceColor}-${strength}`}
      create={() =>
        new THREE.MeshStandardMaterial({
          color: GLOW[pieceColor],
          emissive: GLOW[pieceColor],
          emissiveIntensity: strength,
          toneMapped: false,
        })
      }
    />
  );
}

function Jelly({ pieceColor, isSelected }: PartProps) {
  return (
    <SharedMaterial
      id={`sea-jelly-${pieceColor}-${isSelected}`}
      create={() =>
        new THREE.MeshPhysicalMaterial({
          ...JELLY[pieceColor],
          transparent: true,
          roughness: 0.15,
          clearcoat: 1,
          emissive: GLOW[pieceColor],
          emissiveIntensity: isSelected ? 0.6 : 0.25,
        })
      }
    />
  );
}

function Metal({ pieceColor }: { pieceColor: Color }) {
  return (
    <SharedMaterial
      id={`sea-metal-${pieceColor}`}
      create={() => new THREE.MeshStandardMaterial(METAL[pieceColor])}
    />
  );
}

const Dark = () => (
  <SharedMaterial
    id="sea-dark"
    create={() => new THREE.MeshStandardMaterial({ color: '#061018', roughness: 0.4 })}
  />
);

/** Faces +z for White and -z for Black. */
const Front = ({ pieceColor, children }: { pieceColor: Color; children: React.ReactNode }) => (
  <group rotation={[0, pieceColor === 'w' ? 0 : Math.PI, 0]}>{children}</group>
);

// ---------------------------------------------------------------------------
// Scalloped shell plinth with a glowing rim
// ---------------------------------------------------------------------------
function Plinth({ radius, pieceColor, isSelected }: PartProps & { radius: number }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <Geo kind="cylinder" args={[radius - 0.025, radius, 0.1, 12]} />
        <Shell pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.102, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Geo kind="torus" args={[radius - 0.05, 0.01, 6, 48]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.9} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pawn — jellyfish
// ---------------------------------------------------------------------------
const BELL: ProfilePoint[] = [
  [0, 0.43, 'sharp'],
  [0.17, 0.43, 'sharp'],
  [0.185, 0.47],
  [0.165, 0.56],
  [0.1, 0.625],
  [0, 0.645, 'sharp'],
];

const tentacle = (a: number) =>
  tube(
    `sea-tentacle-${a.toFixed(3)}`,
    [
      [Math.cos(a) * 0.09, 0.44, Math.sin(a) * 0.09],
      [Math.cos(a + 0.35) * 0.13, 0.33, Math.sin(a + 0.35) * 0.13],
      [Math.cos(a - 0.2) * 0.11, 0.23, Math.sin(a - 0.2) * 0.11],
      [Math.cos(a + 0.2) * 0.15, PLINTH_TOP + 0.01, Math.sin(a + 0.2) * 0.15],
    ],
    0.018,
    0.45,
    20,
    6,
  );

function Pawn({ pieceColor, isSelected }: PartProps) {
  const bell = lathe('sea-bell', BELL);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.26} pieceColor={pieceColor} isSelected={isSelected} />
      {ringAngles(5, 0.3).map((a) => (
        <mesh key={a} geometry={tentacle(a)} castShadow>
          <Jelly pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      <mesh geometry={bell} castShadow receiveShadow>
        <Jelly pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh position={[0, 0.432, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Geo kind="torus" args={[0.17, 0.014, 6, 36]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={1} />
      </mesh>
      {/* glowing core */}
      <mesh position={[0, 0.51, 0]}>
        <Geo kind="sphere" args={[0.055, 14, 10]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rook — coral-topped turret
// ---------------------------------------------------------------------------
const TURRET: ProfilePoint[] = [
  [0, PLINTH_TOP - 0.01, 'sharp'],
  [0.28, PLINTH_TOP - 0.01, 'sharp'],
  [0.26, 0.2],
  [0.22, 0.35],
  [0.22, 0.68],
  [0.26, 0.72, 'sharp'],
  [0.26, 0.8, 'sharp'],
  [0.19, 0.8, 'sharp'],
  [0.19, 0.76, 'sharp'],
  [0, 0.76, 'sharp'],
];

function Rook({ pieceColor, isSelected }: PartProps) {
  const turret = lathe('sea-turret', TURRET);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.34} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={turret} castShadow receiveShadow>
        <Shell pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      {/* tube corals around the rim, like battlements */}
      {ringAngles(6).map((a, i) => {
        const h = 0.14 + (i % 3) * 0.03;
        return (
          <group key={a} position={[Math.cos(a) * 0.205, 0.8 + h / 2, Math.sin(a) * 0.205]}>
            <mesh castShadow>
              <Geo kind="cylinder" args={[0.05, 0.042, h, 10]} />
              <Coral pieceColor={pieceColor} />
            </mesh>
            <mesh position={[0, h / 2, 0]}>
              <Geo kind="cylinder" args={[0.032, 0.032, 0.01, 10]} />
              <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.8} />
            </mesh>
          </group>
        );
      })}
      {/* barnacles */}
      {(
        [
          [0.2, 0.3, 0.12],
          [-0.17, 0.5, 0.13],
          [-0.12, 0.25, -0.2],
        ] as [number, number, number][]
      ).map((p) => (
        <mesh key={p.join()} position={p} scale={[1, 0.7, 1]}>
          <Geo kind="sphere" args={[0.035, 10, 8]} />
          <Coral pieceColor={pieceColor} />
        </mesh>
      ))}
      {/* porthole with a lit window */}
      <Front pieceColor={pieceColor}>
        <mesh position={[0, 0.47, 0.222]}>
          <Geo kind="torus" args={[0.065, 0.016, 8, 28]} />
          <Metal pieceColor={pieceColor} />
        </mesh>
        <mesh position={[0, 0.47, 0.215]} rotation={[Math.PI / 2, 0, 0]}>
          <Geo kind="cylinder" args={[0.055, 0.055, 0.02, 24]} />
          <Glow pieceColor={pieceColor} isSelected={isSelected} intensity={0.7} />
        </mesh>
      </Front>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bishop — spiral conch
// ---------------------------------------------------------------------------
const CONCH: ProfilePoint[] = [
  [0, PLINTH_TOP - 0.01, 'sharp'],
  [0.22, PLINTH_TOP - 0.01, 'sharp'],
  [0.26, 0.18],
  [0.24, 0.3],
  [0.19, 0.45],
  [0.14, 0.62],
  [0.09, 0.8],
  [0.05, 0.95],
  [0.02, 1.05],
  [0, 1.08, 'sharp'],
];

/** Ridge spiralling up the conch, hugging its taper. */
const conchSpiral = () => {
  const turns = 4.5;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const y = 0.2 + t * 0.82;
    const r = 0.25 - t * 0.22 + 0.01;
    const a = t * turns * Math.PI * 2;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return tube('sea-conch-spiral', pts, 0.02, 0.4, 160, 6);
};

function Bishop({ pieceColor, isSelected }: PartProps) {
  const conch = lathe('sea-conch', CONCH);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.31} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={conch} castShadow receiveShadow>
        <Shell pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh geometry={conchSpiral()} castShadow>
        <Coral pieceColor={pieceColor} />
      </mesh>
      {/* flared lip of the opening */}
      <Front pieceColor={pieceColor}>
        <mesh position={[0, 0.3, 0.2]} scale={[0.7, 1.1, 0.35]} castShadow>
          <Geo kind="sphere" args={[0.14, 18, 14]} />
          <Coral pieceColor={pieceColor} />
        </mesh>
        <mesh position={[0, 0.3, 0.235]} scale={[0.45, 0.85, 0.2]}>
          <Geo kind="sphere" args={[0.14, 16, 12]} />
          <Dark />
        </mesh>
      </Front>
      <mesh position={[0, 1.1, 0]}>
        <Geo kind="sphere" args={[0.042, 14, 10]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Knight — seahorse (+x is forward before facing)
// ---------------------------------------------------------------------------
const SEAHORSE_SPINE: [number, number, number][] = [
  [-0.05, 0.15, 0], // tail tip, curled on the plinth
  [-0.13, 0.19, 0],
  [-0.13, 0.27, 0],
  [-0.06, 0.3, 0],
  [0.02, 0.36, 0],
  [0.07, 0.47, 0], // belly
  [0.06, 0.6, 0],
  [0.0, 0.72, 0],
  [-0.03, 0.82, 0], // neck
  [0.0, 0.9, 0],
];

/** Thin tail, swelling belly, narrower neck. */
const seahorseRadius = (t: number) => {
  if (t < 0.35) return 0.2 + (t / 0.35) * 0.5;
  if (t < 0.65) return 0.7 + Math.sin(((t - 0.35) / 0.3) * Math.PI) * 0.3;
  return 0.7 - ((t - 0.65) / 0.35) * 0.1;
};

const FIN_OUTLINE: [number, number][] = [
  [0, 0],
  [-0.09, 0.03],
  [-0.12, 0.1],
  [-0.09, 0.17],
  [0, 0.2],
];

function Knight({ pieceColor, isSelected }: PartProps) {
  const body = tube('sea-seahorse-body', SEAHORSE_SPINE, 0.1, seahorseRadius, 64, 14);
  const fin = extrude('sea-fin', FIN_OUTLINE, 0.014, 0.004);
  const facing = pieceColor === 'w' ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.32} pieceColor={pieceColor} isSelected={isSelected} />
      <group rotation={[0, facing, 0]}>
        <mesh geometry={body} castShadow receiveShadow>
          <Shell pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        {/* head and snout */}
        <mesh position={[0.04, 0.93, 0]} scale={[1.35, 1, 0.85]} castShadow>
          <Geo kind="sphere" args={[0.09, 20, 16]} />
          <Shell pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        <mesh position={[0.2, 0.89, 0]} rotation={[0, 0, -Math.PI / 2 - 0.25]} castShadow>
          <Geo kind="cylinder" args={[0.024, 0.034, 0.2, 12]} />
          <Shell pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
        <mesh position={[0.3, 0.865, 0]}>
          <Geo kind="sphere" args={[0.027, 10, 8]} />
          <Coral pieceColor={pieceColor} />
        </mesh>
        {/* coronet spikes */}
        {[-0.03, 0.02, 0.07].map((x, i) => (
          <mesh key={x} position={[x, 1.01 + (i === 1 ? 0.02 : 0), 0]} rotation={[0, 0, -0.3]} castShadow>
            <Geo kind="cone" args={[0.02, 0.08, 6]} />
            <Coral pieceColor={pieceColor} />
          </mesh>
        ))}
        {/* eyes */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.08, 0.95, s * 0.068]}>
            <Geo kind="sphere" args={[0.022, 10, 8]} />
            <Glow pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        ))}
        {/* dorsal fin on the back */}
        <mesh geometry={fin} position={[-0.04, 0.5, 0]} castShadow>
          <Coral pieceColor={pieceColor} />
        </mesh>
        {/* belly ridges */}
        {[0.42, 0.5, 0.58].map((y) => (
          <mesh key={y} position={[0.08 + (y === 0.5 ? 0.02 : 0), y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <Geo kind="torus" args={[0.06, 0.008, 6, 20, Math.PI]} />
            <Coral pieceColor={pieceColor} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Queen — octopus with a pearl crown
// ---------------------------------------------------------------------------
const MANTLE: ProfilePoint[] = [
  [0, 0.25, 'sharp'],
  [0.13, 0.27],
  [0.18, 0.45],
  [0.2, 0.68],
  [0.17, 0.88],
  [0.1, 1.02],
  [0, 1.06, 'sharp'],
];

const octopusArm = (a: number) => {
  const at = (r: number, y: number, twist = 0): [number, number, number] => [
    Math.cos(a + twist) * r,
    y,
    Math.sin(a + twist) * r,
  ];
  return tube(
    `sea-arm-${a.toFixed(3)}`,
    [at(0.1, 0.32), at(0.2, 0.2), at(0.3, PLINTH_TOP + 0.03, 0.1), at(0.36, 0.18, 0.25), at(0.3, 0.25, 0.4)],
    0.04,
    0.3,
    28,
    8,
  );
};

function Queen({ pieceColor, isSelected }: PartProps) {
  const mantle = lathe('sea-mantle', MANTLE);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.34} pieceColor={pieceColor} isSelected={isSelected} />
      {ringAngles(8, Math.PI / 8).map((a) => (
        <mesh key={a} geometry={octopusArm(a)} castShadow>
          <Shell pieceColor={pieceColor} isSelected={isSelected} />
        </mesh>
      ))}
      <mesh geometry={mantle} castShadow receiveShadow>
        <Shell pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <Front pieceColor={pieceColor}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.09, 0.47, 0.15]}>
            <Geo kind="sphere" args={[0.032, 12, 10]} />
            <Glow pieceColor={pieceColor} isSelected={isSelected} />
          </mesh>
        ))}
      </Front>
      {/* crown of pearls */}
      {ringAngles(7).map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.075, 1.08, Math.sin(a) * 0.075]}>
          <Geo kind="sphere" args={[0.03, 10, 8]} />
          <Metal pieceColor={pieceColor} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, 0]}>
        <Geo kind="sphere" args={[0.048, 14, 10]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// King — kelp-wrapped column with a trident
// ---------------------------------------------------------------------------
const COLUMN: ProfilePoint[] = [
  [0, PLINTH_TOP - 0.01, 'sharp'],
  [0.26, PLINTH_TOP - 0.01, 'sharp'],
  [0.22, 0.2],
  [0.16, 0.35],
  [0.13, 0.6],
  [0.14, 0.85],
  [0.18, 0.95, 'sharp'],
  [0.18, 1.0, 'sharp'],
  [0, 1.0, 'sharp'],
];

const kelp = () => {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = 0.2 + t * 0.72;
    // Follow the column's waist a little outside its surface.
    const r = 0.17 - Math.sin(t * Math.PI) * 0.03 + 0.012;
    const a = t * 2.5 * Math.PI * 2;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return tube('sea-kelp', pts, 0.022, 1, 120, 6);
};

function King({ pieceColor, isSelected }: PartProps) {
  const column = lathe('sea-column', COLUMN);
  return (
    <group scale={[SCALE, SCALE, SCALE]}>
      <Plinth radius={0.36} pieceColor={pieceColor} isSelected={isSelected} />
      <mesh geometry={column} castShadow receiveShadow>
        <Shell pieceColor={pieceColor} isSelected={isSelected} />
      </mesh>
      <mesh geometry={kelp()} castShadow>
        <Coral pieceColor={pieceColor} />
      </mesh>
      {/* trident */}
      <mesh position={[0, 1.11, 0]} castShadow>
        <Geo kind="cylinder" args={[0.022, 0.022, 0.22, 10]} />
        <Metal pieceColor={pieceColor} />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow>
        <Geo kind="box" args={[0.22, 0.035, 0.035]} />
        <Metal pieceColor={pieceColor} />
      </mesh>
      {(
        [
          [0, 0.2],
          [-0.095, 0.14],
          [0.095, 0.14],
        ] as [number, number][]
      ).map(([x, h]) => (
        <group key={x}>
          <mesh position={[x, 1.22 + h / 2, 0]} castShadow>
            <Geo kind="cylinder" args={[0.016, 0.016, h, 8]} />
            <Metal pieceColor={pieceColor} />
          </mesh>
          <mesh position={[x, 1.22 + h + 0.04, 0]} castShadow>
            <Geo kind="cone" args={[0.03, 0.08, 8]} />
            <Metal pieceColor={pieceColor} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.22, 0.025]}>
        <Geo kind="sphere" args={[0.028, 12, 10]} />
        <Glow pieceColor={pieceColor} isSelected={isSelected} />
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

export function ChessPieceUnderwater3D(props: PieceProps) {
  const { type, color, isSelected } = props;
  const Piece = PIECE_MAP[type];
  return (
    // A slower, deeper bob: things drift underwater.
    <AnimatedPiece {...props} hover={{ lift: 0.05, amp: 0.03, speed: 1.6 }} glowColor={GLOW[color]}>
      <Piece pieceColor={color} isSelected={isSelected} />
    </AnimatedPiece>
  );
}
