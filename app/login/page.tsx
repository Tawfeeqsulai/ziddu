import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import LoginExperience from "@/components/features/auth/login-experience";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return <LoginExperience developmentOtp="123456" googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}