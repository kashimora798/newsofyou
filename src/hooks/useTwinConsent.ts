import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useTwinConsent — the consent state of the AI twin (build-plan §7.1).
 *
 * Rules the UI must respect:
 *   - the twin is OFF until she explicitly agrees (`twin_record_consent`);
 *   - either of them can switch it off at any time, and revoking purges what
 *     was derived about her;
 *   - the owner can never fabricate consent, only switch things off.
 */
export interface TwinConsent {
  loading: boolean;
  /** No config row yet (setup not done) — hide the section entirely. */
  configured: boolean;
  isOwner: boolean;
  isPartner: boolean;
  consentedAt: string | null;
  enabled: boolean;
  /** True when *this* account can press "I'm okay with this". */
  canGrant: boolean;
  grant: () => Promise<void>;
  revoke: () => Promise<void>;
  setEnabled: (on: boolean) => Promise<void>;
  error: string | null;
}

export function useTwinConsent(): TwinConsent {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error: err } = await (supabase as any)
      .from("twin_config")
      .select("owner_user_id, partner_user_id, partner_user_ids, partner_consented_at, twin_enabled")
      .eq("id", 1)
      .maybeSingle();

    if (err || !data) {
      setConfigured(false);
      setLoading(false);
      if (err) setError(err.message as string);
      return;
    }
    setConfigured(true);
    setOwnerId(data.owner_user_id);
    setPartnerIds(
      Array.from(new Set([data.partner_user_id, ...((data.partner_user_ids as string[] | null) ?? [])])).filter(Boolean),
    );
    setConsentedAt(data.partner_consented_at ?? null);
    setEnabled(Boolean(data.twin_enabled));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = Boolean(user && ownerId === user.id);
  const isPartner = Boolean(user && partnerIds.includes(user.id));
  const canGrant = isPartner && !isOwner;

  const call = async (fn: string, args?: Record<string, unknown>) => {
    setError(null);
    const { error: err } = await (supabase.rpc as any)(fn, args);
    if (err) {
      setError(err.message as string);
      throw err;
    }
    await load();
  };

  return {
    loading,
    configured,
    isOwner,
    isPartner,
    consentedAt,
    enabled,
    canGrant,
    error,
    grant: () => call("twin_record_consent"),
    revoke: () => call("twin_revoke_consent", { p_purge: true, p_purge_index: false }),
    setEnabled: (on: boolean) => call("twin_set_enabled", { p_enabled: on }),
  };
}
