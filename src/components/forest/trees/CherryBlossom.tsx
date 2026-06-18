/**
 * trees/CherryBlossom.tsx
 * Pink cherry blossom tree for "love" messages.
 * Features falling petal particles.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Tree, BarkType, LeafType, TreeType } from "@dgreenheck/ez-tree";
import * as THREE from "three";
import type { LODLevel } from "@/lib/forestChunks";

interface Props {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  lod?: LODLevel;
  isMobile?: boolean;
  hasPetals?: boolean;
  onClick?: () => void;
}

const PETAL_COUNT_DESKTOP = 40;
const PETAL_COUNT_MOBILE = 15;

function PetalParticles({ isMobile }: { isMobile: boolean }) {
  const count = isMobile ? PETAL_COUNT_MOBILE : PETAL_COUNT_DESKTOP;
  const ref = useRef<THREE.Points>(null);
  const texture = useTexture("/forest/petal.png");

  const [positions, velocities, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = -0.005 - Math.random() * 0.008;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [pos, vel, ph];
  }, [count]);

  const posAttr = useMemo(() => new THREE.BufferAttribute(positions.slice(), 3), [positions]);

  useFrame((state) => {
    if (!ref.current) return;
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3] + Math.sin(t + phases[i]) * 0.002;
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2];
      // Reset petal when it falls below ground
      if (arr[i * 3 + 1] < -0.5) {
        arr[i * 3] = (Math.random() - 0.5) * 4;
        arr[i * 3 + 1] = 3.5 + Math.random();
        arr[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
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
        size={0.12}
        transparent
        alphaTest={0.1}
        depthWrite={false}
        color="#ffb7c5"
      />
    </points>
  );
}

export default function CherryBlossom({
  position, scale = 1, rotation = 0, lod = "full", isMobile = false, hasPetals = true, onClick
}: Props) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(t * 0.35 + rotation) * 0.012;
  });

  if (lod === "hidden") return null;

  const ezTree = useMemo(() => {
    const t = new Tree();
    t.options.seed = Math.abs(Math.round(position[0] * 100 + position[2] * 100));
    t.options.type = TreeType.Deciduous;
    t.options.bark.type = BarkType.Oak;
    t.options.leaves.type = LeafType.Oak; 
    t.options.leaves.tint = 0xffb7c5; // pink cherry blossom
    
    // Performance optimization based on platform
    t.options.branch.levels = isMobile ? 2 : 3;
    t.options.leaves.count = isMobile ? 60 : 150;
    
    t.generate();
    return t;
  }, [position, isMobile]);

  return (
    <group ref={groupRef} position={position} scale={scale * 0.12} rotation={[0, rotation, 0]} onClick={onClick}>
      <primitive object={ezTree} />
      {/* Petals */}
      {hasPetals && lod === "full" && <PetalParticles isMobile={isMobile} />}
    </group>
  );
}
