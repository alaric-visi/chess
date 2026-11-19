import { Environment, Lightformer } from '@react-three/drei';

/**
 * Studio lighting. The reflections come from a tiny environment map baked
 * once from a few virtual softboxes (Lightformers), so nothing is fetched
 * over the network and there is no wait before the board appears. The rim
 * light from behind outlines the pieces so light pieces stay readable on
 * light squares.
 */
export function SceneLighting() {
  return (
    <>
      <Environment resolution={256} frames={1}>
        {/* Overhead softbox */}
        <Lightformer
          form="rect"
          intensity={2.2}
          position={[0, 8, 0]}
          rotation-x={Math.PI / 2}
          scale={[12, 12, 1]}
        />
        {/* Side strips for long highlights down the pieces */}
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[-7, 3, 1]}
          rotation-y={Math.PI / 2}
          scale={[10, 2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.0}
          position={[7, 3, -1]}
          rotation-y={-Math.PI / 2}
          scale={[10, 2, 1]}
        />
        {/* Warm fill in front, cool kicker behind */}
        <Lightformer form="rect" color="#FFE2BF" intensity={0.8} position={[0, 2, 9]} scale={[10, 3, 1]} />
        <Lightformer form="ring" color="#BFD9FF" intensity={1.6} position={[0, 4, -9]} scale={3} />
      </Environment>

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-far={40}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      {/* Rim light from behind the board */}
      <directionalLight position={[-3, 6, -12]} intensity={0.9} color="#CFE0FF" />
    </>
  );
}
