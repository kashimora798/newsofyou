/**
 * trees/WillowTree.tsx
 * Drooping willow for "miss" messages. Long hanging branches.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

interface Props {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  onClick?: () => void;
}

export default function WillowTree({ position, scale = 1, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.25 + rotation) * 0.025;
  });

  if (lod === "hidden") return null;

  const trunkColor = new THREE.Color("#5c4033");
  const leafColor = new THREE.Color("#7aad6e");

  // Drape positions for hanging branches
  const drapes = lod === "full"
    ? [[-0.6, 0, 0.3], [0.5, 0, -0.4], [-0.3, 0, -0.6], [0.6, 0, 0.5], [0, 0, 0.7], [-0.7, 0, -0.1]]
    : [[-0.5, 0, 0.3], [0.5, 0, -0.4], [0, 0, 0.6]];

  return (
    <group ref={ref} position={position} scale={scale} rotation={[0, rotation, 0]} onClick={onClick}>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]} castShadow={!isMobile}>
        <cylinderGeometry args={[0.1, 0.2, 3, 6]} />
        <meshLambertMaterial color={trunkColor} />
      </mesh>
      {/* Crown */}
      <mesh position={[0, 3.2, 0]} scale={[1.4, 0.8, 1.4]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshLambertMaterial color={leafColor} />
      </mesh>
      {/* Drooping branches */}
      {drapes.map((d, i) => (
        <mesh
          key={i}
          position={[d[0], 2.5 - i * 0.1, d[2]]}
          rotation={[0.3 + i * 0.05, i * 0.8, 0.2 + i * 0.1]}
        >
          <cylinderGeometry args={[0.015, 0.025, 1.5 + i * 0.2, 3]} />
          <meshLambertMaterial color={new THREE.Color("#88c277")} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}
