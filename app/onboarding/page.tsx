import { redirect } from "next/navigation";
import OnboardingProfileForm from "@/components/features/profile/onboarding-profile-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/");

  const onboardingUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true } });
  if (!onboardingUser) redirect("/login");

  return (
    <main className="profile-page onboarding-page">
      <div className="profile-brand brand-lockup"><BrandLogo /></div>
      <OnboardingProfileForm initial={{ name: onboardingUser.name === "ZIDDU member" ? "" : onboardingUser.name, phoneNumber: user.phoneNumber ?? "", username: "", image: "", bio: "", city: "", locality: "", interests: [] }} />
    </main>
  );
}
