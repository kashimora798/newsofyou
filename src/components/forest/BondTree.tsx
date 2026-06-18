/**
 * BondTree.tsx
 * Central "Bond Tree" — grows with message count.
 * Uses ez-tree with minimal stable options.
 * Petals use THREE.Points primitive (avoids BufferAttribute resize crash).
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Tree, TreeType, BarkType, LeafType } from "@dgreenheck/ez-tree";

// ─── Growth Stages ─────────────────────────────────────────────────────────
export interface GrowthStage {
  label: string;
  description: string;
  scale: number;
  leafCount: number;
  branchLevels: number;
  leafTint: number;
}

export function getGrowthStage(totalMessages: number): GrowthStage {
  if (totalMessages < 50)
    return { label: "Sapling",         description: "Just a tiny seedling — your story is just beginning.", scale: 0.28, leafCount: 20,  branchLevels: 2, leafTint: 0xff6060 };
  if (totalMessages < 200)
    return { label: "Young Tree",      description: "A young tree reaching for the sky.",                   scale: 0.55, leafCount: 36,  branchLevels: 2, leafTint: 0xff4040 };
  if (totalMessages < 500)
    return { label: "Flourishing",     description: "Roots deep, branches wide — a love growing strong.",  scale: 0.90, leafCount: 60,  branchLevels: 3, leafTint: 0xff2020 };
  if (totalMessages < 1000)
    return { label: "Majestic",        description: "A majestic tree that has weathered every season.",    scale: 1.30, leafCount: 80,  branchLevels: 3, leafTint: 0xff1010 };
  return   { label: "Ancient & Eternal", description: "An ancient tree — your bond is legend.",           scale: 1.80, leafCount: 120, branchLevels: 3, leafTint: 0xff0010 };
}

// ─── Falling Petals (using THREE.Points primitive) ─────────────────────────
function FallingPetals({ isMobile, radius }: { isMobile: boolean; radius: number }) {
  const count   = isMobile ? 20 : 60;
  const petalRef = useRef<THREE.Points | null>(null);

  // Build the Points object once
  const pointsObj = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle    = Math.random() * Math.PI * 2;
      const r        = Math.random() * radius;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = 3 + Math.random() * 12;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      size: isMobile ? 0.18 : 0.28,
      color: new THREE.Color("#ffb7c5"),
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      sizeAttenuation: true,
    });

    return new THREE.Points(geo, mat);
  }, [count, radius, isMobile]);

  // Store per-petal velocity & phase alongside the object
  const meta = useMemo(() => {
    const vel = new Float32Array(count * 3);
    const ph  = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      vel[i * 3]     = (Math.random() - 0.5) * 0.012;
      vel[i * 3 + 1] = -(0.008 + Math.random() * 0.010);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.012;
      ph[i]          = Math.random() * Math.PI * 2;
    }
    return { vel, ph };
  }, [count]);

  useFrame((state) => {
    const pts = petalRef.current;
    if (!pts) return;
    const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr  = attr.array as Float32Array;
    const t    = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      arr[i * 3]     += meta.vel[i * 3]     + Math.sin(t * 0.7 + meta.ph[i]) * 0.004;
      arr[i * 3 + 1] += meta.vel[i * 3 + 1];
      arr[i * 3 + 2] += meta.vel[i * 3 + 2] + Math.cos(t * 0.5 + meta.ph[i]) * 0.003;
      if (arr[i * 3 + 1] < 0) {
        const angle    = Math.random() * Math.PI * 2;
        const r        = Math.random() * radius;
        arr[i * 3]     = Math.cos(angle) * r;
        arr[i * 3 + 1] = 8 + Math.random() * 10;
        arr[i * 3 + 2] = Math.sin(angle) * r;
      }
    }
    attr.needsUpdate = true;
  });

  return <primitive ref={petalRef} object={pointsObj} />;
}

// ─── Trellis Fence ──────────────────────────────────────────────────────────
function TrellisFence({ hw }: { hw: number }) {
  const mat = <meshLambertMaterial color={new THREE.Color(0x8b5e3c)} />;
  const postGeo = new THREE.BoxGeometry(0.07, 1.3, 0.07);
  const railGeo  = new THREE.BoxGeometry(hw * 2, 0.06, 0.06);
  const sides = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

  return (
    <group>
      {sides.map((ry, si) => (
        <group key={si} rotation={[0, ry, 0]}>
          {/* Two horizontal rails */}
          {[0.4, 0.8].map((railY) => (
            <mesh key={railY} position={[0, railY, hw]} geometry={railGeo}>{mat}</mesh>
          ))}
          {/* Five vertical posts */}
          {[-hw, -hw / 2, 0, hw / 2, hw].map((px, pi) => (
            <mesh key={pi} position={[px, 0.65, hw]} geometry={postGeo}>{mat}</mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Bond Tree ──────────────────────────────────────────────────────────────
interface Props {
  totalMessages: number;
  isMobile?: boolean;
}

export default function BondTree({ totalMessages, isMobile = false }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const stage    = useMemo(() => getGrowthStage(totalMessages), [totalMessages]);

  // Gentle wind sway
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(t * 0.3) * 0.008;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.004;
  });

  const ezTree = useMemo(() => {
    const t = new Tree();
    t.options.seed  = 65536;
    t.options.type  = TreeType.Evergreen;

    // Bark — NO texture (avoids missing texture errors)
    t.options.bark.type      = BarkType.Willow;
    t.options.bark.tint      = 0xc87840;
    t.options.bark.textured  = false;
    t.options.bark.flatShading = false;

    // Branches
    t.options.branch.levels      = isMobile ? 2 : stage.branchLevels;
    t.options.branch.children[0] = isMobile ? 8 : 16;
    t.options.branch.children[1] = 2;
    t.options.branch.children[2] = 3;
    t.options.branch.angle[1]    = 61;
    t.options.branch.angle[2]    = 61;
    t.options.branch.length[0]   = 55;
    t.options.branch.length[1]   = 38;
    t.options.branch.length[2]   = 12;
    t.options.branch.radius[0]   = 1.9;
    t.options.branch.radius[1]   = 0.6;
    t.options.branch.radius[2]   = 1.3;
    t.options.branch.taper[0]    = 0.2;
    t.options.branch.taper[1]    = 0.2;
    t.options.branch.taper[2]    = 0.3;
    t.options.branch.start[1]    = 0.32;
    t.options.branch.start[2]    = 0.34;

    // Leaves
    t.options.leaves.type         = LeafType.Aspen;
    t.options.leaves.tint         = stage.leafTint;
    t.options.leaves.count        = isMobile ? Math.round(stage.leafCount * 0.5) : stage.leafCount;
    t.options.leaves.size         = 4.2;
    t.options.leaves.sizeVariance = 0.42;
    t.options.leaves.start        = 0.93;
    t.options.leaves.alphaTest    = 0.65;
    t.options.leaves.angle        = 51;

    t.generate();
    t.castShadow    = true;
    t.receiveShadow = true;
    return t;
  }, [totalMessages, isMobile, stage]);

  const worldScale = stage.scale * 0.12;
  const fenceHW    = Math.max(2.5, stage.scale * 2.5);

  return (
    <group ref={groupRef}>
      <primitive object={ezTree} scale={worldScale} />
      <TrellisFence hw={fenceHW} />
      <FallingPetals isMobile={isMobile} radius={stage.scale * 4} />
    </group>
  );
}
