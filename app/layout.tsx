import type { Metadata } from "next";
import { AppNavigation } from "@/components/ui/bottom-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZIDDU | Good finds, just around the corner",
  description: "Meet the shops, people and little finds in your neighborhood.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ziddu-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full"><AppNavigation>{children}</AppNavigation></body>
    </html>
  );
}
