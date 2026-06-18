/**
 * ForestScenery.tsx
 * Procedural scenery to make the forest look lush, rich, and highly realistic.
 * Renders instanced grass with wind sway (vertex shader), instanced organic rocks,
 * and scatters various flower/plant components based on message count density.
 */

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Bush from "./plants/Bush";
import Wildflower from "./plants/Wildflower";
import { Fern } from "./plants/FernBamboo";
import Mushroom from "./plants/Mushroom";
import Crystal from "./plants/Crystal";
import Sunflower from "./plants/Sunflower";

interface Props {
  isMobile: boolean;
  totalMessages: number;
}

// ─── Instanced Grass Component ───────────────────────────────────────────────
function InstancedGrass({ isMobile, totalMessages }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshLambertMaterial>(null);

  // Scale grass count with message count (capping at 1.5x of base count)
  const count = useMemo(() => {
    const base = isMobile ? 1200 : 3500;
    const multiplier = Math.min(1.5, 0.4 + (totalMessages / 500) * 0.6);
    return Math.round(base * multiplier);
  }, [isMobile, totalMessages]);

  // Generate a cross-plane geometry for grass clump
  const grassGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Plane 1
      -0.12, 0, 0,
       0.12, 0, 0,
      -0.12, 0.65, 0,
       0.12, 0.65, 0,

      // Plane 2
      0, 0, -0.12,
      0, 0,  0.12,
      0, 0.65, -0.12,
      0, 0.65,  0.12,
    ]);

    const indices = new Uint16Array([
      0, 1, 2,
      2, 1, 3,
      4, 5, 6,
      6, 5, 7,
    ]);

    const uvs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,

      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);

    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Scatter positions
  const positions = useMemo(() => {
    const arr = [];
    const minR = 2.5; // outside trellis fence
    const maxR = 36;
    for (let i = 0; i < count; i++) {
      const r = minR + Math.sqrt(Math.random()) * (maxR - minR);
      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      arr.push([x, z]);
    }
    return arr;
  }, [count]);

  // Set matrices and color variations
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const [x, z] = positions[i];
      dummy.position.set(x, 0.01, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);

      // Scale height and width dynamically
      const hScale = 0.6 + Math.random() * 0.9;
      const wScale = 0.7 + Math.random() * 0.6;
      dummy.scale.set(wScale, hScale, wScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Beautiful forest-green gradient tones
      color.setHSL(0.24 + Math.random() * 0.08, 0.72, 0.22 + Math.random() * 0.22);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [positions, count]);

  // Sway in the wind via simple vertex shader injection
  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = `
        uniform float uTime;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        // Sway logic: only sway vertices higher than ground (Y > 0)
        // Add instance column 3 X/Z coordinates as phase shift
        float phase = instanceMatrix[3][0] * 0.15 + instanceMatrix[3][2] * 0.15;
        float sway = sin(uTime * 2.2 + phase) * 0.14 + cos(uTime * 1.3 + phase * 0.6) * 0.07;
        transformed.x += sway * position.y;
        transformed.z += sway * 0.4 * position.y;
        `
      );
      (mat as any).userData.shader = shader;
    };
  }, []);

  useFrame((state) => {
    const shader = (materialRef.current as any)?.userData?.shader;
    if (shader) {
      shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeometry, null as any, count]}
      castShadow={!isMobile}
      receiveShadow={!isMobile}
    >
      <meshLambertMaterial
        ref={materialRef}
        side={THREE.DoubleSide}
        transparent
        alphaTest={0.4}
        color="#a2cf6e"
      />
    </instancedMesh>
  );
}

// ─── Instanced Rocks Component ───────────────────────────────────────────────
function InstancedRocks({ isMobile }: { isMobile: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = isMobile ? 12 : 28;

  const rockGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.5, 1), []);

  const positions = useMemo(() => {
    const arr = [];
    const minR = 4.0;
    const maxR = 32;
    for (let i = 0; i < count; i++) {
      const r = minR + Math.random() * (maxR - minR);
      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      arr.push([x, z]);
    }
    return arr;
  }, [count]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const [x, z] = positions[i];
      // Place rock slightly embedded in ground
      dummy.position.set(x, -0.12 + Math.random() * 0.18, z);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI
      );

      // Random scale to make them look like distinct boulders
      const sX = 0.8 + Math.random() * 1.5;
      const sY = 0.4 + Math.random() * 0.9;
      const sZ = 0.8 + Math.random() * 1.5;
      dummy.scale.set(sX, sY, sZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Grey-brown organic stony shades
      const brightness = 0.16 + Math.random() * 0.15;
      color.setRGB(brightness, brightness * 0.96, brightness * 0.92);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [positions, count]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[rockGeometry, null as any, count]}
      castShadow={!isMobile}
      receiveShadow={!isMobile}
    >
      <meshStandardMaterial
        roughness={0.92}
        metalness={0.05}
        flatShading
      />
    </instancedMesh>
  );
}

// ─── Main Scenery Scatter ──────────────────────────────────────────────────
export default function ForestScenery({ isMobile, totalMessages }: Props) {
  // Generate plant positions on a jittered grid to avoid overlap and get a nice distribution
  const scatteredPlants = useMemo(() => {
    const list: Array<{
      id: number;
      type: "bush" | "wildflower" | "fern" | "mushroom" | "crystal" | "sunflower";
      position: [number, number, number];
      scale: number;
      rotation: number;
      colorVariant: number;
      lod: "full" | "low";
    }> = [];

    // Message density factor determines how populated the forest is
    const densityMultiplier = Math.min(1.5, 0.4 + (totalMessages / 500) * 0.6);
    const spawnChance = 0.48 * densityMultiplier;

    let idCounter = 0;
    const minR = 3.2;  // stay clear of tree & trellis fence
    const maxR = 32.0;

    // Grid size parameters
    const size = 32;
    const step = isMobile ? 5 : 3.8;

    for (let gx = -size; gx <= size; gx += step) {
      for (let gz = -size; gz <= size; gz += step) {
        // Calculate cell center
        const cx = gx;
        const cz = gz;
        const r = Math.sqrt(cx * cx + cz * cz);

        if (r < minR || r > maxR) continue;

        // Skip cell randomly based on spawn chance
        if (Math.random() > spawnChance) continue;

        // Apply jitter
        const x = cx + (Math.random() - 0.5) * (step * 0.6);
        const z = cz + (Math.random() - 0.5) * (step * 0.6);

        const posR = Math.sqrt(x * x + z * z);
        if (posR < minR || posR > maxR) continue;

        // Pick type based on weighted probability
        const rng = Math.random();
        let type: "bush" | "wildflower" | "fern" | "mushroom" | "crystal" | "sunflower";
        if (rng < 0.38) {
          type = "wildflower";
        } else if (rng < 0.60) {
          type = "bush";
        } else if (rng < 0.76) {
          type = "fern";
        } else if (rng < 0.90) {
          type = "mushroom";
        } else if (rng < 0.95) {
          type = "crystal";
        } else {
          type = "sunflower";
        }

        // Calculate LOD: elements far away or on mobile use "low"
        const lod = (posR > 16.0 || isMobile) ? "low" : "full";

        list.push({
          id: idCounter++,
          type,
          position: [x, 0, z],
          scale: 0.75 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          colorVariant: Math.random(),
          lod,
        });
      }
    }

    return list;
  }, [isMobile, totalMessages]);

  return (
    <group>
      {/* 3D Grass instances */}
      <InstancedGrass isMobile={isMobile} totalMessages={totalMessages} />

      {/* 3D Rock instances */}
      <InstancedRocks isMobile={isMobile} />

      {/* Scattered Flowers, Mushrooms, Crystals, Bushes, Ferns */}
      {scatteredPlants.map((plant) => {
        switch (plant.type) {
          case "bush":
            return (
              <Bush
                key={plant.id}
                position={plant.position}
                scale={plant.scale}
                rotation={plant.rotation}
                colorVariant={plant.colorVariant}
                lod={plant.lod}
                isMobile={isMobile}
              />
            );
          case "wildflower":
            return (
              <Wildflower
                key={plant.id}
                position={plant.position}
                scale={plant.scale}
                rotation={plant.rotation}
                colorVariant={plant.colorVariant}
                lod={plant.lod}
                isMobile={isMobile}
              />
            );
          case "fern":
            return (
              <Fern
                key={plant.id}
                position={plant.position}
                scale={plant.scale * 1.1}
                rotation={plant.rotation}
                lod={plant.lod}
                isMobile={isMobile}
              />
            );
          case "mushroom":
            return (
              <Mushroom
                key={plant.id}
                position={plant.position}
                scale={plant.scale * 0.9}
                rotation={plant.rotation}
                colorVariant={plant.colorVariant}
                lod={plant.lod}
                isMobile={isMobile}
              />
            );
          case "crystal":
            return (
              <Crystal
                key={plant.id}
                position={plant.position}
                scale={plant.scale * 0.8}
                rotation={plant.rotation}
                colorVariant={plant.colorVariant}
                lod={plant.lod}
                isMobile={isMobile}
              />
            );
          case "sunflower":
            return (
              <Sunflower
                key={plant.id}
                position={plant.position}
                scale={plant.scale * 0.9}
                rotation={plant.rotation}
                lod={plant.lod}
                isMobile={isMobile}
              />
            );
          default:
            return null;
        }
      })}
    </group>
  );
}
