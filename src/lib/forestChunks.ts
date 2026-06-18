/**
 * forestChunks.ts
 * Minecraft-style chunk system for the forest world.
 * Groups ForestNodes into 24×24 unit cells for frustum-based culling.
 */

import type { ForestNode } from "./forestParser";

export const CHUNK_SIZE = 24;     // world units per chunk side
export const RENDER_RADIUS = 3;   // chunks from camera in each direction
export const LOD_CLOSE = 30;      // full mesh distance
export const LOD_MID = 70;        // simplified mesh distance
export const MAX_MOBILE_ELEMENTS = 60;  // hard cap on mobile
export const MAX_DESKTOP_ELEMENTS = 180; // hard cap on desktop

export interface ChunkCoord { cx: number; cz: number }
export type ChunkMap = Map<string, ForestNode[]>;

// ─── Convert world position → chunk coord ─────────────────────────────────
export function posToChunk(x: number, z: number): ChunkCoord {
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

// ─── Chunk coord → string key ─────────────────────────────────────────────
export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

// ─── All visible chunks within radius from camera ──────────────────────────
export function getVisibleChunks(
  camX: number,
  camZ: number,
  radius: number = RENDER_RADIUS
): ChunkCoord[] {
  const { cx, cz } = posToChunk(camX, camZ);
  const visible: ChunkCoord[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      // Circular cull — skip corners
      if (dx * dx + dz * dz <= radius * radius + 1) {
        visible.push({ cx: cx + dx, cz: cz + dz });
      }
    }
  }
  return visible;
}

// ─── Build spatial index from all nodes ──────────────────────────────────
export function buildChunkMap(nodes: ForestNode[]): ChunkMap {
  const map: ChunkMap = new Map();
  for (const node of nodes) {
    const { cx, cz } = posToChunk(node.position[0], node.position[2]);
    const key = chunkKey(cx, cz);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(node);
  }
  return map;
}

// ─── Get active nodes given camera position ───────────────────────────────
export function getActiveNodes(
  chunkMap: ChunkMap,
  camX: number,
  camZ: number,
  isMobile: boolean,
  radius: number = RENDER_RADIUS
): ForestNode[] {
  const visible = getVisibleChunks(camX, camZ, radius);
  const all: ForestNode[] = [];
  for (const { cx, cz } of visible) {
    const nodes = chunkMap.get(chunkKey(cx, cz)) ?? [];
    all.push(...nodes);
  }
  // Sort by distance to camera (closest first) for priority rendering
  const sorted = all.sort((a, b) => {
    const da = (a.position[0] - camX) ** 2 + (a.position[2] - camZ) ** 2;
    const db = (b.position[0] - camX) ** 2 + (b.position[2] - camZ) ** 2;
    return da - db;
  });
  const cap = isMobile ? MAX_MOBILE_ELEMENTS : MAX_DESKTOP_ELEMENTS;
  return sorted.slice(0, cap);
}

// ─── LOD level for an element ──────────────────────────────────────────────
export type LODLevel = "full" | "mid" | "hidden";
export function getLOD(camX: number, camZ: number, node: ForestNode): LODLevel {
  const dx = node.position[0] - camX;
  const dz = node.position[2] - camZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > LOD_MID) return "hidden";
  if (dist > LOD_CLOSE) return "mid";
  return "full";
}
