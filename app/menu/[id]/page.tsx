import { redirect } from "next/navigation";

export default async function MenuRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/shops/${id}?tab=menu`);
}
