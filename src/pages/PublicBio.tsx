import { useEffect, useState, useRef } from "react";
import ReactPlayer from 'react-player';
import { usePublicSubscription } from "@/hooks/usePublicSubscription";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePi } from "@/contexts/PiContext";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PiPaymentDialog } from "@/components/PiPaymentDialog";
import { toast } from "sonner";
import { Info, Flag, VolumeX, Volume2, Play, Pause } from "lucide-react";
import { FollowersSection } from "@/components/FollowersSection";
import { GiftDialog } from "@/components/GiftDialog";
import { AIChatWidget } from "@/components/AIChatWidget";
import PublicBioMessageForm from "@/components/PublicBioMessageComposer";
import { BackgroundMusicPlayer } from "@/components/BackgroundMusicPlayer";
import { VirtualCard } from "@/components/VirtualCard";
import { PiAdBanner } from "@/components/PiAdBanner";
import PiAdsBanner from "@/components/PiAdsBanner";
import PiAdNetwork from "@/components/PiAdNetwork";
import { useMonetization } from "@/hooks/useMonetization";
import { useAnalytics } from "@/hooks/useAnalytics";
import { EmailCaptureDisplay } from "@/components/EmailCaptureDisplay";
import { ProductDisplay } from "@/components/ProductDisplay";
import { MembershipGate } from "@/components/MembershipGate";
import { isVerifiedUser, getVerifiedBadgeUrl } from "@/utils/verifiedUsers";
import { getSocialIcon as getSocialIconBase, getSocialLabel, extractSocialUsername, isDisplayableSocialUrl } from "@/utils/social-utils";
import type { UserPreferences } from "@/contexts/UserPreferencesContext";
import { defaultPreferences } from "@/contexts/UserPreferencesContext";
import {
  Twitter,
  Music,
  Linkedin,
  Twitch,
  ShoppingBag,
  Mail,
  Phone,
  Calendar,
  Download,
  ExternalLink,
  Heart,
  Star,
  Zap,
  Link as LinkIcon,
  Wallet,
  Copy,
  Check,
  Share2,
  UserPlus,
  UserMinus,
  Gift,
  Eye,
} from "lucide-react";

import type { ProfileData, SocialEmbedItem, SocialLink } from "@/types/profile";
import { BioTemplate, DEFAULT_TEMPLATE } from "@/config/bioTemplates";

const PREFERENCES_STORAGE_KEY = 'droplink_user_preferences';
const AFFILIATE_SHARE_IMAGE_PATH = "/affiliate-share.jpg";

const upsertMetaTag = (attribute: "name" | "property", key: string, content: string) => {
  if (typeof document === "undefined") return;
  let tag = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
};

const upsertCanonicalLink = (href: string) => {
  if (typeof document === "undefined") return;
  let linkTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!linkTag) {
    linkTag = document.createElement("link");
    linkTag.setAttribute("rel", "canonical");
    document.head.appendChild(linkTag);
  }
  linkTag.setAttribute("href", href);
};

const PublicBio = () => {
  // Pi Payment Dialog state
  const [showPiPaymentDialog, setShowPiPaymentDialog] = useState(false);
  const [piPaymentLoading, setPiPaymentLoading] = useState(false);
  const { createPayment } = usePi();

  const [showReportModal, setShowReportModal] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { username: rawUsername } = useParams();
  // Strip @ prefix if present (for @username URLs)
  const username = rawUsername?.startsWith('@') ? rawUsername.substring(1) : rawUsername;
  const navigate = useNavigate();
  const { piUser, isAuthenticated: isPiAuthenticated, signOut, showRewardedAd } = usePi();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [adShownOnLoad, setAdShownOnLoad] = useState(false);
  // Subscription for viewed profile (must be after username is defined)
  const { plan, expiresAt, loading: subLoading } = usePublicSubscription(username ? String(username) : "");
  const isPlanExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  // Pi AdNetwork logic: show ads for free/basic/expired, hide for premium/pro
  const planAllowsPiAds = !plan || plan === 'free' || plan === 'basic' || isPlanExpired;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<{ type: 'crypto' | 'bank', name: string, value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [showPiWalletTip, setShowPiWalletTip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [piAdsOpen, setPiAdsOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [bioTemplate, setBioTemplate] = useState<BioTemplate>(DEFAULT_TEMPLATE);
  const [followerCount, setFollowerCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);
  const [message, setMessage] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const [connectEmail, setConnectEmail] = useState("");
  const [connectSubmitting, setConnectSubmitting] = useState(false);
  const [socialFeedItems, setSocialFeedItems] = useState<SocialEmbedItem[]>([]);
  const [showSocialFollowersModal, setShowSocialFollowersModal] = useState(false);
  const [socialFollowersLoading, setSocialFollowersLoading] = useState(false);
  const [socialFollowersLinks, setSocialFollowersLinks] = useState<SocialLink[]>([]);
  // State to trigger auto-refresh after Pi Auth if Profile Not Found
  const [shouldAutoRefresh, setShouldAutoRefresh] = useState(false);

  const getCachedProfileFromStorage = () => {
    if (typeof window === "undefined") return null;
    try {
      const keys = Object.keys(localStorage).filter((key) =>
        key.startsWith("profile_")
      );
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const id = parsed?.profileId || parsed?.id;
        const username = parsed?.username || parsed?.businessName;
        if (id) {
          return { id, username } as { id: string; username?: string | null };
        }
      }
    } catch (error) {
      console.error("[PROFILE] Failed to read cached profile:", error);
    }
    return null;
  };

  const formatCompactNumber = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return value.toLocaleString();
  };

  const getSocialFollowerValue = (link: SocialLink) => {
    const verified = Number(link.verified_followers);
    if (Number.isFinite(verified) && verified > 0) return verified;
    const followers = Number(link.followers);
    if (Number.isFinite(followers)) return followers;
    return 0;
  };

  const formatPlatformLabel = (platform: string) => {
    const normalized = platform.toLowerCase();
    if (normalized === "x" || normalized === "twitter") return "X";
    if (normalized === "dropshare") return "DropShare";
    return platform.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Monetization features
  const { products, tiers, captureLead, createOrder } = useMonetization(profileId);
  const { logClickEvent } = useAnalytics(profileId);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Parallax scroll effect for cover image
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-follow after redirect from auth if needed
  useEffect(() => {
    const authAction = sessionStorage.getItem('authAction');
    const profileToFollow = sessionStorage.getItem('profileToFollow');
    if (
      authAction === 'follow' &&
      profileToFollow &&
      (profileToFollow === username || profileToFollow === profileId) &&
      currentUserProfileId &&
      currentUserProfileId !== profileId &&
      !isFollowing
    ) {
      // Remove intent so it doesn't repeat
      sessionStorage.removeItem('authAction');
      sessionStorage.removeItem('profileToFollow');
      handleFollow();
    }
  }, [username, profileId, currentUserProfileId, isFollowing]);

  // Show rewarded ad when viewing public bio directly
  useEffect(() => {
    if (isPiAuthenticated && !adShownOnLoad && profile) {
      setAdShownOnLoad(true);
      // Show ad asynchronously without blocking page load
      const showAd = async () => {
        const adWatched = await showRewardedAd();
        if (adWatched) {
          console.log('Ad shown when viewing public bio');
        }
      };
      // Delay ad slightly to let page render
      setTimeout(showAd, 1000);
    }
  }, [isPiAuthenticated, profile, adShownOnLoad, showRewardedAd]);

  useEffect(() => {
    loadProfile();
    loadCurrentUserProfile();
    loadVisitorCounts();
    // Fetch profileId for store link
    const fetchProfileId = async () => {
      if (!username) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (profile && profile.id) setProfileId(profile.id);
    };
    fetchProfileId();
  }, [username, isPiAuthenticated, piUser]);

  useEffect(() => {
    if (profileId) {
      loadUserPreferences(profileId);
    }
  }, [profileId]);

  useEffect(() => {
    if (profileId) {
      checkFollowStatus();
    }
  }, [profileId, currentUserProfileId]);

  // Redirect to Dashboard if current user is viewing their own profile
  useEffect(() => {
    if (profile && currentUserProfileId && profileId && currentUserProfileId === profileId) {
      console.log("User is viewing their own profile, redirecting to Dashboard");
      navigate("/");
    }
  }, [profile, currentUserProfileId, profileId, navigate]);

  useEffect(() => {
    if (!profile || typeof window === "undefined") return;
    const baseUrl = window.location.origin;
    const canonicalUrl = `${baseUrl}/u/${profile.username}`;
    const shareImage = `${baseUrl}${AFFILIATE_SHARE_IMAGE_PATH}`;
    const usernameTag = `@${profile.username}`;
    const profileDescription = (profile.description || profile.appDescription || "Claim 1 Pi on Droplink Affiliate")
      .replace(/\s+/g, " ")
      .trim();
    const shareTitle = `${usernameTag} | Droplink Affiliate`;
    const shareDescription = `${profileDescription} | ${usernameTag} on Droplink Affiliate`;

    document.title = shareTitle;
    upsertCanonicalLink(canonicalUrl);
    upsertMetaTag("name", "title", shareTitle);
    upsertMetaTag("name", "description", shareDescription);
    upsertMetaTag("property", "og:type", "profile");
    upsertMetaTag("property", "og:url", canonicalUrl);
    upsertMetaTag("property", "og:title", shareTitle);
    upsertMetaTag("property", "og:description", shareDescription);
    upsertMetaTag("property", "og:image", shareImage);
    upsertMetaTag("property", "og:image:alt", `${usernameTag} Droplink Affiliate`);
    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:url", canonicalUrl);
    upsertMetaTag("name", "twitter:title", shareTitle);
    upsertMetaTag("name", "twitter:description", shareDescription);
    upsertMetaTag("name", "twitter:image", shareImage);
  }, [profile]);

  const loadCurrentUserProfile = async () => {
    try {
      // Check for Supabase session (Gmail users)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[PROFILE] Error fetching profile for Gmail user:', error);
        } else if (profile) {
          console.log('[PROFILE] Gmail user profile loaded:', profile.id);
          setCurrentUserProfileId(profile.id);
          return;
        }
      }

      // Check for Pi-authenticated users (no Supabase session)
      if (isPiAuthenticated && piUser?.username) {
        console.log('[PROFILE] Loading Pi user profile for:', piUser.username);
        const { data: piProfile, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", piUser.username)
          .maybeSingle();
        
        if (error) {
          console.error('[PROFILE] Error fetching Pi profile:', error);
        } else if (piProfile) {
          console.log('[PROFILE] Pi user profile loaded:', piProfile.id);
          setCurrentUserProfileId(piProfile.id);
        } else {
          console.warn('[PROFILE] No profile found for Pi user:', piUser.username);
        }
      } else {
        console.log('[PROFILE] No authenticated user found');
      }

      if (!currentUserProfileId) {
        const cachedProfile = getCachedProfileFromStorage();
        if (cachedProfile?.id) {
          console.log('[PROFILE] Using cached profile from storage:', cachedProfile.id);
          setCurrentUserProfileId(cachedProfile.id);
        }
      }
    } catch (error) {
      console.error('[PROFILE] Error in loadCurrentUserProfile:', error);
    }
  };

  const mergePreferences = (incoming: Partial<UserPreferences>): UserPreferences => ({
    ...defaultPreferences,
    ...incoming,
    store_settings: {
      ...defaultPreferences.store_settings,
      ...(incoming.store_settings || {})
    },
    privacy_settings: {
      ...defaultPreferences.privacy_settings,
      ...(incoming.privacy_settings || {})
    },
    notification_settings: {
      ...defaultPreferences.notification_settings,
      ...(incoming.notification_settings || {})
    }
  });

  const loadUserPreferences = async (ownerProfileId?: string) => {
    if (typeof window === 'undefined') return;
    try {
      if (ownerProfileId) {
        const { data: remotePrefs, error } = await (supabase as any)
          .from('user_preferences')
          .select('theme_mode, primary_color, background_color, store_settings, privacy_settings, notification_settings')
          .eq('profile_id', ownerProfileId)
          .maybeSingle();

        if (!error && remotePrefs) {
          const merged = mergePreferences(remotePrefs as Partial<UserPreferences>);
          setUserPreferences(merged);
          localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
          return;
        }

        if (error) {
          console.error('Failed to load remote preferences for public bio:', error);
        }
      }

      const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserPreferences(mergePreferences(parsed));
      } else {
        setUserPreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      setUserPreferences(defaultPreferences);
    }
  };

  const loadVisitorCounts = async () => {
    if (!username) return;
    
    try {
      // Get profile data to find the owner
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("username", username)
        .maybeSingle();
      
      if (profileData) {
        setProfileId(profileData.id);
        // Load follower count
        const followerQuery: any = (supabase as any)
          .from('followers')
          .select('id', { count: 'exact' })
          .eq('following_profile_id', profileData.id);
        const { data: followers, count: followerCount } = await followerQuery as any;
        
        setFollowerCount(followerCount || 0);
        
        // Load/update visit count
        const { data: analytics, count: visitCount } = await supabase
          .from('analytics')
          .select('id', { count: 'exact' })
          .eq('profile_id', profileData.id)
          .eq('event_type', 'view');
        
        setVisitCount(visitCount || 0);
      }
    } catch (error) {
      console.error('Failed to load visitor counts:', error);
    }
  };

  const checkFollowStatus = async () => {
    if (!profileId) return false;
    const cached = getCachedProfileFromStorage();
    const followerProfileId = currentUserProfileId || cached?.id || null;
    if (!followerProfileId) return false;
    
    const query: any = (supabase as any)
      .from("followers")
      .select("id")
      .eq("follower_profile_id", followerProfileId)
      .eq("following_profile_id", profileId)
      .maybeSingle();
    const { data } = await query as any;
    
    const following = !!data;
    setIsFollowing(following);
    return following;
  };

  const handleSignUpToFollow = () => {
    // Store the current store/profile for potential future redirect
    sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
    sessionStorage.setItem('authAction', 'follow');
    sessionStorage.setItem('profileToFollow', username || '');
    
    // Redirect to main DropLink website for signup
    window.location.href = 'https://www.droplink.space';
  };

  const handlePiSignIn = async () => {
    try {
      // Store the profile to follow after authentication
      sessionStorage.setItem('authAction', 'follow');
      sessionStorage.setItem('profileToFollow', profileId || '');
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      
      toast.loading("Redirecting to sign in...");
      
      // Redirect to dashboard for Pi authentication
      navigate('/', { state: { authAction: 'follow', profileToFollow: profileId } });
    } catch (error) {
      console.error("Pi sign in error:", error);
      toast.error("Failed to redirect to sign in", {
        description: "Please try again"
      });
    }
  };

  const handleFollow = async () => {
    const cachedProfile = currentUserProfileId ? null : getCachedProfileFromStorage();
    const followerProfileId = currentUserProfileId || cachedProfile?.id || null;

    if (!followerProfileId || !profileId) {
      toast.error("Please sign in to follow");
      return;
    }

    if (!currentUserProfileId && cachedProfile?.id) {
      setCurrentUserProfileId(cachedProfile.id);
    }

    if (followerProfileId === profileId) {
      console.warn('Cannot follow own profile');
      return;
    }
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_profile_id", followerProfileId)
          .eq("following_profile_id", profileId);
        if (error) {
          console.error('Unfollow error:', error);
          return;
        }
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        // Sync follow state across pages
        localStorage.setItem(`follow_status_${profileId}`, 'false');
      } else {
        const { error } = await supabase
          .from("followers")
          .insert({
            follower_profile_id: followerProfileId,
            following_profile_id: profileId,
          });
        if (error) {
          console.error('Follow insert error:', error);
          return;
        }
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        // Sync follow state across pages
        localStorage.setItem(`follow_status_${profileId}`, 'true');
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  // Auto-follow after redirect from auth if needed
  useEffect(() => {
    const authAction = sessionStorage.getItem('authAction');
    const profileToFollow = sessionStorage.getItem('profileToFollow');
    if (
      authAction === 'follow' &&
      profileToFollow &&
      (profileToFollow === username || profileToFollow === profileId) &&
      currentUserProfileId &&
      currentUserProfileId !== profileId &&
      !isFollowing
    ) {
      // Remove intent so it doesn't repeat
      sessionStorage.removeItem('authAction');
      sessionStorage.removeItem('profileToFollow');
      handleFollow();
    }
  }, [username, profileId, currentUserProfileId, isFollowing]);

  const loadProfile = async () => {
    if (!username) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      // Normalize username to lowercase for case-insensitive matching
      const normalizedUsername = username.toLowerCase();
      console.log("[PUBLIC BIO] Loading profile for username:", username);
      
      // Try exact match first
      let { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      console.log("[PUBLIC BIO] Exact match - Data:", profileData ? 'Found' : 'Not found', "Error:", error?.message);

      // If no exact match, try case-insensitive match
      if (!profileData && !error) {
        console.log("[PUBLIC BIO] No exact match, trying case-insensitive search...");
        const { data: caseInsensitiveData, error: caseInsensitiveError } = await supabase
          .from("profiles")
          .select("*")
          .ilike("username", username)
          .maybeSingle();
        
        console.log("[PUBLIC BIO] Case-insensitive - Data:", caseInsensitiveData ? 'Found' : 'Not found', "Error:", caseInsensitiveError?.message);
        profileData = caseInsensitiveData;
        error = caseInsensitiveError;
      }

      // If still no profile, try without subscription relationship
      if (!profileData && !error) {
        console.log("[PUBLIC BIO] Retrying without subscriptions relationship...");
        const { data: basicProfileData, error: basicError } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .maybeSingle();
        
        console.log("[PUBLIC BIO] Basic query - Data:", basicProfileData ? 'Found' : 'Not found', "Error:", basicError?.message);
        
        if (basicProfileData) {
          profileData = basicProfileData;
          error = basicError;
        } else if (!basicError) {
          // Try case-insensitive without subscriptions
          console.log("[PUBLIC BIO] Trying case-insensitive without subscriptions...");
          const { data: ilikProfileData, error: ilikError } = await supabase
            .from("profiles")
            .select("*")
            .ilike("username", username)
            .maybeSingle();
          console.log("[PUBLIC BIO] Case-insensitive basic - Data:", ilikProfileData ? 'Found' : 'Not found', "Error:", ilikError?.message);
          profileData = ilikProfileData;
          error = ilikError;
        }
      }

      if (error) {
        console.error("[PUBLIC BIO] Database error:", error);
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!profileData) {
        console.log("No profile found for username:", username);
        console.log("Tried both exact and case-insensitive match");
        setNotFound(true);
        setLoading(false);
        return;
      }

      console.log("Profile loaded successfully:", profileData);
      setProfileId(profileData.id);

      // Track page view (basic analytics)
      try {
        await supabase.from("analytics").insert({
          profile_id: profileData.id,
          event_type: "view",
          event_data: { source: "public_share" },
          user_agent: navigator.userAgent,
        });
        console.log("Analytics tracked");
      } catch (trackError) {
        console.log("Analytics tracking failed:", trackError);
        // Silent fail - don't break the user experience
      }

      // Fetch products for this profile
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("profile_id", profileData.id);

      const socialLinks = profileData.social_links as any;
      
      // Load financial data from secure table (public read access)
      let financialData = {
        pi_wallet_address: profileData.pi_wallet_address || null,
        pi_donation_message: profileData.pi_donation_message || "Send me a coffee ☕",
        crypto_wallets: profileData.crypto_wallets || {},
        bank_details: profileData.bank_details || {},
      };
      
      const cryptoWallets = financialData.crypto_wallets as any;
      const bankDetails = financialData.bank_details as any;

      // Social links: convert object to array if needed
      let socialLinksArr = [];
      if (Array.isArray(profileData.social_links)) {
        // Dashboard stores as array with "type" field; normalize to "platform" for consistency
        // Filter out links with empty URLs to keep public bio clean
        socialLinksArr = profileData.social_links
          .filter((link: any) => link.url && link.url.trim())
          .map((link: any) => ({
            platform: link.type || link.platform,
            type: link.type || link.platform,
            url: link.url,
            icon: link.icon,
            label: link.label,
            followers: link.followers,
            verified_followers: link.verified_followers,
            last_verified: link.last_verified,
            is_verified: link.is_verified,
          }));
      } else if (profileData.social_links && typeof profileData.social_links === 'object') {
        socialLinksArr = Object.entries(profileData.social_links)
          .filter(([_, url]) => url && String(url).trim())
          .map(([platform, url]) => ({ platform, type: platform, url: String(url) }));
      }

      // Custom links: only if present and array (fallback to empty array)
      let customLinksArr = [];
      let imageLinkCardsArr = [];
      let showPiWalletTips = true;
      let themeSettingsObj: any = {};
      if (profileData.theme_settings && typeof profileData.theme_settings === 'object' && !Array.isArray(profileData.theme_settings)) {
        themeSettingsObj = profileData.theme_settings;
        if (Array.isArray(themeSettingsObj.customLinks)) {
          // Filter out links with empty URLs to keep public bio clean
          customLinksArr = themeSettingsObj.customLinks.filter((link: any) => link.url && String(link.url).trim());
        }
        if (Array.isArray(themeSettingsObj.imageLinkCards)) {
          imageLinkCardsArr = themeSettingsObj.imageLinkCards;
        }
        if (typeof themeSettingsObj.showPiWalletTips === 'boolean') {
          showPiWalletTips = themeSettingsObj.showPiWalletTips;
        }
      }

      // Wallets: build from crypto_wallets and bank_details
      let walletsObj = { crypto: [], bank: [] };
      if (Array.isArray(profileData.crypto_wallets)) walletsObj.crypto = profileData.crypto_wallets;
      if (Array.isArray(profileData.bank_details)) walletsObj.bank = profileData.bank_details;

      // Social feed / pinned embeds sourced from multiple possible fields for compatibility
      let socialFeed: SocialEmbedItem[] = [];
      const possibleFeeds = [
        (themeSettingsObj as any).socialFeedItems,
        (themeSettingsObj as any).pinnedEmbeds,
        (profileData as any).social_feed,
        (profileData as any).pinned_posts,
      ];
      for (const feed of possibleFeeds) {
        if (Array.isArray(feed)) {
          socialFeed = feed
            .filter((item: any) => item && (item.url || item.embedHtml))
            .map((item: any, idx: number) => ({
              id: item.id || `feed-${idx}`,
              platform: item.platform || item.type || item.source || 'Social',
              url: item.url,
              embedHtml: item.embedHtml || item.embed_html,
              title: item.title || item.caption || item.description,
              pinned: item.pinned ?? true,
              thumbnail: item.thumbnail || item.image,
            }));
          break;
        }
      }

      // Check if user has active 30 Pi plan for verified badge
      const hasActiveSubscription = Array.isArray((profileData as any).subscriptions) && 
        (profileData as any).subscriptions.some((sub: any) => 
          sub.status === 'active' && 
          sub.amount >= 30 &&
          (!sub.expires_at || new Date(sub.expires_at) > new Date())
        );

      // Check if user is in the special verified list
      const isSpecialVerified = isVerifiedUser(profileData.username);

      console.log('Background Music URL from DB:', (profileData as any).background_music_url);
      
      const profileObj = {
        id: profileData.id,
        username: profileData.username || (username ? String(username) : ""),
        email: "", // email column doesn't exist in profiles table
        logo: profileData.logo || "",
        businessName: profileData.business_name || "",
        appLink: (profileData as any).app_link || "",
        appTitle: (profileData as any).app_title || "",
        appLogo: (profileData as any).app_logo || "",
        appDescription: (profileData as any).app_description || "",
        appLinks: (themeSettingsObj as any).appLinks || [],
        description: profileData.description || "",
        youtubeVideoUrl: profileData.youtube_video_url || "",
        backgroundMusicUrl: (profileData as any).background_music_url || "",
        socialLinks: socialLinksArr,
        customLinks: customLinksArr,
        imageLinkCards: imageLinkCardsArr,
        theme: {
          primaryColor: themeSettingsObj.primaryColor || "#000000",
          backgroundColor: themeSettingsObj.backgroundColor || "#FFFFFF",
          backgroundType: themeSettingsObj.backgroundType || "color",
          backgroundGif: themeSettingsObj.backgroundGif || "",
          backgroundVideo: themeSettingsObj.backgroundVideo || "",
          iconStyle: themeSettingsObj.iconStyle || "default",
          buttonStyle: themeSettingsObj.buttonStyle || "default",
          glassMode: themeSettingsObj.glassMode ?? false,
          coverImage: themeSettingsObj.coverImage || "",
          textColor: themeSettingsObj.textColor || undefined,
        },
        wallets: walletsObj,
        hasPremium: profileData.has_premium || false,
        piWalletAddress: profileData.pi_wallet_address || "",
        piDonationMessage: profileData.pi_donation_message || "",
        showShareButton: profileData.show_share_button || false,
        storeUrl: `@${profileData.username || username || 'user'}`,
        showPiWalletTips,
        card_front_color: (profileData as any).card_front_color || "#2bbdee",
        card_back_color: (profileData as any).card_back_color || "#2bbdee",
        card_text_color: (profileData as any).card_text_color || "#000000",
        card_accent_color: (profileData as any).card_accent_color || "#fafafa",
        isVerified: (profileData as any).is_verified || hasActiveSubscription || isSpecialVerified,
      };
      
      // Load template preference
      const themeSettings = (profileData as any).theme_settings || {};
      setBioTemplate((themeSettings.bioTemplate as BioTemplate) || DEFAULT_TEMPLATE);
      
      console.log('Setting profile with backgroundMusicUrl:', profileObj.backgroundMusicUrl);
      setProfile(profileObj);
      setSocialFeedItems(socialFeed);
    } catch (error) {
      console.error("Error loading profile:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const trackAnalytics = async (profileId: string, eventType: string, eventData: any) => {
    try {
      await supabase.from("analytics").insert({
        profile_id: profileId,
        event_type: eventType,
        event_data: eventData,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      // Silent fail - don't break the user experience
    }
  };

  const handleSocialClick = (platform: string, profileId: string) => {
    trackAnalytics(profileId, "social_click", { platform });
  };

  const handleProductClick = (productId: string, productTitle: string, profileId: string) => {
    trackAnalytics(profileId, "product_click", { product_id: productId, product_title: productTitle });
  };

  const handleWalletClick = (type: 'crypto' | 'bank', name: string, value: string) => {
    setSelectedWallet({ type, name, value });
    setShowWalletDialog(true);
    setCopied(false);
  };

  const handleCopyWallet = () => {
    if (selectedWallet) {
      navigator.clipboard.writeText(selectedWallet.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenSocialFollowersModal = async () => {
    if (!profile) return;
    const validLinks = Array.isArray(profile.socialLinks)
      ? profile.socialLinks.filter((link) => link.url && isValidSocialUrl(link.url))
      : [];
    setSocialFollowersLinks(validLinks);
    setShowSocialFollowersModal(true);
    if (!profileId || validLinks.length === 0) return;
    setSocialFollowersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-social-followers", {
        body: { socialLinks: validLinks, profileId }
      });
      if (error) {
        toast.error("Failed to verify social followers");
      } else if (data?.verifiedLinks) {
        const verifiedLinks = data.verifiedLinks as SocialLink[];
        setSocialFollowersLinks(verifiedLinks);
        setProfile((prev) => prev ? { ...prev, socialLinks: verifiedLinks } : prev);
      }
    } catch (fetchError) {
      toast.error("Failed to verify social followers");
    } finally {
      setSocialFollowersLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !profileId) return;

    try {
      // Use messages table with proper structure
      const { error } = await supabase.from("messages").insert({
        receiver_profile_id: profileId,
        content: message,
      });

      if (error) {
        console.error("Error sending message:", error);
        toast.error("Failed to send message. Please try again.");
      } else {
        toast.success("Message sent successfully!");
        setMessage("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("An unexpected error occurred.");
    }
  };

  const getSocialIcon = (platform: string) => getSocialIconBase(platform);

  const getIconStyle = (style: string) => {
    switch (style) {
      case "rounded":
        return "rounded-2xl";
      case "square":
        return "rounded-none";
      case "circle":
        return "rounded-full";
      default:
        return "rounded-2xl";
    }
  };

  const getButtonStyles = (primaryColor: string, buttonStyle: string, glassMode?: boolean) => {
    // Glass override
    if (glassMode) {
      return {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#fff',
        textShadow: '0 1px 4px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(14px)',
      };
    }

    if (buttonStyle === 'outlined') {
      return {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        border: `2px solid ${primaryColor}`,
        color: '#fff',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
      };
    } else {
      return {
        backgroundColor: primaryColor,
        color: '#fff',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      };
    }
  };

  const getCustomLinkIcon = (iconValue?: string) => {
    switch (iconValue) {
      case "shop": return <ShoppingBag className="w-5 h-5" />;
      case "mail": return <Mail className="w-5 h-5" />;
      case "phone": return <Phone className="w-5 h-5" />;
      case "calendar": return <Calendar className="w-5 h-5" />;
      case "download": return <Download className="w-5 h-5" />;
      case "external": return <ExternalLink className="w-5 h-5" />;
      case "heart": return <Heart className="w-5 h-5" />;
      case "star": return <Star className="w-5 h-5" />;
      case "zap": return <Zap className="w-5 h-5" />;
      default: return <LinkIcon className="w-5 h-5" />;
    }
  };

  const extractYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const isDirectVideoFileUrl = (url?: string | null) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg|m4v|mov)(?:$|[?#])/i.test(url);
  };

  useEffect(() => {
    if (notFound || !profile) {
      if (typeof window !== 'undefined') {
        const piAuthJustSignedIn = sessionStorage.getItem('piAuthJustSignedIn');
        if (piAuthJustSignedIn === 'true') {
          sessionStorage.removeItem('piAuthJustSignedIn');
          setShouldAutoRefresh(true);
        }
      }
    }
  }, [notFound, profile]);

  useEffect(() => {
    if (shouldAutoRefresh) {
      window.location.reload();
    }
  }, [shouldAutoRefresh]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = isVideoMuted;
    if (!isVideoMuted) {
      videoRef.current.volume = 1;
    }
  }, [isVideoMuted]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 dark:border-t-sky-400 animate-spin"></div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#000000" }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-gray-400">This store doesn't exist or has been removed.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const isValidSocialUrl = (url?: string | null) => {
    if (!url) return false;
    const trimmed = String(url).trim();
    return /^https?:\/\//i.test(trimmed);
  };

  const socialLinksArray = Array.isArray(profile.socialLinks)
    ? profile.socialLinks.filter(link => isDisplayableSocialUrl(link?.url))
    : [];
  const totalSocialFollowers = Array.isArray(profile.socialLinks)
    ? profile.socialLinks.reduce((sum, link) => sum + getSocialFollowerValue(link), 0)
    : 0;
  const displayFollowerCount = totalSocialFollowers > 0 ? totalSocialFollowers : followerCount;
  const shouldUseNativeBackgroundVideo =
    profile.theme.backgroundType === 'video' &&
    !!profile.theme.backgroundVideo &&
    isDirectVideoFileUrl(profile.theme.backgroundVideo);
  const profileShareUrl = `${window.location.origin}/u/${profile.username}`;

  return (
    <div 
      className="min-h-screen w-full max-w-full overflow-x-hidden px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 flex flex-col items-center relative pb-24"
      style={
        profile.theme.backgroundType === 'gif' && profile.theme.backgroundGif
          ? {}
          : { backgroundColor: profile.theme.backgroundColor }
      }
    >
      {/* Pi User Header with Sign Out */}
      {isPiAuthenticated && piUser && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
          <div className="text-white text-sm font-medium">
            @{piUser.username}
          </div>
          <Button
            onClick={async () => {
              await signOut();
              toast.success("Signed out successfully");
              // Reload to update UI
              window.location.reload();
            }}
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 h-8 px-3"
          >
            Sign out
          </Button>
        </div>
      )}
      
      {/* Video Background - lock if expired */}
      {profile.theme.backgroundType === 'video' && profile.theme.backgroundVideo && !isPlanExpired && (
        <div className="fixed inset-0 z-0 w-full max-w-full overflow-hidden">
          <div className="absolute inset-0 w-full h-full">
            {shouldUseNativeBackgroundVideo ? (
              <video
                ref={videoRef}
                src={profile.theme.backgroundVideo}
                autoPlay
                loop
                muted={isVideoMuted}
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                onLoadedData={() => setIsVideoPlaying(true)}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onError={(e) => {
                  console.log('Native background video error', e);
                }}
              />
            ) : (
              <ReactPlayer
                url={profile.theme.backgroundVideo}
                playing={isVideoPlaying}
                loop={true}
                muted={isVideoMuted}
                volume={isVideoMuted ? 0 : 0.6}
                width="100%"
                height="100%"
                className="react-player"
                style={{ position: 'absolute', top: 0, left: 0 }}
                config={{
                  youtube: {
                    playerVars: { showinfo: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, modestbranding: 1 }
                  },
                  vimeo: {
                    playerOptions: { background: 1, controls: false, title: false, byline: false, portrait: false }
                  },
                  file: {
                    attributes: {
                      style: { width: '100%', height: '100%', objectFit: 'cover' },
                      playsInline: true,
                      crossOrigin: 'anonymous',
                    }
                  }
                }}
                onReady={() => console.log('Video background ready')}
                onError={(e) => console.log('Video background error', e)}
              />
            )}
          </div>
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextMuted = !isVideoMuted;
                setIsVideoMuted(nextMuted);
                if (shouldUseNativeBackgroundVideo && videoRef.current) {
                  videoRef.current.muted = nextMuted;
                  videoRef.current.volume = nextMuted ? 0 : 1;
                  if (!nextMuted) {
                    void videoRef.current.play().catch(() => {});
                  }
                } else if (!nextMuted) {
                  setIsVideoPlaying(true);
                }
              }}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 backdrop-blur-sm transition-all"
              title={isVideoMuted ? "Unmute background video" : "Mute background video"}
            >
              {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (shouldUseNativeBackgroundVideo && videoRef.current) {
                  if (isVideoPlaying) {
                    videoRef.current.pause();
                  } else {
                    void videoRef.current.play().catch(() => {});
                  }
                  return;
                }
                setIsVideoPlaying(!isVideoPlaying);
              }}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 backdrop-blur-sm transition-all"
              title={isVideoPlaying ? "Pause background video" : "Play background video"}
            >
              {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      {profile.theme.backgroundType === 'video' && profile.theme.backgroundVideo && isPlanExpired && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
          <span className="text-white text-lg font-semibold">Video background is locked. Renew plan to unlock.</span>
        </div>
      )}

      {/* GIF Background - lock if expired */}
      {profile.theme.backgroundType === 'gif' && profile.theme.backgroundGif && !isPlanExpired && (
        <div className="fixed inset-0 z-0 w-full max-w-full overflow-hidden">
          <img
            src={profile.theme.backgroundGif}
            alt="Background"
            className="w-full h-full object-cover"
            style={{ minHeight: '100vh' }}
            onError={(e) => {
              console.log('GIF background failed to load in PublicBio:', profile.theme.backgroundGif);
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent && parent.parentElement) {
                parent.parentElement.style.backgroundColor = profile.theme.backgroundColor || '#000000';
              }
              // Show fallback message
              const fallback = document.createElement('div');
              fallback.className = 'absolute inset-0 flex items-center justify-center text-white bg-black/60';
              fallback.innerText = 'Failed to load GIF';
              parent?.appendChild(fallback);
            }}
            onLoad={() => {
              console.log('GIF background loaded successfully in PublicBio:', profile.theme.backgroundGif);
            }}
          />
          <div className="absolute inset-0 bg-black/30" /> {/* Overlay for better readability */}
        </div>
      )}
      {profile.theme.backgroundType === 'gif' && profile.theme.backgroundGif && isPlanExpired && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
          <span className="text-white text-lg font-semibold">GIF background is locked. Renew plan to unlock.</span>
        </div>
      )}
      
      <div className="w-full max-w-full sm:max-w-2xl space-y-8 py-12 relative z-10 overflow-x-hidden px-2 sm:px-0">
        <div className="mb-6 flex items-center justify-between gap-3">
          {profile.showShareButton ? (
            <Button
              onClick={() => setShowShareDialog(true)}
              variant="ghost"
              size="icon"
              className="hover:bg-white/10 transition-all duration-200"
            >
              <Share2 className="w-6 h-6 text-white hover:text-cyan-400" />
            </Button>
          ) : (
            <div />
          )}
          {planAllowsPiAds && userPreferences?.store_settings?.showPiAds !== false && (
            piAdsOpen ? (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/90 text-sky-700 hover:bg-white"
                onClick={() => setPiAdsOpen(false)}
              >
                Hide Ads
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:text-white/80 hover:bg-transparent"
                onClick={() => setPiAdsOpen(true)}
              >
                <Zap className="w-5 h-5" />
              </Button>
            )
          )}
        </div>

        {/* Pi AdNetwork logic based on creator's plan and creator preference */}
        {planAllowsPiAds && userPreferences?.store_settings?.showPiAds !== false && piAdsOpen && (
          <div className="mb-6">
            <PiAdsBanner />
            <div className="mt-4">
              <PiAdNetwork />
            </div>
          </div>
        )}
        
        {/* Link.me Style Cover Image - Fixed Background with Fade on Scroll */}
        {profile.theme?.coverImage && (
          <div 
            className="fixed top-0 left-0 w-full max-w-full h-screen overflow-hidden z-0"
            style={{
              opacity: Math.max(0, 1 - scrollY / 300),
              pointerEvents: 'none'
            }}
          >
            <img
              src={profile.theme.coverImage}
              alt="Profile cover"
              className="w-full h-full object-cover"
            />
            {/* Dark overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />
          </div>
        )}
        
        {/* Link.me Style Hero Section */}
        <div className="text-center space-y-4 pt-32 relative z-10 w-full max-w-full overflow-x-hidden">
          {/* Large Profile Image - Positioned on cover */}
          {profile.logo && (
            <div className="flex justify-center mb-4">
              <div 
                className={`relative w-32 h-32 md:w-40 md:h-40 ${getIconStyle(profile.theme.iconStyle)} overflow-hidden shadow-2xl ring-4 ring-white/30`}
                style={{ backgroundColor: profile.theme.primaryColor }}
              >
                <img 
                  src={profile.logo} 
                  alt={profile.businessName}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          
          {/* Name with Badge - Large and Bold */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 flex-wrap px-2">
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white drop-shadow-2xl tracking-tight break-words max-w-full">
                {profile.businessName || profile.username || username || 'user'}
              </h1>
              {profile.isVerified && (
                <img 
                  src={getVerifiedBadgeUrl(profile.username)} 
                  alt="Verified" 
                  className="w-7 h-7 md:w-8 md:h-8 -mt-3" 
                  title="Verified Account"
                />
              )}
            </div>
            
            {/* Username - Right below name */}
            <p className="text-white/80 text-base md:text-lg font-normal">@{profile.username || username || 'user'}</p>
            
            {/* Follower and View Count */}
            <div className="flex items-center justify-center gap-4 pt-2 text-white/70 text-sm">
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
                onClick={handleOpenSocialFollowersModal}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    handleOpenSocialFollowersModal();
                  }
                }}
              >
                <UserPlus className="w-4 h-4" />
                <span>{formatCompactNumber(displayFollowerCount)} Followers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>{formatCompactNumber(visitCount)} Views</span>
              </div>
            </div>
          </div>
          
          {/* Social Links - Compact circular style */}
          {Array.isArray(socialLinksArray) && socialLinksArray.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              {socialLinksArray.map((link) => {
                const platformId = link.platform || link.type || link.icon || "";
                const username = extractSocialUsername(platformId, link.url);
                const followers = Number(link.verified_followers ?? link.followers ?? 0);
                const label = getSocialLabel(platformId);
                const glassMode = profile.theme?.glassMode;
                const bgStyle = glassMode
                  ? {
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      backdropFilter: 'blur(14px)',
                    }
                  : { backgroundColor: profile.theme.primaryColor };

                return (
                  <a
                    key={platformId || link.url}
                    href={typeof link.url === 'string' ? link.url : ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => profileId && handleSocialClick(platformId, profileId)}
                    className="flex flex-col items-center gap-1.5"
                    title={label}
                  >
                    <span
                      className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                      style={bgStyle}
                    >
                      <span className="text-white text-xl">
                        {getSocialIcon(platformId)}
                      </span>
                    </span>
                    <span className="text-[11px] text-white/85 max-w-[90px] truncate">
                      {username ? `@${username}` : label}
                    </span>
                    {followers > 0 && (
                      <span className="text-[10px] text-white/60">
                        {formatCompactNumber(followers)} followers
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
          
          {/* Quick Feed & Message CTA */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 px-4 max-w-full sm:max-w-md mx-auto">
            <Button
              onClick={() => {
                const feedUrl = profile.storeUrl
                  ? `${window.location.origin}/${profile.storeUrl}/feed`
                  : profile.username
                    ? `${window.location.origin}/@${profile.username}/feed`
                    : undefined;
                if (feedUrl) {
                  window.open(feedUrl, "_blank", "noopener,noreferrer");
                }
              }}
              type="button"
              variant="ghost"
              className="gap-2 w-full sm:w-auto text-white/80 hover:text-white border border-white/20 bg-white/0 hover:bg-white/10"
              aria-label="Open profile feed"
              title="Open profile feed"
            >
              <Share2 className="w-4 h-4" />
              Open Feed
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                document
                  .getElementById("social-feed")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="gap-2 w-full sm:w-auto text-white/80 hover:text-white border border-white/20 bg-white/0 hover:bg-white/10"
            >
              <ExternalLink className="w-4 h-4" />
              Jump to Pins
            </Button>
          </div>

          {/* Bio Description */}
          {profile.description && (
            <p className="text-white/90 text-sm md:text-base max-w-lg mx-auto font-light mt-4 px-4 break-words overflow-wrap-anywhere">
              {profile.description}
            </p>
          )}

          {(() => {
            const appLinks = Array.isArray(profile.appLinks) && profile.appLinks.length > 0
              ? profile.appLinks
              : profile.appLink
                ? [{
                    id: "primary",
                    title: profile.appTitle || "Check out my App",
                    url: profile.appLink,
                    logo: profile.appLogo,
                    description: profile.appDescription
                  }]
                : [];
            if (appLinks.length === 0) return null;
            return (
              <div className="max-w-full sm:max-w-2xl mx-auto mt-6 px-4 w-full space-y-4">
                {appLinks.map((link: any) => (
                  <a
                    key={link.id || link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-3xl p-5 sm:p-6 transition-all hover:scale-[1.02]"
                  >
                    {link.logo ? (
                      <img
                        src={link.logo}
                        alt={link.title || "App"}
                        className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Zap className="w-9 h-9 text-white" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <h3 className="text-white font-bold text-xl mb-1 truncate">{link.title || "Check out my App"}</h3>
                      {link.description && (
                        <p className="text-white/80 text-sm mb-2 line-clamp-2">{link.description}</p>
                      )}
                      <span className="text-white/90 text-sm flex items-center gap-1">
                        Open App <ExternalLink className="w-4 h-4" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            );
          })()}
          
          {/* Email Capture / Connect Section */}
          {userPreferences?.store_settings?.showEmailCapture !== false && (
            <div className="max-w-full sm:max-w-md mx-auto mt-6 px-4 w-full">
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!connectEmail || !connectEmail.includes('@')) {
                  toast.error('Please enter a valid email');
                  return;
                }
                if (!profileId) return;
                
                setConnectSubmitting(true);
                try {
                  await captureLead({
                    profile_id: profileId,
                    email: connectEmail,
                    source: 'public_bio',
                    metadata: { source: 'connect_button', captured_from_page: 'public_bio' }
                  });
                  toast.success('✅ Thanks for connecting!');
                  setConnectEmail('');
                } catch (error) {
                  console.error('Connection error:', error);
                  toast.error('Failed to connect. Please try again.');
                } finally {
                  setConnectSubmitting(false);
                }
              }} className="flex items-center gap-2 bg-white rounded-full p-2 shadow-lg w-full">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={connectEmail}
                  onChange={(e) => setConnectEmail(e.target.value)}
                  disabled={connectSubmitting}
                  className="flex-1 px-4 py-2.5 bg-transparent outline-none text-gray-800 placeholder-gray-400 text-base"
                  required
                />
                <button
                  type="submit"
                  disabled={connectSubmitting}
                  className="text-white px-5 py-2.5 rounded-full font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                  style={{ backgroundColor: profile.theme.primaryColor }}
                >
                  <span className="text-sm">{connectSubmitting ? 'Connecting...' : 'Connect'}</span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <UserPlus className="w-3.5 h-3.5" />
                  </div>
                </button>
              </form>
              <p className="text-[11px] sm:text-xs text-white/70 mt-2 text-center">
                By connecting, you agree to receive newsletters and updates from creators you follow.
              </p>
            </div>
          )}

          {/* Background Music Player */}
          {profile.backgroundMusicUrl && profile.backgroundMusicUrl.trim() && (
            <div className="max-w-full sm:max-w-md mx-auto w-full mt-6 px-4">
              <BackgroundMusicPlayer 
                musicUrl={profile.backgroundMusicUrl}
                autoPlay={false}
                loop={true}
              />
            </div>
          )}

          {/* Image Link Cards */}
          {Array.isArray(profile.imageLinkCards) && profile.imageLinkCards.length > 0 && (
            <div className="w-full max-w-full sm:max-w-md mx-auto grid grid-cols-2 gap-3 mt-6 px-2">
              {profile.imageLinkCards.map((card: any) => (
                <a
                  key={card.id}
                  href={card.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  style={{ aspectRatio: '4 / 3' }}
                >
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-semibold text-sm text-center drop-shadow-lg">
                      {card.title}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Primary Action Buttons - Link.me Style */}
          <div className="flex flex-col gap-3 justify-center pt-4 max-w-full sm:max-w-md mx-auto w-full px-2">
            {/* Sign In / Follow Button - Primary CTA */}
            {!currentUserProfileId && isPiAuthenticated === false && typeof window !== 'undefined' && window.Pi ? (
              <Button
                onClick={handlePiSignIn}
                className={`${getIconStyle(profile.theme.iconStyle)} gap-2 w-full py-3 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300`}
                style={{ 
                  backgroundColor: profile.theme.primaryColor,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                }}
              >
                <UserPlus className="w-5 h-5" />
                Sign in to Follow
              </Button>
            ) : currentUserProfileId && currentUserProfileId !== profileId ? (
              <Button
                onClick={handleFollow}
                className={`${getIconStyle(profile.theme.iconStyle)} gap-2 w-full py-3 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300`}
                style={isFollowing ? { 
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: `2px solid ${profile.theme.primaryColor}`,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                } : { 
                  backgroundColor: profile.theme.primaryColor,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                }}
                variant={isFollowing ? "outline" : "default"}
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="w-5 h-5" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Follow
                  </>
                )}
              </Button>
            ) : null}
            
            {/* Gift Button - Secondary CTA */}
            {currentUserProfileId && currentUserProfileId !== profileId && userPreferences?.store_settings?.allowGifts !== false && (
              <Button
                onClick={() => setShowGiftDialog(true)}
                className={`${getIconStyle(profile.theme.iconStyle)} gap-2 w-full py-3 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300`}
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: `2px solid ${profile.theme.primaryColor}`,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                }}
                variant="outline"
              >
                <Gift className="w-5 h-5" />
                Send Gift
              </Button>
            )}
          </div>

          {/* Anonymous Follow Prompt - Only show if not in Pi Browser or not showing sign-in button */}
          {!currentUserProfileId && !(typeof window !== 'undefined' && window.Pi && isPiAuthenticated === false) && (
            <div className="flex justify-center pt-4">
              <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white mb-3">
                  Like this store? Sign up to follow!
                </p>
                <Button
                  onClick={() => {
                    // Redirect to signup
                    handleSignUpToFollow();
                  }}
                  className={`${getIconStyle(profile.theme.iconStyle)} gap-2`}
                  style={{ backgroundColor: profile.theme.primaryColor }}
                >
                  <UserPlus className="w-4 h-4" />
                  {typeof window !== 'undefined' && window.Pi ? 'Sign In with Pi to Follow' : 'Sign Up to Follow'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* YouTube Video */}
        {profile.youtubeVideoUrl && extractYouTubeVideoId(profile.youtubeVideoUrl) && (
          <div className="w-full max-w-full sm:max-w-2xl px-4">
            <div className="bg-transparent border border-white/20 rounded-xl backdrop-blur-sm overflow-hidden p-3">
              <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-lg">
                <iframe
                  src={`https://www.youtube.com/embed/${extractYouTubeVideoId(profile.youtubeVideoUrl)}`}
                  className="absolute top-0 left-0 w-full h-full border border-white/10 rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube video"
                />
              </div>
            </div>
          </div>
        )}

        {/* Social Feed & Pinned Posts */}
        <div id="social-feed" className="w-full max-w-full sm:max-w-2xl px-4">
          <div className="flex flex-col gap-1 mb-4">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">Social Feed</h2>
            <p className="text-white/70 text-sm">Pinned posts, embeds, and recent drops</p>
          </div>

          {socialFeedItems.length === 0 ? (
            <div className="border border-dashed border-white/20 rounded-xl p-4 text-center text-white/70 bg-white/5">
              No pinned social posts yet.
            </div>
          ) : (
            <div className="space-y-3">
              {socialFeedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/15 bg-black/30 backdrop-blur-sm p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white text-xl">
                      {getSocialIcon(item.platform || 'link')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80">{item.platform || 'Social'}</p>
                      <p className="text-white font-semibold truncate">{item.title || 'Pinned post'}</p>
                    </div>
                    {item.pinned && (
                      <span className="text-xs px-2 py-1 rounded-full bg-white/15 text-white/80 border border-white/20">Pinned</span>
                    )}
                  </div>

                  {item.embedHtml ? (
                    <div
                      className="rounded-lg overflow-hidden bg-white/5 border border-white/10 w-full max-w-full"
                      dangerouslySetInnerHTML={{ __html: item.embedHtml }}
                    />
                  ) : (
                    <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      {item.thumbnail && (
                         <img
                           src={item.thumbnail}
                           alt={item.title || 'Pinned post'}
                           className="w-full h-48 object-cover cursor-pointer"
                           onClick={() => {
                             if (item.url) {
                               window.open(item.url, '_blank', 'noopener,noreferrer');
                             }
                           }}
                         />
                       )}
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div className="text-white/80 text-sm truncate">
                          {item.url || 'No link available'}
                        </div>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${getIconStyle(profile.theme.iconStyle)} px-3 py-2 text-white text-sm rounded-lg`}
                            style={{ backgroundColor: profile.theme.primaryColor }}
                          >
                            Open
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom Links - Link.me Style */}
        {Array.isArray(profile.customLinks) && profile.customLinks.length > 0 && (
          <div className="space-y-3 max-w-full sm:max-w-md mx-auto w-full pt-4 px-2">
            {profile.customLinks.map((link) => {
              const buttonStyles = getButtonStyles(profile.theme.primaryColor, profile.theme.buttonStyle, profile.theme?.glassMode);
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-3 w-full py-4 px-6 ${getIconStyle(profile.theme.iconStyle)} font-semibold text-white transition-all hover:shadow-xl hover:scale-105 shadow-lg break-words overflow-wrap-anywhere`}
                  style={buttonStyles}
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>{link.title}</span>
                </a>
              );
            })}
          </div>
        )}

        {/* Products - Professional Showcase */}
        {Array.isArray(profile.products) && profile.products.length > 0 && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <h2 className="text-2xl font-bold text-white text-center mb-8 drop-shadow-lg">
              📦 Digital Products
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-full sm:max-w-2xl mx-auto px-2">
              {profile.products.map((product) => (
                <div
                  key={product.id}
                  className="p-6 rounded-2xl border backdrop-blur-sm hover:border-white/40 hover:bg-white/10 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  style={{ 
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderColor: "rgba(255, 255, 255, 0.1)"
                  }}
                >
                  <div className="flex flex-col h-full">
                    <h3 className="text-lg font-bold text-white mb-2 break-words overflow-wrap-anywhere">
                      {product.title}
                    </h3>
                    {product.description && (
                      <p className="text-white/80 text-sm mb-4 flex-grow break-words">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <p 
                        className="text-2xl font-bold"
                        style={{ color: profile.theme.primaryColor }}
                      >
                        {product.price}
                      </p>
                      {product.fileUrl && (
                        <a
                          href={product.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => profileId && handleProductClick(product.id, product.title, profileId)}
                          className={`px-4 py-2 ${getIconStyle(profile.theme.iconStyle)} font-semibold text-white text-sm transition-all hover:shadow-lg shadow-md`}
                          style={{ backgroundColor: profile.theme.primaryColor }}
                        >
                          Get Now
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Donation Wallets - Professional Section */}
        {(Array.isArray(profile.wallets?.crypto) && profile.wallets.crypto.length > 0 || Array.isArray(profile.wallets?.bank) && profile.wallets.bank.length > 0) && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <h2 className="text-2xl font-bold text-white text-center mb-8 flex items-center justify-center gap-2 drop-shadow-lg">
              <Wallet className="w-6 h-6" />
              Support & Donations
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-full sm:max-w-2xl mx-auto px-2">
              {Array.isArray(profile.wallets?.crypto) && profile.wallets.crypto.length > 0 && (
                <div className="space-y-3">
                  <p className="text-white/80 text-sm text-center font-semibold mb-3">💰 Crypto Wallets</p>
                  {profile.wallets.crypto.map((wallet) => (
                     <button
                       key={wallet.id}
                       onClick={() => handleWalletClick('crypto', wallet.name, wallet.address)}
                       className={`w-full p-4 ${getIconStyle(profile.theme.iconStyle)} border rounded-xl backdrop-blur-sm transition-all hover:shadow-lg hover:scale-105 shadow-md`}
                       style={{ 
                         borderColor: profile.theme.primaryColor,
                         backgroundColor: 'rgba(255, 255, 255, 0.05)'
                       }}
                     >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold text-left flex-1 break-words overflow-wrap-anywhere pr-2">{wallet.name}</span>
                        <span className="text-white/70 text-xs">QR Code</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {Array.isArray(profile.wallets?.bank) && profile.wallets.bank.length > 0 && (
                <div className="space-y-3">
                  <p className="text-white/80 text-sm text-center font-semibold mb-3">🏦 Bank Accounts</p>
                  {profile.wallets.bank.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleWalletClick('bank', account.bankName, account.details)}
                      className={`w-full p-4 ${getIconStyle(profile.theme.iconStyle)} border rounded-xl backdrop-blur-sm transition-all hover:shadow-lg hover:scale-105 shadow-md`}
                      style={{ 
                        borderColor: profile.theme.primaryColor,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold text-left flex-1 break-words overflow-wrap-anywhere pr-2">{account.bankName}</span>
                        <span className="text-white/70 text-xs">Details</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pi Wallet Tips - show only if enabled AND wallet is set */}
        {/* Pi Wallet Tips - lock if expired */}
        {profile.piWalletAddress && profile.showPiWalletTips !== false && !isPlanExpired && (
          <div className="space-y-4 w-full max-w-full sm:max-w-2xl px-2 sm:px-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white text-center mb-6 flex flex-wrap items-center justify-center gap-2 px-2">
              <Wallet className="w-5 h-5 text-blue-400" />
              Receive DROP or Pi Tips
              {isMobile ? (
                <>
                  <Info
                    className="w-4 h-4 text-blue-300 cursor-pointer ml-2"
                    onClick={() => setShowPiWalletTip(true)}
                  />
                  <Dialog open={showPiWalletTip} onOpenChange={setShowPiWalletTip}>
                    <DialogContent className="max-w-xs w-full">
                      <DialogHeader>
                        <DialogTitle>About DROP Tips</DialogTitle>
                      </DialogHeader>
                      <div className="text-center text-blue-100 text-xs leading-snug">
                        DROP is the utility token for DropLink. Send only Pi Network DROP tokens to this address.<br /><br />You can copy or scan the QR code below.
                      </div>
                      <div className="flex justify-center mt-4">
                        <Button onClick={() => setShowPiWalletTip(false)} className="bg-blue-500 text-white w-full">Close</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <span className="relative group ml-2">
                  <Info className="w-4 h-4 text-blue-300 cursor-pointer" />
                  <span
                    className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 max-w-[90vw] bg-blue-900 text-white text-xs sm:text-sm rounded p-3 sm:p-4 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center text-center"
                    style={{ minWidth: '180px', maxWidth: 'calc(90vw - 2rem)', wordBreak: 'break-word' }}
                  >
                    <span className="w-full block text-center leading-snug">
                      DROP is the utility token for DropLink. Send only Pi Network DROP tokens to this address.<br /><br />You can copy or scan the QR code below.
                    </span>
                  </span>
                </span>
              )}
            </h2>
            <div className="text-center space-y-4">
              {profile.piWalletAddress ? (
                <div>
                  {/* Instructional Example Dialog Note */}
                  <div className="bg-blue-900/80 rounded-lg border border-blue-400/30 p-4 mb-4 text-center">
                    <div className="text-blue-200 font-semibold mb-1">Example: How to Send DROP Tokens</div>
                    <div className="text-blue-100 text-sm mb-2">This is an example dialog to help you understand how to send DROP tokens using the Pi Network Wallet. Follow the instructions below to complete your transaction.</div>
                  </div>
                  <div className="bg-blue-500/20 backdrop-blur rounded-lg border border-blue-400/30 p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Wallet className="w-5 h-5 text-blue-400" />
                      <span className="text-blue-300 font-medium">Pi Network Wallet</span>
                    </div>
                    <p className="text-white text-sm mb-4">{profile.piDonationMessage || "Send me DROP tokens on Pi Network!"}</p>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-4 mb-4">
                      {/* Inline QR code for wallet address */}
                      <div className="flex flex-col items-center">
                        <div className="relative w-[96px] h-[96px]">
                          <QRCodeSVG value={profile.piWalletAddress} size={96} bgColor="#fff" fgColor="#2563eb" />
                          <img
                            src="https://i.ibb.co/1fdJky1d/Gemini-Generated-Image-ar8t52ar8t52ar8t.png"
                            alt="Droplink Logo"
                            className="absolute left-1/2 top-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 z-10 shadow-lg border-2 border-white bg-white rounded-lg"
                            style={{ pointerEvents: 'none' }}
                          />
                        </div>
                        <span className="text-xs text-blue-400 mt-1">Scan to send DROP</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-2 items-center justify-center">
                        <input
                          type="text"
                          value={profile.piWalletAddress}
                          readOnly
                          className="w-full bg-black/50 border border-blue-400/30 rounded px-3 py-2 text-white text-xs font-mono break-all overflow-hidden"
                        />
                        <div className="flex flex-wrap gap-2 w-full justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(profile.piWalletAddress!);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                              toast.success("Wallet address copied!");
                            }}
                            className="border-blue-400/30 text-blue-300 hover:bg-blue-500/20"
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            <span className="ml-1">Copy</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const shareUrl = `${window.location.origin}/pay/${profile.piWalletAddress}`;
                              navigator.clipboard.writeText(shareUrl);
                              toast.success("Shareable wallet link copied!");
                            }}
                            className="border-blue-400/30 text-blue-300 hover:bg-blue-500/20"
                          >
                            <Share2 className="w-4 h-4" />
                            <span className="ml-1">Share Wallet</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                    {/* Pay with Pi Button */}
                    <div className="flex flex-col items-center gap-2 mt-4">
                      <Button
                        className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-6 py-2 rounded-full shadow-lg"
                        onClick={() => setShowPiPaymentDialog(true)}
                      >
                        Pay with Pi
                      </Button>
                      <Button
                        variant="outline"
                        className="text-blue-600 border-blue-400 hover:bg-blue-50 mt-2"
                        onClick={() => navigate('/dashboard')}
                      >
                        Go to Dashboard
                      </Button>
                    </div>
                    {/* Example instructions for sending DROP tokens */}
                    <div className="bg-blue-100/30 rounded-lg p-3 mt-2 text-xs text-blue-900 text-left">
                      <div className="font-semibold mb-1">How to send DROP tokens:</div>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Open your Pi Wallet app</li>
                        <li>Scan this QR code or enter the address</li>
                        <li>Enter the amount of DROP tokens to send</li>
                        <li>Confirm the transaction</li>
                      </ol>
                    </div>
                  </div>
                  {/* Pi Payment Dialog */}
                  <PiPaymentDialog
                    open={showPiPaymentDialog}
                    onOpenChange={setShowPiPaymentDialog}
                    walletAddress={profile.piWalletAddress}
                    loading={piPaymentLoading}
                    onSubmit={async (amount, message) => {
                      setPiPaymentLoading(true);
                      try {
                        // Memo can include the message and receiver info
                        const memo = message ? `${message}` : "";
                        const metadata = {
                          receiverWallet: profile.piWalletAddress,
                          receiverUsername: profile.username,
                          senderUsername: piUser?.username || undefined,
                          publicBio: true
                        };
                        const txid = await createPayment(Number(amount), memo, metadata);
                        if (txid) {
                          toast.success(`Payment of ${amount} Pi sent!`, { description: `Transaction: ${txid.substring(0, 16)}...` });
                          setShowPiPaymentDialog(false);
                        } else {
                          toast.error("Payment was not completed.");
                        }
                      } catch (err) {
                        toast.error("Payment failed", { description: err instanceof Error ? err.message : String(err) });
                      } finally {
                        setPiPaymentLoading(false);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="bg-blue-500/10 rounded-lg border border-blue-400/10 p-6 text-center text-white">
                  <Wallet className="w-6 h-6 text-blue-300 mx-auto mb-2" />
                  <div className="text-blue-200 font-semibold mb-1">No Pi Network Wallet Set</div>
                  <div className="text-blue-100 text-sm mb-2">The profile owner has not set a Pi wallet address yet.</div>
                  <div className="text-xs text-blue-300">Once a wallet is set in the dashboard, it will appear here for tips and DROP tokens.</div>
                </div>
              )}
            </div>
          </div>

        )}

        {profile && profile.showPiWalletTips !== false && isPlanExpired && (
          <div className="bg-blue-900/80 rounded-lg border border-blue-400/30 p-6 text-center my-6 text-white">
            <Wallet className="w-6 h-6 text-blue-300 mx-auto mb-2" />
            <div className="text-blue-200 font-semibold mb-1">Pi Tips are locked</div>
            <div className="text-blue-100 text-sm mb-2">This feature is locked because the plan has expired. Renew to unlock Pi Tips.</div>
          </div>
        )}


        {/* Email Capture Block - from monetization */}
        {products && products.length > 0 && (
          <EmailCaptureDisplay
            title="Get Exclusive Updates"
            description="Subscribe to stay in the loop"
            onSubmit={async (email) => {
              if (profileId) {
                await captureLead({
                  profile_id: profileId,
                  email,
                  source: 'capture_block',
                  metadata: {}
                });
                toast.success('Thanks for subscribing!');
              }
            }}
          />
        )}

        {/* Membership Tiers - from monetization */}
        {tiers && tiers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">Membership Tiers</h2>
            <div className="grid gap-4">
              {tiers.map((tier) => (
                <MembershipGate
                  key={tier.id}
                  requiredTier={tier}
                  hasAccess={false}
                  onUnlock={async () => {
                    if (profileId) {
                      try {
                        await createOrder({
                          profile_id: profileId,
                          product_id: tier.id,
                          buyer_email: piUser?.username || 'unknown@droplink.io',
                          amount: tier.price,
                          currency: 'PI',
                          status: 'pending',
                          metadata: { tier_id: tier.id }
                        });
                        toast.success(`Welcome to ${tier.name}!`);
                      } catch (error) {
                        console.error('Failed to create membership:', error);
                        toast.error('Failed to create membership');
                      }
                    }
                  }}
                >
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-slate-300">Unlock this tier to see exclusive content</p>
                  </div>
                </MembershipGate>
              ))}
            </div>
          </div>
        )}

        {/* Followers Section */}
        {profileId && userPreferences?.store_settings?.showCommunitySection !== false && (
          <FollowersSection 
            profileId={profileId} 
            currentUserProfileId={currentUserProfileId || undefined}
          />
        )}

        {/* Message Input Section - Only for followers */}
        {userPreferences?.store_settings?.showCommunitySection !== false && userPreferences?.store_settings?.showMessageForm !== false && currentUserProfileId && currentUserProfileId !== profileId && (
          <div className="mt-8">
            {/* Use the Pi payment + message form */}
            <PublicBioMessageForm 
              receiverUsername={profile.username}
              receiverProfileId={profileId || ''}
              senderUsername={piUser?.username || ''}
              senderProfileId={currentUserProfileId || undefined}
            />
          </div>
        )}

        {/* Report Button in Footer */}
        <div className="text-center py-6">
          <button
            className="bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 rounded-full p-3 shadow-lg border border-red-400/40 inline-flex items-center gap-2 px-6 transition-all duration-200 backdrop-blur"
            title="Report unwanted content"
            onClick={() => setShowReportModal(true)}
          >
            <Flag className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300 font-semibold">Report Unwanted Content</span>
          </button>
        </div>

        {/* Droplink Branding Footer */}
        {!profile.hasPremium && (
          <div className="text-center py-6">
            <button
              onClick={() => window.location.href = 'https://www.droplink.space'}
              className="text-white/70 text-xs font-semibold hover:text-cyan-400 transition-all duration-200 cursor-pointer group"
            >
              JOIN <span className="text-cyan-400 group-hover:text-cyan-300">DROPLINK</span> BY <span className="text-white/80">MRWAIN ORGANIZATION</span>
            </button>
          </div>
        )}

        {/* Footer Links */}
        <div className="text-center py-4">
          <div className="flex flex-wrap justify-center gap-2 text-xs text-white/60">
            <a
              href="https://www.droplink.space/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/80 transition-colors"
            >
              Cookie Preferences
            </a>
            <span>·</span>
            <button
              onClick={() => setShowReportModal(true)}
              className="hover:text-white/80 transition-colors"
            >
              Report
            </button>
            <span>·</span>
            <button
              onClick={() => navigate('/privacy')}
              className="hover:text-white/80 transition-colors"
            >
              Privacy
            </button>
            <span>·</span>
            <button
              onClick={() => navigate('/terms')}
              className="hover:text-white/80 transition-colors"
            >
              Terms
            </button>
            <span>·</span>
            <button
              onClick={() => navigate('/search-users')}
              className="hover:text-white/80 transition-colors"
            >
              Explore other Droplink
            </button>
          </div>
        </div>
      </div>

      <Dialog open={showSocialFollowersModal} onOpenChange={setShowSocialFollowersModal}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Social Followers</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {socialFollowersLoading && (
              <div className="text-sm text-muted-foreground">Fetching verified follower counts...</div>
            )}
            {socialFollowersLinks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No social profiles connected.</div>
            ) : (
              <div className="space-y-2">
                {socialFollowersLinks.map((link, index) => {
                  const platform = link.platform || link.type || "social";
                  const followerValue = getSocialFollowerValue(link);
                  return (
                    <div
                      key={`${platform}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          {getSocialIcon(platform)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {formatPlatformLabel(platform)}
                          </div>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-600 truncate block"
                          >
                            {link.url}
                          </a>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          {formatCompactNumber(followerValue)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {link.is_verified ? "Verified" : "Estimated"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet Details Dialog */}
      <Dialog open={showWalletDialog} onOpenChange={setShowWalletDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              {selectedWallet?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedWallet?.type === 'crypto' && (
              <div className="flex justify-center p-4 bg-white rounded-lg relative">
                <QRCodeSVG value={selectedWallet.value} size={200} />
                <img
                  src="https://i.ibb.co/1fdJky1d/Gemini-Generated-Image-ar8t52ar8t52ar8t.png"
                  alt="Droplink Logo"
                  className="absolute left-1/2 top-1/2 w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-lg"
                  style={{ pointerEvents: 'none', background: 'white' }}
                />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {selectedWallet?.type === 'crypto' ? 'Wallet Address' : 'Account Details'}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedWallet?.value || ''}
                  readOnly
                  className="flex-1 px-3 py-2 bg-muted rounded-md text-sm"
                />
                <Button size="sm" onClick={handleCopyWallet}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Profile Modal - HeroUI Style */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px] md:max-w-[550px] rounded-xl overflow-visible p-6">
          {/* Header with Icon */}
          <div className="flex items-center gap-3 mb-6 mt-2">
            <div className="bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 p-3 rounded-lg">
              <Share2 className="size-5" />
            </div>
            <DialogTitle className="text-xl font-semibold">Share Profile</DialogTitle>
          </div>
          
          {/* Body Content */}
          <div className="space-y-6 py-2">
            {/* Virtual Card Display - Full Size */}
            <div className="w-full">
              <VirtualCard
                username={profile.username}
                storeUrl={profileShareUrl}
                frontColor={profile.card_front_color || "#2bbdee"}
                backColor={profile.card_back_color || "#2bbdee"}
                textColor={profile.card_text_color || "#000000"}
                accentColor={profile.card_accent_color || "#fafafa"}
              />
            </div>
          </div>
          
          {/* Footer with Action Button */}
          <div className="flex gap-2 justify-end border-t pt-4 mt-4">
            <Button
              className="w-full bg-sky-500 hover:bg-sky-600 text-white h-11"
              onClick={() => {
                navigator.clipboard.writeText(profileShareUrl);
                toast.success("Profile link copied!");
                setShowShareDialog(false);
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Profile Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gift Dialog */}
      {profileId && currentUserProfileId && (
        <GiftDialog
          open={showGiftDialog}
          onOpenChange={setShowGiftDialog}
          receiverProfileId={profileId}
          senderProfileId={currentUserProfileId}
          receiverName={profile.businessName}
        />
      )}

      {/* Pi Wallet Tip Dialog */}
      {profile && (
        <Dialog open={showPiWalletTip} onOpenChange={setShowPiWalletTip}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-500" />
                Send DROP Tokens
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  {profile.piDonationMessage || "Scan QR code to send DROP tokens"}
                </p>
                <p className="text-xs text-blue-600 mb-4">Pi Network Blockchain</p>
              </div>
              
              <div className="flex justify-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="relative w-[200px] h-[200px]">
                  <QRCodeSVG 
                    value={profile.piWalletAddress || ''} 
                    size={200}
                    bgColor="#f8fafc"
                    fgColor="#1e40af"
                  />
                  <img
                    src="https://i.ibb.co/1fdJky1d/Gemini-Generated-Image-ar8t52ar8t52ar8t.png"
                    alt="Droplink Logo"
                    className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 z-10 shadow-lg border-2 border-white bg-white rounded-lg"
                    style={{ pointerEvents: 'none' }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pi Network Wallet Address</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profile.piWalletAddress || ''}
                    readOnly
                    className="flex-1 px-3 py-2 bg-muted rounded-md text-xs font-mono"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => {
                      navigator.clipboard.writeText(profile.piWalletAddress || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast.success("Address copied!");
                    }}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-xs text-blue-800">
                    <p className="font-medium mb-1">How to send DROP tokens:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Open your Pi Wallet app</li>
                      <li>Scan this QR code or enter the address</li>
                      <li>Enter the amount of DROP tokens to send</li>
                      <li>Confirm the transaction</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* AI Chat Widget */}
      {profileId && <AIChatWidget profileId={profileId} />}
      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-xs w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowReportModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-3">
              <Flag className="w-8 h-8 text-red-500 mb-2" />
              <h2 className="text-lg font-bold text-red-600">Report Unwanted Content</h2>
              <p className="text-sm text-gray-700 text-center mb-2">If you see inappropriate, abusive, or unwanted content on this profile, please report it. Your feedback helps keep Droplink safe for everyone.</p>
              <a
                href="https://www.droplink.space/report-abuse"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold shadow hover:bg-red-600 transition"
              >
                Go to Report Page
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicBio;




