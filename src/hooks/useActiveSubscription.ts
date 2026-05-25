import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePi } from "@/contexts/PiContext";

export type PlanType = "free" | "basic" | "premium" | "pro";

interface Subscription {
  id: string;
  profile_id: string;
  plan_type: string;
  billing_period: string;
  end_date: string;
  start_date: string;
  status: string;
  pi_amount: number;
  auto_renew: boolean;
}

interface ActiveSubscription {
  plan: PlanType;
  expiresAt: Date | null;
  status: string | null;
  loading: boolean;
  subscription: Subscription | null;
  isLoading: boolean;
  isActive: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysLeft: number | null;
  profileId: string | null;
  refetch: () => Promise<void>;
}

export const useActiveSubscription = (): ActiveSubscription => {
  const { piUser } = usePi();
  const [plan, setPlan] = useState<PlanType>("free");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      
      // Resolve profile by Pi username or Supabase user_id (email users)
      let profileQuery = supabase.from("profiles").select("id, username, has_premium");
      if (piUser?.username) {
        profileQuery = profileQuery.eq("username", piUser.username);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const supabaseUserId = sessionData?.session?.user?.id || null;
        if (!supabaseUserId) {
          setPlan("free");
          setExpiresAt(null);
          setStatus(null);
          setSubscription(null);
          setProfileId(null);
          setLoading(false);
          return;
        }
        profileQuery = profileQuery.eq("user_id", supabaseUserId);
      }

      const { data: profile } = await profileQuery.maybeSingle();

      if (!profile?.id) {
        setPlan("free");
        setLoading(false);
        return;
      }

      setProfileId(profile.id);

      // Check for active subscription in subscriptions table
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        const endDate = sub.end_date ? new Date(sub.end_date) : null;
        const now = new Date();
        const isExpired = endDate ? endDate < now : false;
        
        if (isExpired) {
          // Subscription expired - downgrade to free
          setPlan("free");
          setExpiresAt(endDate);
          setStatus("expired");
          setSubscription({
            ...sub,
            status: "expired"
          } as Subscription);
        } else {
          // Active subscription
          let normalizedPlan = (sub.plan_type || "free").toLowerCase();
          let normalizedStatus = (sub.status || "active").toLowerCase();
          
          // Map legacy/alternative plan names
          if (normalizedPlan === "unli" || normalizedPlan === "unlimited" || normalizedPlan === "lifetime") {
            normalizedPlan = "pro";
          }
          if (normalizedStatus === "paid" || normalizedStatus === "completed") {
            normalizedStatus = "active";
          }
          
          setPlan(normalizedPlan as PlanType);
          setExpiresAt(endDate);
          setStatus(normalizedStatus || "active");
          setSubscription(sub as Subscription);
        }
      } else {
        // No subscription record - free plan
        setPlan("free");
        setExpiresAt(null);
        setStatus(null);
        setSubscription(null);
      }
    } catch (e) {
      console.error("Failed to load subscription", e);
      setPlan("free");
    } finally {
      setLoading(false);
    }
  }, [piUser?.username]);

  useEffect(() => {
    if (!profileId) return;

    load();

    // Use a unique channel name to avoid "cannot add callbacks after subscribe" error
    // when the effect re-runs or when multiple components use this hook.
    const channelName = `subscription_changes_${profileId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `profile_id=eq.${profileId}`
        },
        (payload) => {
          console.log('[ActiveSubscription] Subscription changed, reloading...');
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, profileId]);

  // Calculate derived states
  const now = new Date();
  const isExpired = expiresAt ? expiresAt < now : false;
  const daysLeft = expiresAt 
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
  
  // isActive means user has a valid, non-expired paid plan
  const isActive = !isExpired && plan !== "free" && status === "active";

  return { 
    plan: isExpired ? "free" : plan, // Return effective plan (downgraded if expired)
    expiresAt, 
    status: isExpired ? "expired" : status, 
    loading, 
    subscription,
    isLoading: loading,
    isActive,
    isExpired,
    isExpiringSoon,
    daysLeft,
    profileId,
    refetch: load
  };
};
