import { redirect } from "next/navigation";
import ProfileForm from "@/components/features/profile/profile-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/");

  const onboardingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, accounts: { select: { providerId: true } } },
  });
  if (!onboardingUser) redirect("/login");
  const emailEditable = !onboardingUser.accounts.some((account) => account.providerId === "google");
  const email = onboardingUser.email.endsWith("@phone.ziddu.invalid") ? "" : onboardingUser.email;

  return (
    <main className="profile-page onboarding-page">
      <div className="profile-brand brand-lockup"><BrandLogo /></div>
      <ProfileForm mode="onboarding" emailEditable={emailEditable} initial={{ name: user.name === "ZIDDU member" ? "" : user.name, email, phoneNumber: user.phoneNumber ?? "", username: "", image: "", bio: "", city: "", locality: "", interests: [] }} />
    </main>
  );
}