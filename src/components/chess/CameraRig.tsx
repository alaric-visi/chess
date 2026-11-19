import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export type CameraView = 'angled' | 'top';

interface CameraRigProps {
  view: CameraView;
  /** Change this number to snap the camera back to the default for the current view. */
  resetToken: number;
}

/** Half the board's width including the frame, plus breathing room. */
const HALF_EXTENT = 4.4 + 0.45;
/** Angled view: how far above the horizon the camera sits. */
const ELEVATION = THREE.MathUtils.degToRad(52);

interface ControlsLike {
  target: THREE.Vector3;
  enableRotate: boolean;
  update: () => void;
}

/**
 * Places the camera so the whole board fits the viewport at any aspect ratio,
 * from a phone held upright to a wide monitor. Re-fits on resize, on view
 * change, and when asked to reset.
 */
export function CameraRig({ view, resetToken }: CameraRigProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!controls) return;
    const aspect = width / Math.max(1, height);
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);

    const target = new THREE.Vector3(0, 0, 0);
    let position: THREE.Vector3;

    if (view === 'top') {
      const d = HALF_EXTENT / Math.tan(Math.min(vHalf, hHalf));
      position = new THREE.Vector3(0, d, 0.001);
    } else {
      // Width must fit across the near half of the board, which sits closer
      // to the camera; depth is foreshortened by the viewing angle.
      const fitWidth = (HALF_EXTENT * 1.12) / Math.tan(hHalf) + HALF_EXTENT * Math.cos(ELEVATION);
      const fitDepth = (HALF_EXTENT * Math.sin(ELEVATION) + 0.6) / Math.tan(vHalf);
      const d = Math.max(fitWidth, fitDepth);
      position = new THREE.Vector3(0, d * Math.sin(ELEVATION), d * Math.cos(ELEVATION));
    }

    camera.position.copy(position);
    controls.target.copy(target);
    controls.enableRotate = view !== 'top';
    camera.lookAt(target);
    controls.update();
    invalidate();
  }, [camera, controls, width, height, view, resetToken, invalidate]);

  return null;
}
