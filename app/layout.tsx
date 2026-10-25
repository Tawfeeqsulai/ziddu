import type { Metadata } from "next";
import { AppNavigation } from "@/components/ui/bottom-navigation";
import { LoginPromptProvider } from "@/components/features/auth/login-prompt-provider";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";
import "./desktop.css";

export const metadata: Metadata = {
  title: "ZIDDU | Good finds, just around the corner",
  description: "Meet the shops, people and little finds in your neighborhood.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ziddu-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full"><LoginPromptProvider authenticated={Boolean(user)}><PullToRefresh /><AppNavigation>{children}</AppNavigation></LoginPromptProvider></body>
    </html>
  );
}
