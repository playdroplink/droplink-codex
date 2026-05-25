import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type NotificationItem = {
  id?: string;
  type: "follow" | "message" | "gift_card" | "subscription" | "purchase" | "generic";
  title: string;
  description?: string;
  created_at: string;
  data?: any;
};

/**
 * useNotifications subscribes to realtime table changes relevant to a user/profile
 * and emits toast notifications + returns a list/unread count for UI.
 */
export function useNotifications(options: {
  username?: string | null;
  profileId?: string | null;
  enableToasts?: boolean;
} = {}) {
  const { username, profileId, enableToasts = true } = options;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const channelRef = useRef<any>(null);

  // Helper to push a new notification
  const push = (item: NotificationItem) => {
    setItems(prev => {
      const next = [{ ...item }, ...prev].slice(0, 100);
      return next;
    });
    setUnread(u => u + 1);
    if (enableToasts) toast.info(item.title, { description: item.description });
  };

  // Start realtime subscription
  useEffect(() => {
    // Always clean up any prior channel
    if (channelRef.current) {
      try { channelRef.current.unsubscribe?.(); } catch {}
      channelRef.current = null;
    }

    // Safety: require a concrete profileId to scope realtime events.
    // Without a profileId filter, we'd receive EVERY insert from public tables,
    // causing false notifications on search/public pages.
    const pId = profileId || null;
    if (!pId) {
      // No subscription if we cannot safely scope by profile id
      return;
    }

    const ch = (supabase as any).channel(`notifications-${pId}-${Date.now()}`);

    // Followers: someone followed you
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "followers", filter: `following_profile_id=eq.${pId}` },
      (payload: any) => {
        push({
          type: "follow",
          title: "New follower",
          description: "Someone just followed you",
          created_at: new Date().toISOString(),
          data: payload.new,
        });
      }
    );

    // Messages: new incoming message (assuming receiver_profile_id)
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `receiver_profile_id=eq.${pId}` },
      (payload: any) => {
        push({
          type: "message",
          title: "New message",
          description: (payload.new?.content || "You received a message").slice(0, 120),
          created_at: new Date().toISOString(),
          data: payload.new,
        });
      }
    );

    // Subscriptions: your profile got a new subscriber (assuming profile_id)
    if (pId) {
      ch.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "subscriptions", filter: `profile_id=eq.${pId}` },
        (payload: any) => {
          push({
            type: "subscription",
            title: "New subscriber",
            description: `Plan: ${payload.new?.plan || "-"}`,
            created_at: new Date().toISOString(),
            data: payload.new,
          });
        }
      );
    }

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      try { ch.unsubscribe?.(); } catch {}
      channelRef.current = null;
    };
  }, [profileId, username, enableToasts]);

  const markAllRead = () => setUnread(0);
  const clear = () => { setItems([]); setUnread(0); };

  return {
    items,
    unread,
    markAllRead,
    clear,
  };
}
