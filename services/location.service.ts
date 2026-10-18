import "server-only";
import { normalizeProviderResult, type NormalizedLocation } from "@/lib/location";

type LocationProvider = {
    search(query: string): Promise<NormalizedLocation[]>;
    reverseGeocode(latitude: number, longitude: number): Promise<NormalizedLocation | null>;
};

type NominatimResult = { display_name?: unknown; lat?: unknown; lon?: unknown; address?: Record<string, unknown> };

class NominatimProvider implements LocationProvider {
    private readonly baseUrl = process.env.LOCATION_API_URL ?? "https://nominatim.openstreetmap.org";

    private async request(path: string) {
        const response = await fetch(`${this.baseUrl}${path}`, { headers: { Accept: "application/json", "Accept-Language": "en-IN,en;q=0.8", "User-Agent": "ZIDDU local discovery app" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error("Location provider unavailable");
        return response.json() as Promise<NominatimResult | NominatimResult[]>;
    }

    async search(query: string) {
        const result = await this.request(`/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&q=${encodeURIComponent(query)}`);
        return Array.isArray(result) ? result.flatMap((item) => { try { return [normalizeProviderResult(item)]; } catch { return []; } }) : [];
    }

    async reverseGeocode(latitude: number, longitude: number) {
        const result = await this.request(`/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`);
        try {
            if (Array.isArray(result)) return null;
            const location = normalizeProviderResult(result);
            return { ...location, latitude, longitude };
        } catch { return null; }
    }
}

export const locationProvider: LocationProvider = new NominatimProvider();
