import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePi } from "@/contexts/PiContext";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { FooterNav } from "@/components/FooterNav";
import { isVerifiedUser, getVerifiedBadgeUrl, isVipUser, VIP_TEAM_MEMBERS, VERIFIED_USERNAMES } from "@/utils/verifiedUsers";

// Notifications bell intentionally omitted on Search page to avoid noise when following

const plans = ["all", "free", "basic", "premium", "pro"];
const categories = [
  { value: "all", label: "All Categories" },
  { value: "vip", label: "👑 VIP Members" },
  { value: "content_creator", label: "🎥 Content Creator" },
  { value: "business", label: "💼 Business" },
  { value: "gamer", label: "🎮 Gamer" },
  { value: "developer", label: "💻 Developer" },
  { value: "artist", label: "🎨 Artist" },
  { value: "musician", label: "🎵 Musician" },
  { value: "educator", label: "📚 Educator" },
  { value: "influencer", label: "⭐ Influencer" },
  { value: "entrepreneur", label: "🚀 Entrepreneur" },
  { value: "other", label: "📋 Other" }
];
const sortOptions = [
  { value: "username", label: "Username (A-Z)" },
  { value: "followers", label: "Most Followers" },
  { value: "recent", label: "Most Recent" },
  { value: "vip", label: "VIP/Admin Only" },
];

// Ranking order for VIP members - they will always appear in this order at the top
const VIP_RANKING = ['wain2020', 'wainfoundation', 'openapp', 'dropshare', 'droplink', 'dropstore', 'droppay'];

// Helper function to get VIP rank (lower = appears first)
const getVipRank = (username?: string | null): number => {
  if (!username) return 999;
  const rank = VIP_RANKING.findIndex(v => v.toLowerCase() === username.toLowerCase());
  return rank >= 0 ? rank : 999;
};

// Helper function to check if a user is VIP (gold badge)
const isGoldBadgeUser = (username?: string | null): boolean => {
  if (!username) return false;
  const goldBadgeMembers = ['wain2020', 'wainfoundation', 'flappypiofficial'];
  return goldBadgeMembers.some(v => v.toLowerCase() === username.toLowerCase());
};

// Helper function to check if a user has blue badge (verified but not VIP)
const isBlueBadgeUser = (username?: string | null): boolean => {
  if (!username) return false;
  const blueBadgeMembers = ['droplink', 'droppay', 'dropstore', 'flappypi', 'flappypi_fun', 'dropshare', 'openapp'];
  return blueBadgeMembers.some(v => v.toLowerCase() === username.toLowerCase());
};

// Helper function to check if a user is VIP
const isUserVip = (username?: string | null): boolean => {
  if (!username) return false;
  const vipTeamMembers = ['wain2020', 'wainfoundation', 'flappypiofficial', 'droplink', 'droppay', 'flappypi', 'dropstore', 'dropshare', 'openapp', 'flappypi_fun'];
  return vipTeamMembers.some(v => v.toLowerCase() === username.toLowerCase());
};

// Helper function to sort with ranked VIPs at top, then by type/sort preference
const sortWithBadgesOnTop = (data: any[], sortType: string): any[] => {
  const rankedVipUsers: any[] = [];
  const otherBadgeUsers: any[] = [];
  const regularUsers: any[] = [];
  
  // Separate users by badge type and rank
  data.forEach(profile => {
    const rank = getVipRank(profile.username);
    if (rank < 999) {
      // This is a ranked VIP user
      rankedVipUsers.push({ ...profile, vipRank: rank });
    } else if (isGoldBadgeUser(profile.username)) {
      otherBadgeUsers.push(profile);
    } else if (isBlueBadgeUser(profile.username) || profile.is_admin === true) {
      otherBadgeUsers.push(profile);
    } else {
      regularUsers.push(profile);
    }
  });
  
  // Sort ranked VIP users by their rank
  rankedVipUsers.sort((a, b) => a.vipRank - b.vipRank);
  
  // Sort other badge users by sort type
  const sortByType = (arr: any[]) => {
    if (sortType === "followers") {
      return arr.sort((a: any, b: any) => (b.follower_count || 0) - (a.follower_count || 0));
    } else if (sortType === "recent") {
      return arr.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      return arr.sort((a: any, b: any) => a.username.localeCompare(b.username));
    }
  };
  
  // Return in order: Ranked VIPs (by rank), Other badges (by sort type), Regular (by sort type)
  return [...rankedVipUsers, ...sortByType(otherBadgeUsers), ...sortByType(regularUsers)];
};

const UserSearchPage = () => {
  const { piUser, isAuthenticated, signIn, showRewardedAd } = usePi();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  interface ProfileResult {
    id: string;
    username: string;
    logo?: string;
    created_at?: string;
    category?: string;
    follower_count?: number;
    is_admin?: boolean;
    avatar_url?: string;
    bio?: string;
    description?: string;
    display_name?: string;
    business_name?: string;
    email?: string;
  }
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("username");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPiAuthModal, setShowPiAuthModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Real Pi Network sign-in
  const signInWithPiNetwork = async () => {
    setSigningIn(true);
    try {
      await signIn(['username', 'payments']);
      setShowPiAuthModal(false);
      toast.success('Signed in with Pi Network!');
    } catch (error) {
      console.error('Pi auth error:', error);
      toast.error('Failed to sign in with Pi Network');
    } finally {
      setSigningIn(false);
    }
  };
  
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [highlight, setHighlight] = useState("");
  const [profileProducts, setProfileProducts] = useState<any[]>([]);
  const [showFollowedModal, setShowFollowedModal] = useState(false);
  const [followedUsername, setFollowedUsername] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [viewAll, setViewAll] = useState(false); // Only declare once
  
  // Friends modal state
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [friendsTab, setFriendsTab] = useState<"followers" | "following">("followers");
  // Track profiles the current user is already following
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  // Clear error on mount
  useEffect(() => {
    setError("");
  }, []);

  // Reset viewAll if query changes and is not empty
  useEffect(() => {
    if (query.trim() !== "") {
      setViewAll(false);
    }
  }, [query]);

  // Re-run results when filters change: apply to View All or Search automatically
  useEffect(() => {
    if (viewAll) {
      handleViewAll();
    } else if (query.trim()) {
      handleSearch();
    }
  }, [selectedCategory, selectedPlan, sortBy]);
  // Fetch total user count and subscribe to changes
  useEffect(() => {
    let subscription: any;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      setUserCount(count || 0);
    };
    fetchCount();
    // Real-time subscription for new/deleted users
    subscription = supabase
      .channel(`public-profiles-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchCount();
      })
      .subscribe();
    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  // Load the current user's following list when authenticated
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        if (!isAuthenticated || !piUser?.username) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", piUser.username)
          .maybeSingle();
        if (!profile?.id) return;
        setCurrentUserProfileId(profile.id);
        const { data: followingData } = await (supabase as any)
          .from("followers")
          .select("following_profile_id")
          .eq("follower_profile_id", profile.id);
        const ids = new Set<string>((followingData || []).map((r: any) => r.following_profile_id));
        setFollowingIds(ids);
      } catch (e) {
        console.warn("Failed to load following list", e);
      }
    };
    loadFollowing();
  }, [isAuthenticated, piUser]);

  // Fetch all users when 'View All' is clicked
  const handleViewAll = async () => {
    setError("");
    setLoading(true);
    setViewAll(true);
    // Fetch all profile fields from Supabase (only existing columns)
    let query = supabase
      .from("profiles")
      .select("id, username, logo, created_at, category, is_admin, bio, description, business_name") as any;
    
    // Category filter
    if (selectedCategory !== "all" && selectedCategory !== "vip") {
      query = query.eq("category", selectedCategory);
    }
    
    // Plan filter - uncomment if you have a plan column in profiles table
    // if (selectedPlan !== "all") {
    //   query = query.eq("plan", selectedPlan);
    // }
    
    const { data, error } = await query;
    if (!error && data) {
      // Manually fetch follower counts for each profile
      let enrichedData = await Promise.all(data.map(async (profile: any) => {
        const { count } = await (supabase
          .from('followers' as any)
          .select('id', { count: 'exact', head: true })
          .eq('following_profile_id', profile.id)) as any;
        return { ...profile, follower_count: count || 0 };
      }));
      
      // Apply sorting (with VIPs always on top)
      let sortedData = enrichedData;
      if (sortBy === "vip") {
        // VIP filter: show only admins and VIP team members
        const vipTeamMembers = ['droplink', 'droppay', 'flappypi', 'Wain2020', 'dropstore', 'dropshare', 'flappypiofficial', 'openapp'];
        sortedData = enrichedData.filter((profile: any) => {
          const isVipTeamMember = vipTeamMembers.includes(profile.username);
          const isGmailAdmin = profile.username?.endsWith('@gmail.com');
          return profile.is_admin === true || isGmailAdmin || isVipTeamMember;
        }).sort((a: any, b: any) => a.username.localeCompare(b.username));
      } else {
        sortedData = sortWithBadgesOnTop(enrichedData, sortBy);
      }
      
      // Apply category filter for VIP
      if (selectedCategory === "vip") {
        sortedData = sortedData.filter((profile: any) => {
          const vipTeamMembers = ['wain2020', 'wainfoundation', 'flappypiofficial', 'droplink', 'droppay', 'flappypi', 'dropstore', 'dropshare', 'openapp', 'airdropio2024', 'flappypi_fun'];
          const isVipUser = vipTeamMembers.some(v => v.toLowerCase() === (profile.username || '').toLowerCase());
          return isVipUser || profile.is_admin === true;
        });
      }
      
      setResults(sortedData);
    } else {
      setResults([]);
      setError(error?.message || "Failed to fetch profiles");
    }
    setLoading(false);
  };

  // Always show all users on initial load
  useEffect(() => {
    handleViewAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("droplink_recent_searches");
    if (stored) setRecentSearches(JSON.parse(stored));
  }, []);

    // Removed duplicate declaration of viewAll and setViewAll
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setError(""); // Clear any previous errors first
    setViewAll(false); // Reset viewAll when searching
    setLoading(true);
    setResults([]);
    setHighlight(query.replace(/^@/, ""));
    try {
      let data = null;
      const cleanQuery = query.trim().replace(/^@/, "");
      let search = supabase
        .from("profiles")
        .select("id, username, logo, created_at, category, is_admin, bio, description, business_name")
        .ilike("username", `%${cleanQuery}%`) as any;
      
      // Category filter
      if (selectedCategory !== "all" && selectedCategory !== "vip") {
        search = search.eq("category", selectedCategory);
      }
      
      const result = await search;
      if (result.error) throw result.error;
      data = result.data;
      
      // Manually fetch follower counts for each profile
      if (data && data.length > 0) {
        data = await Promise.all(data.map(async (profile: any) => {
          const { count } = await (supabase
            .from('followers' as any)
            .select('id', { count: 'exact', head: true })
            .eq('following_profile_id', profile.id)) as any;
          return { ...profile, follower_count: count || 0 };
        }));
      }
      // Sorting (with VIPs always on top)
      if (sortBy === "vip") {
        // VIP filter: show only admins and VIP team members
        const vipTeamMembers = ['droplink', 'droppay', 'flappypi', 'Wain2020', 'wainfoundation', 'wainfoundation', 'dropstore', 'dropshare', 'flappypiofficial', 'openapp'];
        data = data.filter((profile: any) => {
          const isVipTeamMember = vipTeamMembers.includes(profile.username);
          const isGmailAdmin = profile.username?.endsWith('@gmail.com');
          return profile.is_admin === true || isGmailAdmin || isVipTeamMember;
        }).sort((a: any, b: any) => a.username.localeCompare(b.username));
      } else {
        data = sortWithBadgesOnTop(data, sortBy);
      }
      
      // Apply category filter for VIP
      if (selectedCategory === "vip") {
        data = data.filter((profile: any) => {
          const vipTeamMembers = ['wain2020', 'wainfoundation', 'flappypiofficial', 'droplink', 'droppay', 'flappypi', 'dropstore', 'dropshare', 'openapp', 'airdropio2024', 'flappypi_fun'];
          const isVipUser = vipTeamMembers.some(v => v.toLowerCase() === (profile.username || '').toLowerCase());
          return isVipUser || profile.is_admin === true;
        });
      }
      setResults(data || []);
      // Save to recent searches
      const newRecent = [query, ...recentSearches.filter((q) => q !== query)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem("droplink_recent_searches", JSON.stringify(newRecent));
    } catch (err: any) {
      setError("Failed to search profiles.");
    } finally {
      setLoading(false);
    }
  };

  // Check Pi Auth status
  const isPiAuthenticated = () => {
    return isAuthenticated && piUser !== null;
  };

  const handleFollow = async (profile: any) => {
    // Allow following for both Pi Auth and Gmail sign-in
    if (!isAuthenticated || !piUser) {
      setShowPiAuthModal(true);
      return;
    }
    setFollowLoading(profile.id);
    try {
      // Get current user's profile ID from username
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", piUser?.username)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setFollowLoading(null);
        return;
      }

      if (!currentProfile?.id || !profile.id) {
        console.warn('Missing profile IDs');
        setFollowLoading(null);
        return;
      }

      if (currentProfile.id === profile.id) {
        setFollowLoading(null);
        return;
      }

      // Check if already following
      const { data: existing } = await supabase
        .from("followers")
        .select("id")
        .eq("follower_profile_id", currentProfile.id)
        .eq("following_profile_id", profile.id)
        .maybeSingle();

      if (existing) {
        // Already following, reflect in UI
        if (profile.id) {
          setFollowingIds(prev => {
            const next = new Set(prev);
            next.add(profile.id);
            return next;
          });
        }
        setFollowLoading(null);
        return;
      }

      // Only insert into followers, do not create notifications
      const { error: insertError } = await supabase
        .from("followers")
        .insert({
          follower_profile_id: currentProfile.id,
          following_profile_id: profile.id,
        });

      if (insertError) {
        console.error('Follow insert error:', insertError);
        setFollowLoading(null);
        return;
      }

      // Update UI to show Followed
      if (profile.id) {
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.add(profile.id);
          return next;
        });
      }
      setFollowedUsername(profile.username);
      setShowFollowedModal(true);
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setFollowLoading(null);
    }
  };

  const handleUnfollow = async (profile: any) => {
    if (!isAuthenticated || !piUser) {
      setShowPiAuthModal(true);
      return;
    }
    setFollowLoading(profile.id);
    try {
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", piUser?.username)
        .maybeSingle();

      if (profileError || !currentProfile?.id || !profile.id) {
        setFollowLoading(null);
        return;
      }

      const { error: deleteError } = await supabase
        .from("followers")
        .delete()
        .eq("follower_profile_id", currentProfile.id)
        .eq("following_profile_id", profile.id);

      if (deleteError) {
        console.error('Unfollow delete error:', deleteError);
        setFollowLoading(null);
        return;
      }

      if (profile.id) {
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(profile.id);
          return next;
        });
      }
    } catch (err) {
      console.error('Unfollow error:', err);
    } finally {
      setFollowLoading(null);
    }
  };

  const openChatWithUser = (username?: string | null) => {
    if (!username) return;
    navigate(`/chat/${username}`);
  };

  const handleViewProfile = async (profile: ProfileResult) => {
    if (!isPiAuthenticated()) {
      setShowPiAuthModal(true);
      return;
    }

    // Show rewarded ad before navigating to profile
    try {
      const adWatched = await showRewardedAd();
      if (!adWatched) {
        console.warn('Ad not shown, but allowing profile navigation anyway');
        // Allow navigation even if ad fails - don't block UX
      }
    } catch (err) {
      console.error('Error showing ad:', err);
      // Don't block profile navigation if ad fails
    }

    setShowModal(false);
    navigate(`/@${profile.username}`);
  };

  const handleOpenFriends = async () => {
    if (!isPiAuthenticated()) {
      setShowPiAuthModal(true);
      return;
    }

    setShowFriendsModal(true);
    loadFriendsData();
  };

  const loadFriendsData = async () => {
    setFriendsLoading(true);
    try {
      if (!piUser?.username) {
        toast.error("Unable to load friends: user not found");
        return;
      }

      // Get current user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", piUser.username)
        .single();

      if (!profile) {
        toast.error("Profile not found");
        return;
      }

      setCurrentUserProfileId(profile.id);

      // Load followers
      const { data: followersData } = await (supabase as any)
        .from("followers")
        .select(`
          id,
          created_at,
          follower_profile:profiles!followers_follower_profile_id_fkey (
            id,
            username,
            business_name,
            logo
          )
        `)
        .eq("following_profile_id", profile.id);

      setFollowers(followersData || []);

      // Load following
      const { data: followingData } = await (supabase as any)
        .from("followers")
        .select(`
          id,
          created_at,
          following_profile:profiles!followers_following_profile_id_fkey (
            id,
            username,
            business_name,
            logo
          )
        `)
        .eq("follower_profile_id", profile.id);

      setFollowing(followingData || []);
    } catch (error) {
      console.error("Error loading friends:", error);
      toast.error("Failed to load friends");
    } finally {
      setFriendsLoading(false);
    }
  };

  const highlightText = (text: string) => {
    if (!highlight) return text;
    const regex = new RegExp(`(${highlight})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <span key={i} className="bg-yellow-200 rounded px-1">{part}</span> : part
    );
  };

  useEffect(() => {
    // Fetch products when a profile is selected
    const fetchProducts = async () => {
      if (selectedProfile && selectedProfile.id) {
        const { data, error } = await supabase
          .from("products")
          .select("id, title, price, image, description")
          .eq("profile_id", selectedProfile.id);
        if (!error && data) setProfileProducts(data);
        else setProfileProducts([]);
      } else {
        setProfileProducts([]);
      }
    };
    fetchProducts();
  }, [selectedProfile]);

  return (
    <>
      {/* New Feature Alert */}
      <div style={{ margin: '16px 0' }}>
        <Alert variant="default">
          <span role="img" aria-label="party">🎉</span> <b>New Feature!</b> Create your personalized virtual business card with QR code! <a href="/card-generator" style={{ textDecoration: 'underline', color: '#0070f3' }}>Try Card Generator →</a>
        </Alert>
      </div>
      <div className="min-h-screen bg-sky-400 flex flex-col items-center py-4 px-1 sm:py-8 sm:px-2">
        <Card className="w-full max-w-2xl p-2 sm:p-6 shadow-lg rounded-xl">
          {/* User Count and View All */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            {!viewAll && (
              <div className="text-lg font-semibold text-sky-700">
                {userCount !== null ? `${userCount} Droplink Users` : 'Loading user count...'}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white"
                onClick={handleOpenFriends}
              >
                Friends
              </Button>
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white"
                onClick={handleViewAll}
                disabled={loading || viewAll}
              >
                View All
              </Button>
              {/* Notifications hidden on search page */}
            </div>
          </div>
          {/* Active Filters Badges */}
          <div className="w-full -mt-2 mb-4">
            <div className="text-xs text-gray-600">Active filters:</div>
            <div className="flex flex-wrap gap-2 mt-1 items-center">
              <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs">
                Category: {categories.find(c => c.value === selectedCategory)?.label || "All Categories"}
              </span>
              <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs">
                Sort: {sortOptions.find(s => s.value === sortBy)?.label}
              </span>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedCategory("all"); setSortBy("username"); }}>
                Clear
              </Button>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-4 text-sky-700 text-center">Search Droplink Profiles</h1>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4 w-full">
            <Input
              type="text"
              className="flex-1"
              placeholder="Search by @username"
              value={query}
              onChange={e => {
                const value = e.target.value;
                // Auto-prepend @ if not present
                if (value && !value.startsWith('@')) {
                  setQuery('@' + value);
                } else {
                  setQuery(value);
                }
              }}
              autoFocus
            />
            <Button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white font-semibold">Search</Button>
          </form>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4 w-full">
            {/* Plan filter - uncomment when you have a plan column */}
            {/* <select
              className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
            >
              {plans.map(plan => (
                <option key={plan} value={plan}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</option>
              ))}
            </select> */}
            <select
              className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {recentSearches.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">Recent searches:</div>
              <div className="flex flex-wrap gap-2 w-full">
                {recentSearches.map((q, i) => (
                  <Button key={i} size="sm" variant="outline" onClick={() => { setQuery(q); setTimeout(() => handleSearch(), 0); }}>{q}</Button>
                ))}
              </div>
            </div>
          )}
          {loading && (
            <div className="space-y-2 mt-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-sky-200/60 rounded-lg h-20 w-full" />
              ))}
            </div>
          )}
          {error && <div className="text-red-500 mt-2">{error}</div>}
          {!loading && results.length === 0 && query && !error && (
            <div className="text-gray-500 mt-4 text-center">No profiles found.</div>
          )}
          {!loading && results.length > 0 && (
            <div className="grid gap-4 mt-2">
              {results
                .filter((profile: ProfileResult) =>
                  ![
                    "angrlobasit2020@gmail.com",
                    "angelobasit2022@gmail.com",
                    "angelobasit2020@gmail.com"
                  ].includes(profile.username)
                )
                .map((profile: ProfileResult) => {
                  // VIP team members list - these users get all features unlocked without a plan
                  const vipTeamMembers = [
                    'droplink',
                    'droppay',
                    'flappypi',
                    'Wain2020',
                    'wainfoundation',
                    'dropstore',
                    'dropshare',
                    'flappypiofficial',
                    'openapp'
                  ];
                  
                  // Check if user is admin (from database, Gmail email, or VIP team member)
                  const isVipTeamMember = vipTeamMembers.includes(profile.username) || 
                                         vipTeamMembers.includes(profile.email || '');
                  const isGmailAdmin = profile.username?.endsWith('@gmail.com') || 
                                      profile.email?.endsWith('@gmail.com') ||
                                      (profile as any).user_email?.endsWith('@gmail.com');
                  const isAdmin = profile.is_admin === true || isGmailAdmin || isVipTeamMember;
                  
                  return (
                <Card 
                  key={profile.id} 
                  className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-2 sm:p-4 hover:shadow-xl transition cursor-pointer bg-white ${
                    isAdmin ? 'border-2 border-yellow-500 shadow-lg shadow-yellow-200/50' : 'border border-sky-200'
                  }`}
                  onClick={() => { setSelectedProfile(profile); setShowModal(true); }}
                >
                  <div className="relative">
                    <img
                      src={profile.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.username}`}
                      alt={profile.username || "User"}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ${
                        isAdmin ? 'border-3 border-yellow-500 ring-2 ring-yellow-300' : 'border-2 border-sky-300'
                      }`}
                    />
                    {isAdmin && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full p-1 shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`font-semibold text-lg ${isAdmin ? 'text-yellow-600' : 'text-sky-700'}`}>
                        {highlightText("@" + (profile.username || ""))}
                      </div>
                      {isVerifiedUser(profile.username) && (
                        <img 
                          src={getVerifiedBadgeUrl(profile.username)} 
                          alt="Verified" 
                          className="w-5 h-5 inline-block" 
                          title="Verified Account"
                        />
                      )}
                      {isAdmin && (
                        <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs flex-wrap">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{profile.follower_count || 0} followers</span>
                      {/* Category badge - uncomment after running add-followers-and-views.sql migration */}
                      {/* {profile.category && profile.category !== 'other' && (
                        <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                          {categories.find(c => c.value === profile.category)?.label || profile.category}
                        </span>
                      )} */}
                    </div>

                  </div>
                  <div className="flex gap-2 mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      className="bg-sky-400 hover:bg-sky-500 text-white min-w-[60px] sm:min-w-[72px]"
                      style={{height: 32, minWidth: 60}}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedProfile(profile);
                        setShowModal(true);
                      }}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      className={`min-w-[60px] sm:min-w-[72px] ${
                        profile.id && followingIds.has(profile.id)
                          ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                          : "bg-sky-500 hover:bg-sky-600 text-white"
                      }`}
                      style={{height: 32, minWidth: 60}}
                      disabled={followLoading === profile.id}
                      onClick={e => {
                        e.stopPropagation();
                        if (profile.id && followingIds.has(profile.id)) {
                          handleUnfollow(profile);
                        } else {
                          handleFollow(profile);
                        }
                      }}
                    >
                      {profile.id && followingIds.has(profile.id)
                        ? "Unfollow"
                        : (followLoading === profile.id ? "Following..." : "Follow")}
                    </Button>
                    {profile.id && followingIds.has(profile.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-[60px] sm:min-w-[72px]"
                        style={{ height: 32, minWidth: 60 }}
                        onClick={e => { 
                          e.stopPropagation(); 
                          openChatWithUser(profile.username); 
                        }}
                      >
                        Chat
                      </Button>
                    )}
                  </div>
                </Card>
              );
                })}
            </div>
          )}
        </Card>

        {/* Profile Preview Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Profile Preview</DialogTitle>
            </DialogHeader>
            {selectedProfile && (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={selectedProfile.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedProfile.username}`}
                  alt={selectedProfile.username || "User"}
                  className="w-20 h-20 rounded-full border-2 border-sky-300 object-cover"
                />
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-lg text-sky-700">@{selectedProfile.username || ""}</div>
                  {isVerifiedUser(selectedProfile.username) && (
                    <img 
                      src={getVerifiedBadgeUrl(selectedProfile.username)} 
                      alt="Verified" 
                      className="w-5 h-5 inline-block" 
                      title="Verified Account"
                    />
                  )}
                </div>
                
                {/* Business Name */}
                {selectedProfile.business_name && (
                  <div className="text-sm font-medium text-gray-600">
                    {selectedProfile.business_name}
                  </div>
                )}
                
                {/* Bio/Description */}
                {(selectedProfile.bio || selectedProfile.description) && (
                  <div className="w-full px-4 py-3 bg-sky-50 rounded-lg text-center">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedProfile.bio || selectedProfile.description}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2 mt-1 text-xs">
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{selectedProfile.follower_count || 0} followers</span>
                </div>

                <Button className="w-full bg-sky-500 hover:bg-sky-600 text-white" onClick={() => handleViewProfile(selectedProfile)}>View Full Profile</Button>
                {selectedProfile.id && followingIds.has(selectedProfile.id) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openChatWithUser(selectedProfile.username)}
                  >
                    Chat
                  </Button>
                )}

                {/* Products Section */}
                {profileProducts.length > 0 && (
                  <div className="w-full mt-4">
                    <div className="font-semibold text-sky-700 mb-2">Products</div>
                    <div className="grid gap-2">
                      {profileProducts.map(product => (
                        <div key={product.id} className="border rounded p-2 flex gap-2 items-center bg-sky-50">
                          {product.image && <img src={product.image} alt={product.title} className="w-10 h-10 object-cover rounded" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sky-800 truncate">{product.title}</div>
                            {product.description && <div className="text-xs text-gray-600 truncate">{product.description}</div>}
                          </div>
                          <div className="text-sky-600 font-bold text-sm">{product.price}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Pi Network Auth Required Modal */}
        <Dialog open={showPiAuthModal} onOpenChange={setShowPiAuthModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Sign in Required</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-center">
              <p className="mb-4">You must be signed in with <span className="font-semibold text-sky-600">Pi Network</span> to follow users.</p>
              <Button
                className="w-full bg-sky-600 hover:bg-sky-700 text-white mb-2"
                onClick={signInWithPiNetwork}
                disabled={signingIn}
              >
                {signingIn ? "Signing in..." : "Sign in with Pi Network"}
              </Button>
              <Button className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700" variant="outline" onClick={() => setShowPiAuthModal(false)} disabled={signingIn}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      {/* Followed Modal for any user */}
      <Dialog open={showFollowedModal} onOpenChange={setShowFollowedModal}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Followed!</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="mb-2">You have followed <span className="font-semibold text-sky-600">@{followedUsername}</span>!</p>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                onClick={() => setShowFollowedModal(false)}
              >
                Close
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowFollowedModal(false);
                  openChatWithUser(followedUsername);
                }}
              >
                Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Friends Modal */}
      <Dialog open={showFriendsModal} onOpenChange={setShowFriendsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Friends Network</DialogTitle>
          </DialogHeader>
          {friendsLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-sky-600 rounded-full opacity-75 animate-spin"></div>
                  <div className="absolute inset-1 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="text-gray-500 text-sm font-medium">Loading friends...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Followers Tab */}
              <div>
                <h3 className="font-semibold text-sky-700 mb-2 flex items-center gap-2">
                  <span>👤 Followers ({followers.length})</span>
                </h3>
                {followers.length === 0 ? (
                  <div className="text-gray-400 text-sm">No followers yet</div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {followers.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-sky-50 rounded border border-sky-200">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={item.follower_profile?.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.follower_profile?.username}`}
                            alt={item.follower_profile?.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sky-800 truncate">@{item.follower_profile?.username}</div>
                            {item.follower_profile?.business_name && (
                              <div className="text-xs text-gray-600 truncate">{item.follower_profile.business_name}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-sky-600 hover:bg-sky-100"
                          onClick={() => {
                            navigate(`/@${item.follower_profile?.username}`);
                            setShowFriendsModal(false);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Following Tab */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sky-700 mb-2 flex items-center gap-2">
                  <span>⭐ Following ({following.length})</span>
                </h3>
                {following.length === 0 ? (
                  <div className="text-gray-400 text-sm">Not following anyone yet</div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {following.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={item.following_profile?.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.following_profile?.username}`}
                            alt={item.following_profile?.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-emerald-800 truncate">@{item.following_profile?.username}</div>
                            {item.following_profile?.business_name && (
                              <div className="text-xs text-gray-600 truncate">{item.following_profile.business_name}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 hover:bg-emerald-100"
                          onClick={() => {
                            navigate(`/@${item.following_profile?.username}`);
                            setShowFriendsModal(false);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowFriendsModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      <FooterNav />
    </>
  );
};

export default UserSearchPage;
