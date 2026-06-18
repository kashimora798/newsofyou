import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ProposalType =
  | "time_limit"
  | "reminder"
  | "no_phone"
  | "challenge"
  | "date"
  | "goodnight";

export type ProposalStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "active"
  | "completed"
  | "expired";

export interface Proposal {
  id: string;
  proposer_id: string;
  partner_id: string;
  type: ProposalType;
  title: string;
  payload: Record<string, any>;
  status: ProposalStatus;
  proposer_accepted: boolean;
  partner_accepted: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/**
 * Mutual-consent "pacts": one partner proposes, the other accepts, and the
 * proposal only becomes `active` when both have accepted (enforced by a DB
 * trigger). On activation we apply side effects (shared reminder, calendar
 * event, focus status) using the existing per-table RLS inserts.
 */
export function useProposals(partnerId: string | undefined) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("proposals")
      .select("*")
      .or(`proposer_id.eq.${user.id},partner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (data) setProposals(data as Proposal[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("proposals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "proposals" }, () => fetchProposals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchProposals]);

  // Create a new proposal addressed to the partner.
  const propose = useCallback(
    async (type: ProposalType, title: string, payload: Record<string, any> = {}) => {
      if (!user || !partnerId) return { error: new Error("No partner") };
      const { error } = await (supabase as any).from("proposals").insert({
        proposer_id: user.id,
        partner_id: partnerId,
        type,
        title,
        payload,
        proposer_accepted: true,
        partner_accepted: false,
        status: "pending",
      });
      return { error };
    },
    [user, partnerId],
  );

  // Apply the real-world side effects once a proposal becomes active.
  const applyEffects = useCallback(
    async (p: Proposal) => {
      if (!user) return;
      try {
        if (p.type === "reminder" && p.payload?.remind_at) {
          // One reminder row for each partner.
          await (supabase as any).from("reminders").insert([
            { user_id: p.proposer_id, target_user_id: p.proposer_id, title: p.title, remind_at: p.payload.remind_at },
            { user_id: p.partner_id, target_user_id: p.partner_id, title: p.title, remind_at: p.payload.remind_at },
          ]);
        } else if (p.type === "date" && p.payload?.event_date) {
          await (supabase as any).from("shared_events").insert({
            user_id: user.id,
            title: p.title,
            event_date: p.payload.event_date,
            emoji: "💞",
          });
        } else if (p.type === "no_phone" || p.type === "goodnight") {
          const state = p.type === "goodnight" ? "sleeping" : "focus";
          await (supabase as any)
            .from("user_status")
            .update({ activity_state: state })
            .eq("user_id", user.id);
        }
      } catch {
        // Effects are best-effort; the proposal itself is already active.
      }
    },
    [user],
  );

  // The partner accepts. Returns the updated row so callers can react.
  const accept = useCallback(
    async (id: string) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("proposals")
        .update({ partner_accepted: true, status: "accepted" })
        .eq("id", id)
        .eq("partner_id", user.id)
        .select()
        .maybeSingle();
      if (data && (data as Proposal).status === "active") {
        await applyEffects(data as Proposal);
      }
      fetchProposals();
    },
    [user, applyEffects, fetchProposals],
  );

  const decline = useCallback(
    async (id: string) => {
      await (supabase as any).from("proposals").update({ status: "declined" }).eq("id", id);
      fetchProposals();
    },
    [fetchProposals],
  );

  const complete = useCallback(
    async (id: string) => {
      await (supabase as any).from("proposals").update({ status: "completed" }).eq("id", id);
      fetchProposals();
    },
    [fetchProposals],
  );

  // Incoming proposals awaiting THIS user's acceptance.
  const incomingPending = proposals.filter(
    (p) => p.partner_id === user?.id && p.status === "pending",
  );

  // The currently-active pact, if any (most recent).
  const active = proposals.find((p) => p.status === "active") ?? null;

  return { proposals, loading, propose, accept, decline, complete, incomingPending, active, refetch: fetchProposals };
}
