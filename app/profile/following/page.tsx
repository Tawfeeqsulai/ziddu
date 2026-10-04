import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function FollowingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");

  const follows = await prisma.follow.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      shop: {
        select: {
          id: true,
          name: true,
          initials: true,
          image: true,
          location: { select: { locality: true, city: true } },
        },
      },
    },
  });

  return (
    <main className="following-page">
      <header className="following-header">
        <BackButton className="following-back" label="Go back" />
        <div><span className="section-kicker">YOUR NETWORK</span><h1>Following</h1></div>
        <Users aria-hidden="true" className="following-heading-icon" size={22} />
      </header>
      {follows.length === 0 ? (
        <section className="following-empty">
          <Users aria-hidden="true" size={30} />
          <h2>Not following anyone yet</h2>
          <p>Follow local shops from the feed to find them here.</p>
          <Link className="confirm-button" href="/">Explore shops</Link>
        </section>
      ) : (
        <section aria-label="Shops you follow" className="following-list">
          {follows.map(({ shop }) => (
            <Link className="following-item" href={`/shops/${shop.id}`} key={shop.id}>
              <Avatar alt={shop.name} image={shop.image} initials={shop.initials} size="md" />
              <span>
                <strong>{shop.name}</strong>
                <small><MapPin size={12} />{shop.location.locality}, {shop.location.city}</small>
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
