/**
 * trees/PineTree.tsx
 * Dark pine tree for night-time messages, with optional firefly particles.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

interface Props {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  hasFireflies?: boolean;
  onClick?: () => void;
}

const FF_COUNT_DESKTOP = 20;
const FF_COUNT_MOBILE = 8;

function Fireflies({ isMobile }: { isMobile: boolean }) {
  const count = isMobile ? FF_COUNT_MOBILE : FF_COUNT_DESKTOP;
  const ref = useRef<THREE.Points>(null);
  const texture = useTexture("/forest/firefly.png");

  const [positions, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = 0.3 + Math.random() * 2.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [pos, ph];
  }, [count]);

  const posAttr = useMemo(() => new THREE.BufferAttribute(positions.slice(), 3), [positions]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const mat = ref.current.material as THREE.PointsMaterial;
    // Pulse opacity
    mat.opacity = 0.4 + Math.sin(t * 2) * 0.3;

    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += Math.sin(t * 0.5 + phases[i]) * 0.003;
      arr[i * 3 + 1] += Math.cos(t * 0.7 + phases[i] * 1.3) * 0.002;
      arr[i * 3 + 2] += Math.cos(t * 0.4 + phases[i] * 0.9) * 0.003;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" {...posAttr} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.15}
        transparent
        opacity={0.7}
        alphaTest={0.05}
        depthWrite={false}
        color="#c8ff80"
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function PineTree({
  position, scale = 1, rotation = 0, lod = "full", isMobile = false, hasFireflies = false, onClick,
}: Props) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.3 + rotation) * 0.01;
  });

  if (lod === "hidden") return null;

  const darkGreen = new THREE.Color("#1e4d2b");
  const trunkColor = new THREE.Color("#4a2f1a");

  // Stack of cones for pine shape
  const tiers = lod === "full"
    ? [
        { y: 3.2, r: 0.7, h: 1.4 },
        { y: 2.2, r: 1.0, h: 1.3 },
        { y: 1.2, r: 1.3, h: 1.2 },
      ]
    : [
        { y: 2.5, r: 0.8, h: 1.8 },
        { y: 1.0, r: 1.2, h: 1.5 },
      ];

  return (
    <group ref={ref} position={position} scale={scale} rotation={[0, rotation, 0]} onClick={onClick}>
      {/* Trunk */}
      <mesh position={[0, 0.75, 0]} castShadow={!isMobile}>
        <cylinderGeometry args={[0.1, 0.18, 1.5, 5]} />
        <meshLambertMaterial color={trunkColor} />
      </mesh>
      {/* Cone tiers */}
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]} castShadow={!isMobile}>
          <coneGeometry args={[t.r, t.h, lod === "full" ? 7 : 5]} />
          <meshLambertMaterial
            color={new THREE.Color().setHSL(0.36, 0.6, 0.15 + i * 0.03)}
          />
        </mesh>
      ))}
      {/* Fireflies */}
      {hasFireflies && lod === "full" && <Fireflies isMobile={isMobile} />}
    </group>
  );
}
