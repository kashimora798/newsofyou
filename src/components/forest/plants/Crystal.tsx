/**
 * plants/Crystal.tsx
 * Crystal formation for image/media messages. Glassy, refractive look.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

interface Props {
  position: [number, number, number];
  scale?: number;
  colorVariant?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  onClick?: () => void;
}

const CRYSTAL_COLORS = [
  "#a8d8f0", "#d0a8f0", "#f0a8d8", "#a8f0d8", "#f0d8a8",
];

export default function Crystal({ position, scale = 1, colorVariant = 0.5, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.3 + rotation;
  });

  if (lod === "hidden") return null;

  const color = CRYSTAL_COLORS[Math.floor(colorVariant * CRYSTAL_COLORS.length)];
  const shards = lod === "full" ? 4 : 2;

  return (
    <group ref={ref} position={position} scale={scale * 0.6} onClick={onClick}>
      {Array.from({ length: shards }).map((_, i) => {
        const angle = (i / shards) * Math.PI * 2;
        const r = 0.15 + (i % 2) * 0.1;
        const h = 0.4 + (i % 3) * 0.3;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * r, h / 2, Math.sin(angle) * r]}
            rotation={[0.1 * i, angle, 0.05 * i]}
            castShadow={!isMobile}
          >
            <coneGeometry args={[0.1 - i * 0.01, h, 4]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={isMobile ? 0.75 : 0.65}
              metalness={isMobile ? 0.2 : 0.5}
              roughness={isMobile ? 0.5 : 0.1}
              envMapIntensity={isMobile ? 0.5 : 1.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}
