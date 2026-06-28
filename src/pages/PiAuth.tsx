import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AboutModal } from "@/components/AboutModal";
import { LicenseModal } from "@/components/LicenseModal";
import { MerchantConfigModal } from "@/components/MerchantConfigModal";
import { PiDomainModal } from "@/components/PiDomainModal";
import { DropPayModal } from "@/components/DropPayModal";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { usePi } from "@/contexts/PiContext";
import { validatePiEnvironment } from "@/utils/pi-env-check";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PiAuth = () => {
  const [showPiBrowserNotice, setShowPiBrowserNotice] = useState(false);
  const [showEcosystemModal, setShowEcosystemModal] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { preferences, updatePreference } = useUserPreferences();
  const { signIn, isAuthenticated, loading: piLoading } = usePi();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate("/", { replace: true });
      }
    };
    
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handlePiSignIn = async () => {
    const isBusy = loading || piLoading;
    if (isBusy) return;

    setLoading(true);
    try {
      // Optional: Validate Pi environment (non-blocking)
      try {
        await validatePiEnvironment();
        console.log('[AUTH] Pi environment validation passed');
      } catch (validationError) {
        console.warn('[AUTH] Pi environment validation warnings (non-blocking):', validationError);
        // Don't throw - validation warnings should not block authentication
      }
      
      // Attempt Pi sign in - SDK will handle Pi Browser check
      await signIn();
      sessionStorage.setItem("piAuthJustSignedIn", "true");
      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("Pi sign in error:", error);
      
      // Check if error is related to Pi Browser requirement
      const errorMsg = String(error?.message || error).toLowerCase();
      const isPiBrowserError = errorMsg.includes("pi browser") || 
                              errorMsg.includes("not in pi") || 
                              errorMsg.includes("pi sdk");
      
      if (isPiBrowserError) {
        setShowPiBrowserNotice(true);
        toast.error("Pi Browser Required", {
          description: "This app only works in the official Pi Browser app",
          duration: 8000,
        });
      } else {
        toast.error("Authentication failed", {
          description: error?.message || "Please try again",
          duration: 6000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-400 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-sky-400 flex items-center justify-center p-4 relative overflow-hidden">

      <Card className="w-full max-w-md relative z-10">
        {/* Pi Browser Notice */}
        {showPiBrowserNotice && (
          <div className="p-3 mb-4 rounded-lg bg-red-100 border border-red-400 text-red-700 text-sm">
            <b>Pi Browser Required:</b> To sign in with Pi Network, please use the official Pi Browser.<br />
            <a href="https://minepi.com/Wain2020" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 font-semibold">Download Pi Browser</a>
          </div>
        )}
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="https://i.ibb.co/67KHWdv9/Add-a-subheading-2-removebg-preview.png" 
              alt="Droplink" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <CardTitle className="text-2xl">
            <span>Welcome to Droplink</span>
          </CardTitle>
          <CardDescription>
            Sign in with Pi Network to create your personal page, sell digital products, and accept Pi payments
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Pi Network Sign In - Center Button */}
          <Button 
            onClick={handlePiSignIn} 
            className="w-full text-white text-lg font-semibold py-6 bg-sky-500 hover:bg-sky-600"
            size="lg"
            disabled={loading || piLoading}
          >
            {loading || piLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Sign in with Pi Network"
            )}
          </Button>

          {/* Go to Landing Page Button */}
          <Button
            asChild
            className="w-full mb-2 text-white text-base font-semibold py-5 bg-slate-500 hover:bg-slate-600"
            size="lg"
            variant="default"
          >
            <a href="https://www.droplink.space" target="_blank" rel="noopener noreferrer">
              Visit Droplink Landing Page
            </a>
          </Button>

          {/* Droplink Social Button */}
          <Button
            asChild
            className="w-full mb-2 text-white text-base font-semibold bg-slate-600 hover:bg-slate-700"
            size="lg"
            variant="default"
          >
            <a href="/search-users">
              Droplink Community
            </a>
          </Button>

          {/* Download Pi Browser Button */}
          <Button
            asChild
            className="w-full mb-2 text-white text-base font-semibold bg-slate-700 hover:bg-slate-800"
            size="lg"
            variant="default"
          >
            <a href="https://minepi.com/Wain2020" target="_blank" rel="noopener noreferrer">
              Download Pi Browser
            </a>
          </Button>

          <div className="space-y-2 text-sm text-muted-foreground mt-4 p-3 rounded-lg border bg-slate-100 border-slate-300">
            <p className="flex items-center gap-2">
              <span className="text-sky-500">✓</span>
              Create your personalized link-in-bio page
            </p>
            <p className="flex items-center gap-2">
              <span className="text-sky-500">✓</span>
              Sell digital products and accept Pi payments
            </p>
            <p className="flex items-center gap-2">
              <span className="text-sky-500">✓</span>
              Connect all your social media in one place
            </p>
            <p className="flex items-center gap-2">
              <span className="text-sky-500">✓</span>
              Your data persists across sessions with Pi authentication
            </p>
          </div>

          <div className="pt-4 border-t space-y-3 p-3 rounded-lg bg-slate-50">
            <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
              <AboutModal>
                <button className="hover:underline cursor-pointer text-slate-700 hover:text-slate-800">
                  About
                </button>
              </AboutModal>
              <span className="text-muted-foreground">•</span>
              <LicenseModal>
                <button className="text-primary hover:underline cursor-pointer">License</button>
              </LicenseModal>
              <span className="text-muted-foreground">•</span>
              <MerchantConfigModal>
                <button className="text-primary hover:underline cursor-pointer">Merchant</button>
              </MerchantConfigModal>
              <span className="text-muted-foreground">•</span>
              <PiDomainModal>
                <button className="text-primary hover:underline cursor-pointer">.pi Domains</button>
              </PiDomainModal>
              <span className="text-muted-foreground">•</span>
              <DropPayModal>
                <button className="text-primary hover:underline cursor-pointer">DropPay</button>
              </DropPayModal>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <a href="/terms" className="text-primary hover:underline">Terms</a>
              <span className="text-muted-foreground">•</span>
              <a href="/privacy" className="text-primary hover:underline">Privacy</a>
              <span className="text-muted-foreground">•</span>
              <a
                href="https://www.droplink.space/help"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Help
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drop Ecosystem Modal */}
      <Dialog open={showEcosystemModal} onOpenChange={setShowEcosystemModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>The Drop Ecosystem for Business & Creators</DialogTitle>
            <DialogDescription>
              Droplink, DropStore, and DropPay combine to move you from exposure to earnings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Droplink Section */}
            <div className="bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-950/20 dark:to-sky-900/20 p-4 rounded-lg border">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-lg text-sky-700 dark:text-sky-300">
                  🔗 Droplink
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Droplink connects your DropStore storefront to the masses, driving traffic, visibility, and real buyers to your products through one powerful link.
                </p>
              </div>
            </div>

            {/* DropStore Section */}
            <div className="bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-950/20 dark:to-sky-900/20 p-4 rounded-lg border">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-lg text-sky-700 dark:text-sky-300">
                  🛒 DropStore
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Your complete storefront, designed to display and sell:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400">
                    <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
                    Physical products
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400">
                    <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
                    Digital products
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400">
                    <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
                    Online services
                  </div>
                </div>
                <p className="text-sm font-medium text-sky-700 dark:text-sky-300 italic">
                  All in one Pi-powered marketplace.
                </p>
              </div>
            </div>

            {/* DropPay Section */}
            <div className="bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-950/20 dark:to-sky-900/20 p-4 rounded-lg border">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-lg text-sky-700 dark:text-sky-300">
                  💳 DropPay
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Handles payments and payouts, allowing you to:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>
                    Accept Pi payments for your products
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>
                    Create checkout links for everything
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>
                    Embed Pi payments on your website or widgets
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>
                    Automatically receive earnings from your DropStore
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>
                    Manage merchant payouts seamlessly
                  </li>
                </ul>
              </div>
            </div>

            {/* Connected Ecosystem */}
            <div className="bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-950/20 dark:to-sky-900/20 p-4 rounded-lg border">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-lg text-sky-700 dark:text-sky-300">
                  🔁 One Connected Ecosystem
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  These three Pi apps are fully connected, creating a complete business flow:
                </p>
                <div className="flex items-center justify-center">
                  <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border shadow-sm">
                    <span className="font-bold text-sky-600 dark:text-sky-400 text-lg">
                      Exposure → Selling → Payment → Payout
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Usage */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-lg">
                ✅ Recommended Usage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="text-center p-3 bg-sky-50 dark:bg-sky-950/20 rounded-lg border">
                  <div className="text-2xl mb-2">👥</div>
                  <p className="font-medium text-sky-700 dark:text-sky-300">Creators & Influencers</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Use Droplink to grow reach</p>
                </div>
                <div className="text-center p-3 bg-sky-50 dark:bg-sky-950/20 rounded-lg border">
                  <div className="text-2xl mb-2">🏪</div>
                  <p className="font-medium text-sky-700 dark:text-sky-300">Sellers & Merchants</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Use DropStore to showcase and sell</p>
                </div>
                <div className="text-center p-3 bg-sky-50 dark:bg-sky-950/20 rounded-lg border">
                  <div className="text-2xl mb-2">🏢</div>
                  <p className="font-medium text-sky-700 dark:text-sky-300">Businesses</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Use DropPay for secure Pi payments</p>
                </div>
              </div>
            </div>

            {/* Flexibility */}
            <div className="text-center space-y-3 bg-sky-50 dark:bg-sky-950/30 p-4 rounded-lg border">
              <h3 className="flex items-center justify-center gap-2 font-semibold text-lg text-sky-700 dark:text-sky-300">
                💡 Flexible for Your Needs
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use one, two, or all three — depending on your business or creator goals.
              </p>
            </div>

            {/* CTA Section */}
            <div className="text-center space-y-4 bg-gradient-to-r from-sky-500 to-sky-600 text-white p-6 rounded-lg">
              <div className="text-2xl font-bold">
                Build. Sell. Get Paid. All in Pi.
              </div>
              <p className="text-sky-100">
                Join thousands of creators and businesses already earning with the Drop ecosystem.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              asChild 
              className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold px-6"
              onClick={() => setShowEcosystemModal(false)}
            >
              <a href="https://www.droplink.space" target="_blank" rel="noopener noreferrer">
                🚀 Get Started Now
              </a>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              className="border-2 border-sky-200 hover:bg-sky-50 dark:border-sky-700 dark:hover:bg-sky-950/20"
              onClick={() => setShowEcosystemModal(false)}
            >
              <a href="https://www.droplink.space/help" target="_blank" rel="noopener noreferrer">
                📚 Learn More
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PiAuth;
