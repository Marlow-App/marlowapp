import { ReactNode, useState, useEffect, useRef } from "react";
import { House, Mic2, BarChart2, BookOpen, UserCircle, FileAudio, X, Menu, LogOut, Zap, Grid3X3 } from "lucide-react";
import pandaLogo from "@assets/chow_chow_2_1774332948261.png";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useTourSpotlight } from "@/contexts/TourSpotlightContext";
import { useInAppNotifications } from "@/hooks/use-in-app-notifications";
import { useIsPro } from "@/hooks/use-subscription";
import { useUnseenFeedback } from "@/hooks/use-unseen-feedback";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { spotlightHref, registerOpenMobileMenu } = useTourSpotlight();
  useInAppNotifications();
  const { unseenCount, markHomeSeen } = useUnseenFeedback();

  useEffect(() => {
    registerOpenMobileMenu(() => setIsMobileMenuOpen(true));
  }, [registerOpenMobileMenu]);

  const prevLocation = useRef<string>("/");
  useEffect(() => {
    if (prevLocation.current === "/" && location !== "/") {
      markHomeSeen();
    }
    prevLocation.current = location;
  }, [location]);

  const isActive = (path: string) => location === path;

  const learnerItems = [
    { href: "/", label: "Home", icon: House },
    { href: "/record", label: "Record New", icon: Mic2 },
    { href: "/crossword", label: "Daily Crossword", icon: Grid3X3 },
    { href: "/learner-portal", label: "My Progress", icon: BarChart2 },
    { href: "/practice-list", label: "Practice List", icon: BookOpen },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const reviewerItems = [
    { href: "/", label: "Home", icon: House },
    { href: "/reviewer-hub", label: "Reviewer Hub", icon: FileAudio },
    { href: "/crossword", label: "Daily Crossword", icon: Grid3X3 },
    { href: "/crossword/editor", label: "Crossword Editor", icon: Grid3X3 },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const navItems = (user?.role === "reviewer" || user?.role === "admin") ? reviewerItems : learnerItems;

  const isPro = useIsPro();

  const subLabel = user?.role === "reviewer"
    ? "Reviewer"
    : isPro
      ? "Pro Plan"
      : "Free Plan";

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row font-sans text-foreground overflow-hidden">
      {/* Mobile Header */}
      <header className="md:hidden border-b border-border px-4 h-16 flex justify-between items-center bg-card sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={pandaLogo} alt="Marlow" className="w-[46px] h-[46px] object-contain" />
          <span className="font-display font-bold text-xl tracking-tight">Marlow</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 relative">
          {isMobileMenuOpen ? <X /> : <Menu />}
          {!isMobileMenuOpen && unseenCount > 0 && user?.role === "learner" && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-2">
            <img src={pandaLogo} alt="Marlow" className="w-[54px] h-[54px] object-contain" />
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">Marlow</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 pl-1">Master Chinese Tones</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isSpotlit = spotlightHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="block"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group",
                    isSpotlit
                      ? "bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/30 scale-[1.02]"
                      : isActive(item.href)
                        ? "bg-primary/10 text-primary font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-colors duration-300",
                    isSpotlit
                      ? "text-primary-foreground"
                      : isActive(item.href)
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/" && unseenCount > 0 && user?.role === "learner" && (
                    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold leading-none">
                      {unseenCount > 9 ? "9+" : unseenCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 bg-muted/10">
          <Link href={user?.role === "learner" ? "/profile?tab=subscription" : "/profile"} onClick={() => setIsMobileMenuOpen(false)}>
            <div className="flex items-center gap-4 mb-4 px-2 cursor-pointer rounded-xl hover:bg-muted/50 transition-colors py-2" data-testid="sidebar-profile-link">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-base shrink-0">
                {user?.firstName?.[0] || (user as any)?.username?.[0] || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate">{user?.firstName || (user as any)?.username || "Learner"}</p>
                <p className="text-sm font-normal text-muted-foreground truncate flex items-center gap-1.5 mt-0.5" data-testid="sidebar-credit-label">
                  {isPro && <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500 fill-amber-500" />}
                  {subLabel}
                </p>
              </div>
            </div>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[55] md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
