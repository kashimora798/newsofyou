/**
 * plants/Bush.tsx
 * Colorful berry bush for emoji-only messages.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

const BUSH_COLORS = ["#e85050", "#e89030", "#50c850", "#5080e8", "#c850c8", "#50c8c8"];

interface Props {
  position: [number, number, number];
  scale?: number;
  colorVariant?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  onClick?: () => void;
}

export default function Bush({ position, scale = 1, colorVariant = 0.5, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  const ref = useRef<THREE.Group>(null);
  const color = BUSH_COLORS[Math.floor(colorVariant * BUSH_COLORS.length)];
  const leafColor = new THREE.Color("#3a7a28");

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + rotation) * 0.02;
  });

  if (lod === "hidden") return null;

  const blobs = lod === "full"
    ? [[0, 0, 0], [-0.25, 0, 0.15], [0.2, 0, -0.1], [0.05, 0.2, 0.1]]
    : [[0, 0, 0], [0.2, 0, 0.1]];

  return (
    <group ref={ref} position={position} scale={scale * 0.65} rotation={[0, rotation, 0]} onClick={onClick}>
      {/* Leaf base blobs */}
      {blobs.map((b, i) => (
        <mesh key={i} position={[b[0], b[1] + 0.22, b[2]]} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.3 - i * 0.03, lod === "full" ? 6 : 4, 4]} />
          <meshLambertMaterial color={new THREE.Color(leafColor).offsetHSL(0, 0, i * 0.03)} />
        </mesh>
      ))}
      {/* Berries (full LOD only) */}
      {lod === "full" && [-0.15, 0.1, 0.2, -0.05].map((bx, i) => (
        <mesh key={`b${i}`} position={[bx, 0.35 + (i % 2) * 0.1, (i - 1.5) * 0.1]}>
          <sphereGeometry args={[0.04, 4, 4]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
