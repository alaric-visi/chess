import * as THREE from 'three';

/**
 * Shared geometries and materials for the piece sets.
 *
 * Every piece used to build its own copies in JSX, so 32 pieces meant
 * roughly 150 materials and 120 geometries. These caches hand out one
 * instance per distinct definition. They are attached with <primitive>,
 * which React Three Fiber never disposes, so unmounting one piece can't
 * break the others.
 */

const materials = new Map<string, THREE.Material>();

/** One material per key; `create` runs only the first time a key is seen. */
export const sharedMaterial = <T extends THREE.Material>(key: string, create: () => T): T => {
  let m = materials.get(key) as T | undefined;
  if (!m) {
    m = create();
    materials.set(key, m);
  }
  return m;
};

const GEOMETRY_CONSTRUCTORS = {
  box: THREE.BoxGeometry,
  capsule: THREE.CapsuleGeometry,
  circle: THREE.CircleGeometry,
  cone: THREE.ConeGeometry,
  cylinder: THREE.CylinderGeometry,
  dodecahedron: THREE.DodecahedronGeometry,
  icosahedron: THREE.IcosahedronGeometry,
  octahedron: THREE.OctahedronGeometry,
  plane: THREE.PlaneGeometry,
  ring: THREE.RingGeometry,
  sphere: THREE.SphereGeometry,
  tetrahedron: THREE.TetrahedronGeometry,
  torus: THREE.TorusGeometry,
} as const;

export type GeometryKind = keyof typeof GEOMETRY_CONSTRUCTORS;

const geometries = new Map<string, THREE.BufferGeometry>();

export const sharedGeometry = (
  kind: GeometryKind,
  args: readonly (number | boolean)[] = [],
): THREE.BufferGeometry => {
  const key = `${kind}:${args.join(',')}`;
  let g = geometries.get(key);
  if (!g) {
    const Ctor = GEOMETRY_CONSTRUCTORS[kind] as unknown as new (
      ...a: (number | boolean)[]
    ) => THREE.BufferGeometry;
    g = new Ctor(...args);
    geometries.set(key, g);
  }
  return g;
};

/** Counts, for tests and diagnostics. */
export const sharedResourceCounts = () => ({ materials: materials.size, geometries: geometries.size });
