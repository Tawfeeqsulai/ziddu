import type { Metadata } from "next";
import { AppNavigation } from "@/components/ui/bottom-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZIDDU | Good finds, just around the corner",
  description: "Meet the shops, people and little finds in your neighborhood.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full"><AppNavigation>{children}</AppNavigation></body>
    </html>
  );
}
