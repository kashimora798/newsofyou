/**
 * plants/Sunflower.tsx
 * Bright sunflower cluster for happy/joyful messages. Billboard faces camera.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
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

function SingleSunflower({ offset, seedAngle }: { offset: [number, number, number]; seedAngle: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + seedAngle) * 0.06;
  });

  return (
    <group ref={ref} position={offset}>
      {/* Stem */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.8, 4]} />
        <meshLambertMaterial color="#4a7c35" />
      </mesh>
      {/* Disc (face) - billboard to always face camera */}
      <Billboard position={[0, 0.85, 0]}>
        {/* Yellow petals ring */}
        <mesh>
          <circleGeometry args={[0.22, 12]} />
          <meshLambertMaterial color="#f5c518" side={THREE.DoubleSide} />
        </mesh>
        {/* Brown center */}
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.1, 8]} />
          <meshLambertMaterial color="#5c3a1e" side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}

export default function Sunflower({ position, scale = 1, rotation = 0, lod = "full", isMobile = false, onClick }: Props) {
  if (lod === "hidden") return null;

  const count = lod === "full" ? (isMobile ? 2 : 3) : 1;
  const offsets: [number, number, number][] = [
    [0, 0, 0],
    [-0.3, 0, 0.2],
    [0.25, 0, -0.15],
  ].slice(0, count) as [number, number, number][];

  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]} onClick={onClick}>
      {offsets.map((off, i) => (
        <SingleSunflower key={i} offset={off} seedAngle={rotation + i * 1.2} />
      ))}
    </group>
  );
}
