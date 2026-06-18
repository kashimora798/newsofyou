/**
 * plants/Fern.tsx — Fern for question messages
 * plants/Bamboo.tsx — Bamboo for laugh messages  
 * Combined in one file for simplicity.
 */

// ─── Fern ─────────────────────────────────────────────────────────────────

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

interface PlantProps {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  onClick?: () => void;
}

export function Fern({ position, scale = 1, rotation = 0, lod = "full", isMobile = false, onClick }: PlantProps) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6 + rotation) * 0.04;
  });

  if (lod === "hidden") return null;

  const fronds = lod === "full" ? 5 : 3;
  const fernGreen = new THREE.Color("#4ea84c");

  return (
    <group ref={ref} position={position} scale={scale * 0.55} rotation={[0, rotation, 0]} onClick={onClick}>
      {Array.from({ length: fronds }).map((_, i) => {
        const angle = (i / fronds) * Math.PI * 2;
        const tilt = 0.4 + i * 0.1;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.15, 0.3, Math.sin(angle) * 0.15]}
            rotation={[tilt * Math.cos(angle), angle, tilt * Math.sin(angle)]}
          >
            <planeGeometry args={[0.12, 0.55, 1, 3]} />
            <meshLambertMaterial color={fernGreen} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Bamboo ───────────────────────────────────────────────────────────────

export function Bamboo({ position, scale = 1, rotation = 0, lod = "full", isMobile = false, onClick }: PlantProps) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    // Fast sway for laughing messages
    const t = state.clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 1.5 + rotation) * 0.05;
    ref.current.rotation.x = Math.cos(t * 1.2 + rotation) * 0.03;
  });

  if (lod === "hidden") return null;

  const canes = lod === "full" ? 3 : 2;

  return (
    <group ref={ref} position={position} scale={scale * 0.8} rotation={[0, rotation, 0]} onClick={onClick}>
      {Array.from({ length: canes }).map((_, i) => {
        const ox = (i - 1) * 0.2;
        const h = 2 + i * 0.4;
        return (
          <group key={i} position={[ox, 0, 0]}>
            {/* Cane segments */}
            {Array.from({ length: Math.ceil(h / 0.5) }).map((_, j) => (
              <mesh key={j} position={[0, j * 0.5 + 0.25, 0]}>
                <cylinderGeometry args={[0.04, 0.045, 0.44, 5]} />
                <meshLambertMaterial
                  color={new THREE.Color().setHSL(0.28, 0.6, 0.35 + j * 0.02)}
                />
              </mesh>
            ))}
            {/* Leaf tufts */}
            {lod === "full" && [h * 0.6, h * 0.8, h].map((ly, li) => (
              <mesh key={`l${li}`} position={[0.1, ly, 0]} rotation={[0, i, 0.3]}>
                <planeGeometry args={[0.3, 0.08]} />
                <meshLambertMaterial color="#5aad3a" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
