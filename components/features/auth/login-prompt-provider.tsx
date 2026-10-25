"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type LoginPromptContextValue = { authenticated: boolean; requireLogin: () => boolean };
const LoginPromptContext = createContext<LoginPromptContextValue | null>(null);

export function LoginPromptProvider({ children, authenticated }: { children: ReactNode; authenticated: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const requireLogin = useCallback(() => {
    if (authenticated) return true;
    setOpen(true);
    return false;
  }, [authenticated]);
  const value = useMemo(() => ({ authenticated, requireLogin }), [authenticated, requireLogin]);

  function goToLogin() {
    setOpen(false);
    router.push("/login");
  }

  return <LoginPromptContext.Provider value={value}>
    {children}
    {open && <div className="login-prompt-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section aria-labelledby="login-prompt-title" aria-modal="true" className="login-prompt-card" role="dialog">
        <span className="section-kicker">YOUR NEIGHBORHOOD IS WAITING</span>
        <h2 id="login-prompt-title">Log in to continue</h2>
        <p>Sign in to follow shops, like and save posts, share, and use ZIDDU features.</p>
        <button className="login-prompt-primary" onClick={goToLogin} type="button">Log in</button>
        <button className="login-prompt-secondary" onClick={() => setOpen(false)} type="button">Maybe later</button>
      </section>
    </div>}
  </LoginPromptContext.Provider>;
}

export function useLoginPrompt() {
  const context = useContext(LoginPromptContext);
  if (!context) throw new Error("useLoginPrompt must be used inside LoginPromptProvider.");
  return context;
}
