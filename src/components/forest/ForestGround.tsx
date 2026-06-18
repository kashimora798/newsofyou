/**
 * ForestGround.tsx
 * Simple tiled grass ground — no custom shaders needed.
 */
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface Props { isMobile: boolean; }

export default function ForestGround({ isMobile }: Props) {
  const tex = useTexture("/forest/grass.png");
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (!isMobile) tex.anisotropy = 8;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={!isMobile}>
      <planeGeometry args={[1200, 1200]} />
      <meshLambertMaterial map={tex} color="#9aba72" />
    </mesh>
  );
}
