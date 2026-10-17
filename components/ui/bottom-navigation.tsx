"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Bookmark, Clapperboard, Home, Search, Sparkles, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type NavigationItem = { label: string; icon: LucideIcon; active?: boolean; onClick?: () => void };
type MainTab = "Home" | "Search" | "Reels" | "Saved";

const lastTabStorageKey = "ziddu:last-bottom-tab";
const tabRoutes: Record<MainTab, string> = { Home: "/", Search: "/search", Reels: "/reels", Saved: "/saved" };
const bottomNavigationRoutes = new Set(["/", "/search", "/saved", "/ai"]);

const defaultItems: NavigationItem[] = [
  { label: "Home", icon: Home },
  { label: "Search", icon: Search },
  { label: "Reels", icon: Clapperboard },
  { label: "Saved", icon: Bookmark },
];
const AppNavigationContext = createContext(false);

export function BottomNavigation({ items = defaultItems, global = false }: { items?: NavigationItem[]; global?: boolean } = {}) {
  const inAppNavigation = useContext(AppNavigationContext);
  const pathname = usePathname();
  const router = useRouter();
  if (inAppNavigation && !global) return null;

  const navigationItemsSource = global
    ? defaultItems.map((item) => ({
      ...item,
      active: item.label === "Home" && pathname === "/" ||
        item.label === "Search" && pathname.startsWith("/search") ||
        item.label === "Reels" && pathname.startsWith("/reels") ||
        item.label === "Saved" && pathname.startsWith("/saved"),
      onClick: () => {
        const tab = item.label as MainTab;
        window.localStorage.setItem(lastTabStorageKey, tab);
        router.push(tabRoutes[tab]);
      },
    }))
    : [...items, ...(items.some((item) => item.label === "Saved") ? [] : [{ label: "Saved", icon: Bookmark, onClick: () => router.push("/saved") }])];
  const aiItem = { label: "ZIDDU AI", icon: Sparkles, active: global && pathname.startsWith("/ai"), onClick: () => router.push("/ai") };
  const otherItems = navigationItemsSource.filter((item) => item.label !== "ZIDDU AI" && item.label !== "Offers" && item.label !== "Profile");
  const navigationItems = [...otherItems.slice(0, 2), aiItem, ...otherItems.slice(2)];
  return <nav aria-label="Primary navigation" className="ui-bottom-navigation">
    <svg aria-hidden="true" className="ui-bottom-navigation-surface" preserveAspectRatio="none" viewBox="0 0 400 112">
      <defs>
        <linearGradient id="navigation-outline" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#36c8ed" />
          <stop offset="55%" stopColor="#287ff0" />
          <stop offset="100%" stopColor="#884df2" />
        </linearGradient>
        <linearGradient id="navigation-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".99" />
          <stop offset="100%" stopColor="#f7fbff" stopOpacity=".99" />
        </linearGradient>
      </defs>
      <path d="M0 38 Q0 18 24 18 H132 C164 18 166 0 200 0 C234 0 236 18 268 18 H376 Q400 18 400 42 V112 H0 Z" fill="url(#navigation-fill)" stroke="url(#navigation-outline)" strokeWidth="1.5" />
    </svg>
    {navigationItems.map(({ label, icon: Icon, active, onClick }) => <button aria-current={active ? "page" : undefined} className={[active ? "is-active" : "", label === "ZIDDU AI" ? "is-ai" : ""].filter(Boolean).join(" ")} key={label} onClick={onClick} type="button"><span className="ui-bottom-navigation-icon"><Icon aria-hidden="true" size={label === "ZIDDU AI" ? 34 : 25} /></span><span>{label === "ZIDDU AI" ? "Ziddu AI" : label}</span></button>)}
  </nav>;
}

export function AppNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const restoredInitialTab = useRef(false);
  const showNavigation = bottomNavigationRoutes.has(pathname);

  useEffect(() => {
    if (restoredInitialTab.current) return;
    restoredInitialTab.current = true;
    if (pathname !== "/") return;

    const savedTab = window.localStorage.getItem(lastTabStorageKey);
    if (savedTab && savedTab in tabRoutes && savedTab !== "Home") {
      router.replace(tabRoutes[savedTab as MainTab]);
    }
  }, [pathname, router]);

  return (
    <AppNavigationContext.Provider value>
      <div className={`app-navigation-content${showNavigation ? " has-bottom-navigation" : ""}`}>
        {children}
      </div>
      {showNavigation && <BottomNavigation global />}
    </AppNavigationContext.Provider>
  );
}
