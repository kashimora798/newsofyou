/**
 * ChunkManager.tsx
 * Tracks camera position (integer chunk coords only) and renders
 * ForestElement for each visible node, with per-element LOD.
 */

import { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { ForestNode } from "@/lib/forestParser";
import type { ChunkMap } from "@/lib/forestChunks";
import { getActiveNodes, getLOD } from "@/lib/forestChunks";
import ForestElement from "./ForestElement";

interface Props {
  chunkMap: ChunkMap;
  isMobile: boolean;
  onSelect: (node: ForestNode) => void;
}

export default function ChunkManager({ chunkMap, isMobile, onSelect }: Props) {
  const { camera } = useThree();
  // Track which integer chunk the camera is in
  const chunkRef = useRef({ cx: 999, cz: 999 });
  const [activeNodes, setActiveNodes] = useState<ForestNode[]>([]);

  useFrame(() => {
    const x = camera.position.x;
    const z = camera.position.z;
    const newCx = Math.floor(x / 24);
    const newCz = Math.floor(z / 24);
    // Only recompute when chunk changes (not every frame!)
    if (newCx !== chunkRef.current.cx || newCz !== chunkRef.current.cz) {
      chunkRef.current = { cx: newCx, cz: newCz };
      setActiveNodes(getActiveNodes(chunkMap, x, z, isMobile));
    }
  });

  // Initial load
  useEffect(() => {
    setActiveNodes(getActiveNodes(chunkMap, 0, 0, isMobile));
  }, [chunkMap, isMobile]);

  return (
    <>
      {activeNodes.map((node) => {
        const lod = getLOD(camera.position.x, camera.position.z, node);
        if (lod === "hidden") return null;
        return (
          <ForestElement
            key={node.id}
            node={node}
            lod={lod}
            isMobile={isMobile}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}
