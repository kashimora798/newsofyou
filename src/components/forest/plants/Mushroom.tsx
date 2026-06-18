/**
 * plants/Mushroom.tsx
 * Blue mushroom ring for "sorry" messages.
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

export default function Mushroom({ position, scale = 1, colorVariant = 0.5, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    // Gentle bob
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.6 + rotation) * 0.02;
  });

  if (lod === "hidden") return null;

  const capColor = new THREE.Color().setHSL(0.62 + colorVariant * 0.1, 0.7, 0.45);
  const stemColor = new THREE.Color("#e8e0d0");
  const count = lod === "full" ? 3 : 1;

  const ring: [number, number, number][] = [
    [0, 0, 0],
    [0.35, 0, 0.2],
    [-0.3, 0, 0.25],
  ];

  return (
    <group ref={ref} position={position} scale={scale * 0.7} rotation={[0, rotation, 0]} onClick={onClick}>
      {ring.slice(0, count).map((offset, i) => (
        <group key={i} position={offset} scale={0.8 + i * 0.1}>
          {/* Stem */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.4, 5]} />
            <meshLambertMaterial color={stemColor} />
          </mesh>
          {/* Cap */}
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.18, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color={capColor} />
          </mesh>
          {/* Glowing underside */}
          {lod === "full" && (
            <mesh position={[0, 0.38, 0]}>
              <cylinderGeometry args={[0.16, 0.08, 0.04, 6]} />
              <meshLambertMaterial color={new THREE.Color("#9090ff")} transparent opacity={0.6} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
