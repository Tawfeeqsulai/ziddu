export default function Loading() {
  return (
    <main className="app-splash" role="status" aria-label="Loading Ziddu">
      <div className="app-splash-brand">
        <span className="app-splash-mark" aria-hidden="true">Z</span>
        <span className="app-splash-name">ZIDDU<span>.</span></span>
      </div>
      <p className="app-splash-tagline">Good finds, just around the corner.</p>
      <p className="app-splash-status">Finding your neighborhood</p>
    </main>
  );
}
