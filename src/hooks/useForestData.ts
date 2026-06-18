/**
 * useForestData.ts
 * Fetches all messages, maps to ForestNode[], builds spatial chunk index.
 * Runs once on mount — the forest is a historical snapshot.
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseMessageToForestNode, type ForestNode } from "@/lib/forestParser";
import { buildChunkMap, type ChunkMap } from "@/lib/forestChunks";

const BATCH_SIZE = 200;

const FOREST_COLUMNS =
  "id, user_id, username, content, message_type, created_at";

export interface ForestData {
  nodes: ForestNode[];
  chunkMap: ChunkMap;
  totalMessages: number;
  loading: boolean;
  error: string | null;
}

export function useForestData(userId: string | undefined): ForestData {
  const [rawMessages, setRawMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      let all: any[] = [];
      let from = 0;
      let done = false;

      try {
        while (!done) {
          const { data, error: fetchErr } = await supabase
            .from("messages")
            .select(FOREST_COLUMNS)
            .order("created_at", { ascending: true })
            .range(from, from + BATCH_SIZE - 1);

          if (fetchErr) throw new Error(fetchErr.message);
          if (!data || data.length === 0) {
            done = true;
          } else {
            all = [...all, ...data];
            if (data.length < BATCH_SIZE) done = true;
            else from += BATCH_SIZE;
          }
        }
        setRawMessages(all);
      } catch (err: any) {
        setError(err.message ?? "Failed to load forest data");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [userId]);

  const nodes = useMemo<ForestNode[]>(() => {
    return rawMessages
      // Filter out empty messages (images already handled by message_type)
      .filter((m) => m.content || m.message_type !== "text")
      .map((m, i) => parseMessageToForestNode(m, i))
      .filter((n): n is ForestNode => n !== null);
  }, [rawMessages]);

  const chunkMap = useMemo<ChunkMap>(() => buildChunkMap(nodes), [nodes]);

  return {
    nodes,
    chunkMap,
    totalMessages: rawMessages.length,
    loading,
    error,
  };
}
