import { redirect } from "next/navigation";
import ProfileForm from "@/components/features/profile/profile-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/");

  const onboardingUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!onboardingUser) redirect("/login");

  return (
    <main className="profile-page onboarding-page">
      <div className="profile-brand brand-lockup"><BrandLogo /></div>
      <ProfileForm mode="onboarding" initial={{ name: user.name === "ZIDDU member" ? "" : user.name, phoneNumber: user.phoneNumber ?? "", username: "", image: "", bio: "", city: "", locality: "", interests: [] }} />
    </main>
  );
}
