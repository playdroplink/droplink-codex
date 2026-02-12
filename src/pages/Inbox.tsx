import { useEffect, useState } from "react";
import { usePi } from "@/contexts/PiContext";
import InboxConversations from "@/components/InboxConversations";
import InboxMessages from "@/components/InboxMessages";
import { Info, Moon, Sun } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FooterNav } from "@/components/FooterNav";

export default function InboxPage() {
  const { piUser, isAuthenticated } = usePi();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("inbox_theme_mode");
    if (saved === "dark") {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("inbox_theme_mode", isDarkMode ? "dark" : "light");
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  return (
    <div>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between px-4 pt-4">
            <div>
              <h1 className="text-lg font-semibold">Inbox</h1>
              <p className="text-xs text-muted-foreground">Messages and conversations</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDarkMode((prev) => !prev)}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          {!isAuthenticated && (
            <Alert className="mb-4 mx-4 mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Sign in with Pi Network to view your messages and start conversations.
              </AlertDescription>
            </Alert>
          )}
          
          <InboxConversations />
          
          {isAuthenticated && piUser?.username && (
            <div className="px-4">
              <InboxMessages receiverUsername={piUser.username} />
            </div>
          )}
        </div>
      </div>
      <FooterNav />
    </div>
  );
}
