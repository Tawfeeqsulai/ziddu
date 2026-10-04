"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Bookmark, Clapperboard, Home, Search, Sparkles, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type NavigationItem = { label: string; icon: LucideIcon; active?: boolean; onClick?: () => void };
type MainTab = "Home" | "Search" | "Reels" | "Saved";

const lastTabStorageKey = "ziddu:last-bottom-tab";
const tabRoutes: Record<MainTab, string> = { Home: "/", Search: "/search", Reels: "/reels", Saved: "/saved" };

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
  return <nav aria-label="Primary navigation" className="ui-bottom-navigation">{navigationItems.map(({ label, icon: Icon, active, onClick }) => <button aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} key={label} onClick={onClick} type="button"><Icon aria-hidden="true" size={20} /><span>{label}</span></button>)}</nav>;
}

export function AppNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const restoredInitialTab = useRef(false);
  const hideNavigation = pathname === "/login" || pathname === "/onboarding";

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
      <div className={`app-navigation-content${hideNavigation ? "" : " has-bottom-navigation"}`}>
        {children}
      </div>
      {!hideNavigation && <BottomNavigation global />}
    </AppNavigationContext.Provider>
  );
}
