import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import DashboardProfilePage from "./pages/dashboard/DashboardProfilePage";
import DashboardDesignPage from "./pages/dashboard/DashboardDesignPage";
import DashboardAnalyticsPage from "./pages/dashboard/DashboardAnalyticsPage";
import DashboardAdNetworkPage from "./pages/dashboard/DashboardAdNetworkPage";
import DashboardMonetizationPage from "./pages/dashboard/DashboardMonetizationPage";
import DashboardMembershipsPage from "./pages/dashboard/DashboardMembershipsPage";
import DashboardSubscriptionPage from "./pages/dashboard/DashboardSubscriptionPage";
import DashboardPreferencesPage from "./pages/dashboard/DashboardPreferencesPage";
import UserSearchPage from "./pages/UserSearchPage";
import SwitchToMerchant from "./pages/SwitchToMerchant";
import MerchantStoreSetup from "./pages/MerchantStoreSetup";
import MerchantProductManager from "./pages/MerchantProductManager";
import MerchantStorePreview from "./pages/MerchantStorePreview";
import StoreFront from "./pages/StoreFront";
import PublicBio from "./pages/PublicBio";
import ProfileFeed from "./pages/ProfileFeed";
import PaymentPage from "./pages/PaymentPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import NotFound from "./pages/NotFound";
import Subscription from "./pages/Subscription";
import Followers from "./pages/Followers";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import AISupport from "./pages/AISupport";
import PiAuth from "./pages/PiAuth";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import CustomDomain from "./pages/CustomDomain";
import VotingPage from "./pages/VotingPage";
// import ProfileDebug from "./pages/ProfileDebug";
import Home from "./pages/Home";
import SplashScreen from "./components/SplashScreen";
import InboxPage from "./pages/Inbox";
import Chat from "./pages/Chat";
import GroupChatPage from "./pages/GroupChatPage";
import AdminMrwain from "./pages/AdminMrwain";
import EmailAuth from "./pages/EmailAuth";
import Purchases from "./pages/Purchases";
import AffiliateProgram from "./pages/AffiliateProgram";
import ProductDetail from "./pages/ProductDetail";
import SalesEarnings from "./pages/SalesEarnings";
import CardGenerator from "./pages/CardGenerator";
import PageLayout from "./components/PageLayout";
import CommunityProgram from "./pages/CommunityProgram";

const queryClient = new QueryClient();

// Inner component that can use useLocation hook
const AppRoutes = ({ showSplash, setShowSplash }: { showSplash: boolean; setShowSplash: (value: boolean) => void }) => {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = location.pathname;
    const isDashboardRoute = (path: string | null) =>
      Boolean(path && (path === "/" || path.startsWith("/dashboard")));
    const getPublicProfileKey = (path: string | null) => {
      if (!path) return null;
      const uMatch = path.match(/^\/u\/([^/]+)(\/feed)?$/);
      if (uMatch) return `u:${uMatch[1]}`;
      const profileMatch = path.match(/^\/profile\/([^/]+)(\/feed)?$/);
      if (profileMatch) return `profile:${profileMatch[1]}`;
      const atMatch = path.match(/^\/@([^/]+)(\/feed)?$/);
      if (atMatch) return `at:${atMatch[1]}`;
      return null;
    };

    if (previousPath && isDashboardRoute(previousPath) && isDashboardRoute(currentPath)) {
      setShowSplash(false);
      previousPathRef.current = currentPath;
      return;
    }

    if (!previousPath && isDashboardRoute(currentPath)) {
      setShowSplash(false);
      previousPathRef.current = currentPath;
      return;
    }

    const previousProfileKey = getPublicProfileKey(previousPath);
    const currentProfileKey = getPublicProfileKey(currentPath);
    if (previousProfileKey && currentProfileKey && previousProfileKey === currentProfileKey) {
      setShowSplash(false);
      previousPathRef.current = currentPath;
      return;
    }

    // Show splash when route changes
    setShowSplash(true);
    // Hide splash after short delay to show content
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    previousPathRef.current = currentPath;

    return () => clearTimeout(timer);
  }, [location.pathname, setShowSplash]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.995, filter: "blur(6px)" }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 1.002, filter: "blur(3px)" }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <Routes location={location}>
          {/* Global layout applying Dashboard background */}
          <Route element={<PageLayout />}>
            <Route path="/" element={<DashboardProfilePage />} />
            <Route path="/dashboard" element={<DashboardProfilePage />} />
            <Route path="/dashboard/profile" element={<DashboardProfilePage />} />
            <Route path="/dashboard/design" element={<DashboardDesignPage />} />
            <Route path="/dashboard/analytics" element={<DashboardAnalyticsPage />} />
            <Route path="/dashboard/ad-network" element={<DashboardAdNetworkPage />} />
            <Route path="/dashboard/monetization" element={<DashboardMonetizationPage />} />
            <Route path="/dashboard/memberships" element={<DashboardMembershipsPage />} />
            <Route path="/dashboard/subscription" element={<DashboardSubscriptionPage />} />
            <Route path="/dashboard/preferences" element={<DashboardPreferencesPage />} />
            <Route path="/dashboard/payments" element={<Dashboard initialTab="payments" hideTabNavigation />} />
            <Route path="/home" element={<Home />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/voting" element={<VotingPage />} />
            <Route path="/followers" element={<Followers />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/card-generator" element={<CardGenerator />} />
            <Route path="/ai-support" element={<AISupport />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/domain" element={<CustomDomain />} />
            <Route path="/admin-mrwain" element={<AdminMrwain />} />
            {/* Payment routes */}
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancel" element={<PaymentCancel />} />
            <Route path="/pay/:linkId" element={<PaymentPage />} />
            <Route path="/search-users" element={<UserSearchPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/switch-to-merchant" element={<SwitchToMerchant />} />
            <Route path="/merchant-setup" element={<MerchantStoreSetup />} />
            <Route path="/merchant-products" element={<MerchantProductManager />} />
            <Route path="/store/:merchantId" element={<MerchantStorePreview />} />
            <Route path="/storefront/:storeId" element={<StoreFront />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/chat/:username" element={<Chat />} />
            <Route path="/chat/g/:groupId" element={<GroupChatPage />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/affiliate-program" element={<AffiliateProgram />} />
            <Route path="/ambassador-program" element={<CommunityProgram role="ambassador" />} />
            <Route path="/moderator-program" element={<CommunityProgram role="moderator" />} />
            <Route path="/sales-earnings" element={<SalesEarnings />} />
            <Route path="/product/:productId" element={<ProductDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          {/* Public Bio routes excluded from global layout */}
          <Route path="/auth" element={<PiAuth />} />
          <Route path="/login" element={<EmailAuth />} />
          <Route path="/email-auth" element={<EmailAuth />} />
          {/* Public bio + feed routes */}
          <Route path="/u/:username" element={<PublicBio />} />
          <Route path="/profile/:username" element={<PublicBio />} />
          <Route path="/@:username" element={<PublicBio />} />
          <Route path="/@:username/feed" element={<ProfileFeed />} />
          <Route path="/u/:username/feed" element={<ProfileFeed />} />
          <Route path="/profile/:username/feed" element={<ProfileFeed />} />
          <Route path=":username/feed" element={<ProfileFeed />} />
          <Route path=":username" element={<PublicBio />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Hide initial splash after short delay
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <div className="min-h-screen bg-gray-100 dark:bg-neutral-900">
            <div className="w-full min-h-screen bg-background relative overflow-x-hidden">
              <Toaster />
              <Sonner />
              <AppRoutes showSplash={showSplash} setShowSplash={setShowSplash} />
            </div>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
