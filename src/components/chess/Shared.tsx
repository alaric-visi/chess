import * as THREE from 'three';
import { GeometryKind, sharedGeometry, sharedMaterial } from './sharedResources';

/** Attaches a cached material to the parent mesh. */
export function SharedMaterial({ id, create }: { id: string; create: () => THREE.Material }) {
  return <primitive object={sharedMaterial(id, create)} attach="material" />;
}

/** Drop-in for <cylinderGeometry args={...} /> etc. that reuses one geometry per shape. */
export function Geo({ kind, args }: { kind: GeometryKind; args?: readonly (number | boolean)[] }) {
  return <primitive object={sharedGeometry(kind, args)} attach="geometry" />;
}
