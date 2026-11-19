import * as THREE from 'three';

/**
 * Cached geometry builders shared by the piece sets. Each shape is built once
 * per key and reused by every piece that needs it.
 */

/** [radius, height]; 'sharp' breaks the spline there for a crisp edge. */
export type ProfilePoint = [number, number] | [number, number, 'sharp'];

const cache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, build: () => THREE.BufferGeometry) => {
  let g = cache.get(key);
  if (!g) {
    g = build();
    cache.set(key, g);
  }
  return g;
};

export const smoothProfile = (pts: ProfilePoint[], samplesPerSegment = 4): THREE.Vector2[] => {
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

/** A turned (lathed) shape from a radius/height profile. */
export const lathe = (key: string, profile: ProfilePoint[], segments = 40) =>
  cached(`lathe:${key}`, () => {
    const g = new THREE.LatheGeometry(smoothProfile(profile), segments);
    g.computeVertexNormals();
    return g;
  });

/** A flat silhouette given thickness, centred on z. */
export const extrude = (key: string, outline: [number, number][], depth: number, bevel = 0.015) =>
  cached(`extrude:${key}`, () => {
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
    });
    g.translate(0, 0, -depth / 2 + bevel);
    g.computeVertexNormals();
    return g;
  });

/**
 * A tube along a smooth curve through `points`. `taper` is either a number
 * (the radius shrinks linearly to radius * taper at the far end: tentacles,
 * twigs) or a function of t in 0..1 giving the radius multiplier (a body that
 * swells and narrows).
 */
export const tube = (
  key: string,
  points: [number, number, number][],
  radius: number,
  taper: number | ((t: number) => number) = 1,
  tubularSegments = 40,
  radialSegments = 10,
) =>
  cached(`tube:${key}`, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    const scaleAt = typeof taper === 'function' ? taper : (t: number) => 1 + (taper - 1) * t;
    if (taper !== 1) {
      // Scale each ring of vertices towards the curve by how far along it is.
      const pos = g.attributes.position;
      const ring = radialSegments + 1;
      const v = new THREE.Vector3();
      for (let i = 0; i <= tubularSegments; i++) {
        const t = i / tubularSegments;
        const centre = curve.getPointAt(t);
        const k = scaleAt(t);
        for (let j = 0; j < ring; j++) {
          const idx = i * ring + j;
          v.fromBufferAttribute(pos, idx).sub(centre).multiplyScalar(k).add(centre);
          pos.setXYZ(idx, v.x, v.y, v.z);
        }
      }
      g.computeVertexNormals();
    }
    return g;
  });

/** Evenly spaced angles around a circle, handy for rings of parts. */
export const ringAngles = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => offset + (i / count) * Math.PI * 2);
