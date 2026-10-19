import SearchExperience from "@/components/features/search/search-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { searchDiscovery } from "@/services/search.service";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const profile = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { city: true, locality: true, latitude: true, longitude: true } }) : null;
  const results = await searchDiscovery({ query: value("q"), category: value("category"), city: value("city"), locality: value("locality"), distance: value("distance"), page: value("page") }, profile ?? undefined, user?.id);
  return <SearchExperience authenticated={Boolean(user)} initialDistance={value("distance")} initialLocation={profile ?? undefined} key={`${results.query}:${results.category}:${results.city}:${results.locality}:${value("distance") ?? ""}`} results={results} />;
}
