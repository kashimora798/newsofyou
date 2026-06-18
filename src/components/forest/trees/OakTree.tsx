/**
 * trees/OakTree.tsx
 * A procedural oak-style tree using Three.js geometry.
 * No ez-tree dependency needed — fully procedural for reliability.
 * Mobile: no shadows, simpler geometry.
 */

import { useMemo, useRef } from "react";
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

// Shared geometry cache — created once per session
let _trunkGeo: THREE.CylinderGeometry | null = null;
let _canopyGeoFull: THREE.SphereGeometry | null = null;
let _canopyGeoMid: THREE.OctahedronGeometry | null = null;

function getTrunkGeo() {
  if (!_trunkGeo) _trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 2, 6, 1);
  return _trunkGeo;
}
function getCanopyFull() {
  if (!_canopyGeoFull) _canopyGeoFull = new THREE.SphereGeometry(1, 7, 5);
  return _canopyGeoFull;
}
function getCanopyMid() {
  if (!_canopyGeoMid) _canopyGeoMid = new THREE.OctahedronGeometry(1, 0);
  return _canopyGeoMid;
}

export default function OakTree({
  position,
  scale = 1,
  colorVariant = 0.5,
  rotation = 0,
  lod = "full",
  isMobile = false,
  onClick,
}: Props) {
  const meshRef = useRef<THREE.Group>(null);

  // Wind sway
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.z = Math.sin(t * 0.4 + rotation) * 0.015;
    meshRef.current.rotation.x = Math.cos(t * 0.3 + rotation) * 0.008;
  });

  // Green variation: deeper or lighter green
  const canopyColor = useMemo(() => {
    const hue = 0.27 + colorVariant * 0.08; // 97°–126° hue
    const sat = 0.55 + colorVariant * 0.25;
    const light = 0.28 + colorVariant * 0.15;
    return new THREE.Color().setHSL(hue, sat, light);
  }, [colorVariant]);

  const trunkColor = useMemo(
    () => new THREE.Color().setHSL(0.07, 0.4 + colorVariant * 0.2, 0.22 + colorVariant * 0.1),
    [colorVariant]
  );

  if (lod === "hidden") return null;

  const canopyGeo = lod === "full" ? getCanopyFull() : getCanopyMid();

  return (
    <group
      ref={meshRef}
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
      onClick={onClick}
    >
      {/* Trunk */}
      <mesh
        geometry={getTrunkGeo()}
        position={[0, 1, 0]}
        castShadow={!isMobile}
        receiveShadow={!isMobile}
      >
        <meshLambertMaterial color={trunkColor} />
      </mesh>
      {/* Main canopy */}
      <mesh
        geometry={canopyGeo}
        position={[0, 2.6, 0]}
        scale={[1.3, 1.1, 1.3]}
        castShadow={!isMobile}
      >
        <meshLambertMaterial color={canopyColor} />
      </mesh>
      {/* Secondary canopy blob (full LOD only) */}
      {lod === "full" && (
        <mesh
          geometry={canopyGeo}
          position={[0.5, 2.2, 0.3]}
          scale={[0.85, 0.8, 0.85]}
        >
          <meshLambertMaterial
            color={canopyColor}
            color-offsetHSL={[0, 0, -0.05]}
          />
        </mesh>
      )}
    </group>
  );
}
