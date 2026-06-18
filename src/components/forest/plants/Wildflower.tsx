/**
 * plants/Wildflower.tsx
 * Small wildflower for short messages.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

const COLORS = ["#e8607a", "#c86dd6", "#f0a030", "#60b8e8", "#e8e040", "#7ac87a"];

interface Props {
  position: [number, number, number];
  scale?: number;
  colorVariant?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  onClick?: () => void;
}

export default function Wildflower({ position, scale = 1, colorVariant = 0.5, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  const ref = useRef<THREE.Group>(null);
  const color = COLORS[Math.floor(colorVariant * COLORS.length)];

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.8 + rotation) * 0.08;
  });

  if (lod === "hidden") return null;

  return (
    <group ref={ref} position={position} scale={scale * 0.6} rotation={[0, rotation, 0]} onClick={onClick}>
      {/* Stem */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.5, 3]} />
        <meshLambertMaterial color="#3d7a28" />
      </mesh>
      {/* Flower head - billboard */}
      <Billboard position={[0, 0.52, 0]}>
        <mesh>
          <circleGeometry args={[0.13, 6]} />
          <meshLambertMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.05, 6]} />
          <meshLambertMaterial color="#f5e842" side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
      {/* A small leaf */}
      {lod === "full" && (
        <mesh position={[0.06, 0.2, 0]} rotation={[0, 0, 0.4]} scale={[1.0, 0.57, 1.0]}>
          <circleGeometry args={[0.07, 6]} />
          <meshLambertMaterial color="#4a9c33" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
