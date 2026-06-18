/**
 * trees/Redwood.tsx
 * Giant redwood for very long messages. Tallest element in the forest.
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

export default function Redwood({ position, scale = 1, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.2 + rotation) * 0.008;
  });

  if (lod === "hidden") return null;

  const trunkColor = new THREE.Color("#7c3f25");
  const foliageColor = new THREE.Color("#2d6e3e");

  return (
    <group ref={ref} position={position} scale={scale} rotation={[0, rotation, 0]} onClick={onClick}>
      {/* Tall trunk */}
      <mesh position={[0, 2.5, 0]} castShadow={!isMobile}>
        <cylinderGeometry args={[0.2, 0.35, 5, 7]} />
        <meshLambertMaterial color={trunkColor} />
      </mesh>
      {/* Upper trunk */}
      <mesh position={[0, 5.5, 0]} castShadow={!isMobile}>
        <cylinderGeometry args={[0.12, 0.2, 2, 6]} />
        <meshLambertMaterial color={trunkColor} />
      </mesh>
      {/* Layered canopy */}
      {[6.5, 5.5, 4.8].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} scale={[1.2 - i * 0.2, 0.9, 1.2 - i * 0.2]}>
          <coneGeometry args={[1.1 - i * 0.15, 1.5, lod === "full" ? 8 : 5]} />
          <meshLambertMaterial
            color={new THREE.Color().setHSL(0.35, 0.6, 0.22 + i * 0.04)}
          />
        </mesh>
      ))}
    </group>
  );
}
