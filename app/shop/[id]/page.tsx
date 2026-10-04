import { redirect } from "next/navigation";

export default async function ShopAliasPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/shops/${encodeURIComponent(id)}`);
}