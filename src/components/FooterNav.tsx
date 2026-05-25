import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Mail, Search, Users, Menu, Store, BarChart3, TrendingUp, Bot, Globe, CreditCard, Wallet as WalletIcon, Crown, Info, LogOut, User, Download, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePi } from '@/contexts/PiContext';
import { toast } from 'sonner';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type InboxMessageRow = {
  id: string;
  sender_profile_id: string | null;
  receiver_profile_id: string | null;
  content: string;
  created_at: string;
};

export const FooterNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { piUser, isAuthenticated } = usePi();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [showFooter, setShowFooter] = useState(true);
  const lastScrollYRef = useRef(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [followerBadge, setFollowerBadge] = useState(0);
  const [showInboxPreview, setShowInboxPreview] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversations, setConversations] = useState<Array<{
    otherUserId: string;
    username: string;
    logo?: string | null;
    lastMessage: string;
    createdAt: string;
  }>>([]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let followerChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadUnreadCount = async (profileId: string) => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_profile_id', profileId)
        .eq('is_read', false)
        .is('group_id', null);
      if (error) return;
      setUnreadCount(count || 0);
    };

    const loadFollowerCount = async (profileId: string) => {
      const { count } = await supabase
        .from('followers' as any)
        .select('id', { count: 'exact', head: true })
        .eq('following_profile_id', profileId);
      const total = count || 0;
      const storageKey = `followers_seen_count_${profileId}`;
      const lastSeen = Number(localStorage.getItem(storageKey) || '0');
      if (!lastSeen) {
        localStorage.setItem(storageKey, String(total));
        setFollowerBadge(0);
        return;
      }
      const delta = Math.max(total - lastSeen, 0);
      setFollowerBadge(delta);
    };

    const resolveProfileId = async (): Promise<string | null> => {
      if (isAuthenticated && piUser?.username) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', piUser.username)
          .maybeSingle();
        return data?.id || null;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.id || null;
    };

    const init = async () => {
      const resolvedId = await resolveProfileId();
      setProfileId(resolvedId);
      if (!resolvedId) {
        setUnreadCount(0);
        setFollowerBadge(0);
        return;
      }
      await loadUnreadCount(resolvedId);
      await loadFollowerCount(resolvedId);
      channel = supabase
        .channel(`footer-inbox-${resolvedId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_profile_id=eq.${resolvedId}` },
          () => {
            loadUnreadCount(resolvedId);
            toast.success('New message received');
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_profile_id=eq.${resolvedId}` },
          () => loadUnreadCount(resolvedId)
        )
        .subscribe();

      followerChannel = supabase
        .channel(`footer-followers-${resolvedId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'followers', filter: `following_profile_id=eq.${resolvedId}` },
          () => {
            loadFollowerCount(resolvedId);
            toast.success('New follower!');
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (followerChannel) supabase.removeChannel(followerChannel);
    };
  }, [isAuthenticated, piUser]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      const lastScrollY = lastScrollYRef.current;

      if (currentScrollY < 50) {
        setShowFooter(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowFooter(false);
      } else if (currentScrollY < lastScrollY) {
        setShowFooter(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const loadConversations = async () => {
    if (!profileId) return;
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_profile_id, receiver_profile_id, content, created_at')
        .or(`sender_profile_id.eq.${profileId},receiver_profile_id.eq.${profileId}`)
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as InboxMessageRow[];
      const map = new Map<string, { otherUserId: string; lastMessage: string; createdAt: string }>();
      for (const msg of rows) {
        const otherUserId =
          msg.sender_profile_id === profileId ? msg.receiver_profile_id : msg.sender_profile_id;
        if (!otherUserId || map.has(otherUserId)) continue;
        map.set(otherUserId, {
          otherUserId,
          lastMessage: msg.content || 'Sent an image',
          createdAt: msg.created_at,
        });
      }
      const ids = Array.from(map.keys());
      if (ids.length === 0) {
        setConversations([]);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, logo')
        .in('id', ids);
      const profileMap = new Map<string, { username: string; logo?: string | null }>();
      (profiles || []).forEach((p) =>
        profileMap.set(p.id, { username: p.username, logo: p.logo }),
      );
      const list = Array.from(map.values()).map((item) => ({
        otherUserId: item.otherUserId,
        username: profileMap.get(item.otherUserId)?.username || 'Anonymous',
        logo: profileMap.get(item.otherUserId)?.logo || null,
        lastMessage: item.lastMessage,
        createdAt: item.createdAt,
      }));
      setConversations(list);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleInboxClick = () => {
    if (location.pathname.startsWith('/inbox')) {
      navigate('/inbox');
      return;
    }
    setShowInboxPreview(true);
    loadConversations();
  };

  const handleFollowersClick = () => {
    if (profileId) {
      const storageKey = `followers_seen_count_${profileId}`;
      const current = Number(localStorage.getItem(storageKey) || '0') + followerBadge;
      localStorage.setItem(storageKey, String(current));
      setFollowerBadge(0);
    }
    navigate('/followers');
  };

  return (
    <nav
      className={`fixed left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-sky-200/60 dark:border-sky-800/60 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] z-50 transition-all duration-500 ease-in-out ${showFooter ? 'bottom-0 translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2">
        <div className="flex justify-around items-center">
          {/* Home */}
          <button
            onClick={() => navigate('/')}
            className="relative flex flex-col items-center justify-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all duration-300 group rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/30"
            title="Home"
          >
            <Home className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 group-hover:scale-125 group-hover:rotate-3 transition-all duration-300 drop-shadow-sm" />
            <span className="text-xs sm:text-xs group-hover:font-semibold transition-all">Home</span>
            <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-sky-400/0 to-sky-400/0 group-hover:from-sky-400/10 group-hover:to-transparent transition-all duration-300"></span>
          </button>

          {/* Inbox */}
          <button
            onClick={handleInboxClick}
            className="relative flex flex-col items-center justify-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all duration-300 group rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/30"
            title="Inbox"
          >
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 group-hover:scale-125 group-hover:-rotate-3 transition-all duration-300 drop-shadow-sm" />
            <span className="text-xs sm:text-xs group-hover:font-semibold transition-all">Inbox</span>
            <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-sky-400/0 to-sky-400/0 group-hover:from-sky-400/10 group-hover:to-transparent transition-all duration-300"></span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold px-1 shadow">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Search Users */}
          <button
            onClick={() => navigate('/search-users')}
            className="relative flex flex-col items-center justify-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all duration-300 group rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/30"
            title="Search Users"
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 drop-shadow-sm" />
            <span className="text-xs sm:text-xs group-hover:font-semibold transition-all">Search</span>
            <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-sky-400/0 to-sky-400/0 group-hover:from-sky-400/10 group-hover:to-transparent transition-all duration-300"></span>
          </button>

          {/* Followers */}
          <button
            onClick={handleFollowersClick}
            className="relative flex flex-col items-center justify-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all duration-300 group rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/30"
            title="Followers"
          >
            <Users className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 group-hover:scale-125 transition-all duration-300 drop-shadow-sm" />
            <span className="text-xs sm:text-xs group-hover:font-semibold transition-all">Followers</span>
            <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-sky-400/0 to-sky-400/0 group-hover:from-sky-400/10 group-hover:to-transparent transition-all duration-300"></span>
            {followerBadge > 0 && (
              <span className="absolute -top-1 right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-semibold px-1 shadow">
                {followerBadge > 99 ? '99+' : followerBadge}
              </span>
            )}
          </button>

          {/* Menu */}
          <Drawer>
            <DrawerTrigger asChild>
              <button 
                className="relative flex flex-col items-center justify-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all duration-300 group rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/30"
                title="More Options"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 group-hover:scale-125 group-hover:rotate-90 transition-all duration-300 drop-shadow-sm" />
                <span className="text-xs sm:text-xs group-hover:font-semibold transition-all">Menu</span>
                <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-sky-400/0 to-sky-400/0 group-hover:from-sky-400/10 group-hover:to-transparent transition-all duration-300"></span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 fixed bottom-16 left-0 right-0 max-h-[70vh] z-50">
              <DrawerHeader className="border-b pb-3">
                <DrawerTitle className="text-base sm:text-lg font-semibold">Droplink Menu</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 space-y-3 max-h-[calc(70vh-100px)] overflow-y-auto">
                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1 py-1 font-semibold">Profile</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => navigate('/')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Home className="w-4 h-4" />
                      Dashboard
                    </Button>
                    <Button 
                      onClick={() => navigate('/profile')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1 py-1 font-semibold">Business & Shop</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => navigate('/switch-to-merchant')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Store className="w-4 h-4" />
                      Merchant Store
                    </Button>
                    <Button 
                      onClick={() => navigate('/sales-earnings')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Sales & Earnings
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1 py-1 font-semibold">Messaging & Community</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => navigate('/inbox')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Mail className="w-4 h-4" />
                      Inbox & Messages
                    </Button>
                    <Button 
                      onClick={() => navigate('/inbox')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Users className="w-4 h-4" />
                      Group Chat
                    </Button>
                    <Button 
                      onClick={() => navigate('/affiliate-program')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Affiliate Program
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200/70 dark:border-sky-800/70 bg-sky-50/70 dark:bg-sky-950/30 p-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-sky-600 dark:text-sky-400 px-1 py-1 font-semibold">Pi Network (A2U)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      onClick={() => navigate('/testnet-reward')}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-sky-200/80 dark:border-sky-700/70 shadow-sm hover:shadow-md hover:border-sky-400"
                    >
                      <Gift className="w-4 h-4 text-sky-600" />
                      Claim Test Pi
                    </Button>
                    <Button
                      onClick={() => navigate('/admin/testnet-progress')}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-sky-200/80 dark:border-sky-700/70 shadow-sm hover:shadow-md"
                    >
                      <BarChart3 className="w-4 h-4 text-sky-600" />
                      A2U Progress
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1 py-1 font-semibold">Tools</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => navigate('/card-generator')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <CreditCard className="w-4 h-4" />
                      Card Generator
                    </Button>
                    <Button 
                      onClick={() => navigate('/ai-support')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Bot className="w-4 h-4" />
                      AI Support
                    </Button>
                    <Button 
                      onClick={() => navigate('/wallet')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <WalletIcon className="w-4 h-4" />
                      Wallet
                    </Button>
                    <Button 
                      onClick={() => navigate('/domain')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Globe className="w-4 h-4" />
                      Custom Domain
                    </Button>
                    {(isInstallable || isInstalled) && (
                      <Button
                        onClick={promptInstall}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        {isInstalled ? 'Installed' : 'Install App'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1 py-1 font-semibold">Account</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => navigate('/subscription')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade Plan
                    </Button>
                    <Button 
                      onClick={() => navigate('/privacy')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Info className="w-4 h-4" />
                      Privacy Policy
                    </Button>
                    <Button 
                      onClick={() => navigate('/terms')} 
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-10 bg-white/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md"
                    >
                      <Info className="w-4 h-4" />
                      Terms of Service
                    </Button>
                  </div>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
      <Dialog open={showInboxPreview} onOpenChange={setShowInboxPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Messages</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingConversations && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />
                ))}
              </div>
            )}
            {!loadingConversations && conversations.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No recent conversations yet.
              </div>
            )}
            {!loadingConversations && conversations.length > 0 && (
              <div className="space-y-2">
                {conversations.map((item) => (
                  <button
                    key={item.otherUserId}
                    className="w-full flex items-center gap-3 rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-left hover:shadow-sm"
                    onClick={() => {
                      setShowInboxPreview(false);
                      navigate(`/chat/${item.username}`);
                    }}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-xs font-semibold">
                      {item.logo ? (
                        <img src={item.logo} alt={item.username} className="w-full h-full object-cover" />
                      ) : (
                        item.username?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">@{item.username}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.lastMessage}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => {
              setShowInboxPreview(false);
              navigate('/inbox');
            }}>
              Open Inbox
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
};
