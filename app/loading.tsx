import { BrandLogo } from "@/components/ui/brand-logo";

export default function Loading() {
  return (
    <main className="app-splash" role="status" aria-label="Loading Ziddu">
      <div className="app-splash-brand"><BrandLogo /></div>
      <p className="app-splash-tagline">Good finds, just around the corner.</p>
      <p className="app-splash-status">Finding your neighborhood</p>
    </main>
  );
}
