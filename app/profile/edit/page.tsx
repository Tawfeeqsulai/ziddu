import { redirect } from "next/navigation";
import ProfileForm from "@/components/features/profile/profile-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { interestOptions } from "@/lib/profile";
import { readEnumArray } from "@/lib/db/json";

export default async function EditProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login");
  if (!sessionUser.onboardingCompleted) redirect("/onboarding");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, username: true, image: true, bio: true, city: true, locality: true, interests: true },
  });
  if (!user) redirect("/login");

  return (
    <main className="profile-page">
      <div className="profile-brand brand-lockup"><BrandLogo /></div>
      <ProfileForm mode="edit" initial={{ ...user, interests: readEnumArray(user.interests, interestOptions), username: user.username ?? "", image: user.image ?? "", bio: user.bio ?? "", city: user.city ?? "", locality: user.locality ?? "" }} />
    </main>
  );
}
