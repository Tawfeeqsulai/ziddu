import { redirect } from "next/navigation";
import Link from "next/link";
import { HandCoins, Pencil, ShoppingBag, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login");
  if (!sessionUser.onboardingCompleted) redirect("/onboarding");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { name: true, username: true, image: true, bio: true, city: true, locality: true } });
  if (!user) redirect("/login");

  return (
    <main className="profile-page">
      <div className="profile-brand brand-lockup"><span className="brand-mark">z</span><span className="brand-name">ziddu<span>.</span></span></div>
      <section className="profile-card" aria-labelledby="profile-title">
        <Avatar alt={user.name} className="profile-avatar" image={user.image} initials={user.name} size="lg" />
        <h1 id="profile-title">{user.name}</h1>
        {user.username && <p className="profile-username">@{user.username}</p>}
        {user.bio && <p className="profile-bio">{user.bio}</p>}
        {(user.locality || user.city) && <p className="profile-location">{[user.locality, user.city].filter(Boolean).join(", ")}</p>}
      </section>
      <nav className="profile-actions" aria-label="Profile actions">
        <Link className="profile-action" href="/profile/edit"><Pencil size={18} /><span>Edit profile</span></Link>
        <Link className="profile-action" href="/orders"><ShoppingBag size={18} /><span>Order history</span></Link>
        <Link className="profile-action" href="/profile/following"><Users size={18} /><span>Following</span></Link>
        <Link className="profile-action" href="/affiliate"><HandCoins size={18} /><span>Become an Affiliate</span></Link>
      </nav>
    </main>
  );
}