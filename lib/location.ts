import { z } from "zod";

export const coordinatesSchema = z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
});

export const normalizedLocationSchema = z.object({
    address: z.string().trim().max(240).optional(),
    locality: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    pincode: z.string().regex(/^[1-9]\d{5}$/).optional(),
    country: z.string().trim().max(80).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
});

export type NormalizedLocation = z.infer<typeof normalizedLocationSchema>;

export function haversineDistanceKm(from: { latitude?: number | null; longitude?: number | null }, to: { latitude?: number | null; longitude?: number | null }) {
    if (from.latitude == null || from.longitude == null || to.latitude == null || to.longitude == null) return null;
    const radians = (value: number) => value * Math.PI / 180;
    const latitudeDelta = radians(to.latitude - from.latitude);
    const longitudeDelta = radians(to.longitude - from.longitude);
    const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(distance: number | null) {
    if (distance == null) return undefined;
    return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
}

export function formatTravelTimeKm(distanceKm: number) {
    const minutes = Math.max(1, Math.ceil(distanceKm * 12)); // Approximate walking pace: 5 km/h.
    if (minutes < 60) return `${minutes} min away`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours} hr ${remainingMinutes} min away` : `${hours} hr away`;
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : undefined; }

export function normalizeProviderResult(result: { display_name?: unknown; lat?: unknown; lon?: unknown; address?: Record<string, unknown> }): NormalizedLocation {
    const address = result.address ?? {};
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    const postcode = text(address.postcode);
    return normalizedLocationSchema.parse({
        address: text(result.display_name),
        locality: text(address.suburb) ?? text(address.neighbourhood) ?? text(address.village) ?? text(address.quarter),
        city: text(address.city) ?? text(address.town) ?? text(address.municipality) ?? text(address.city_district) ?? text(address.county),
        state: text(address.state),
        pincode: postcode && /^[1-9]\d{5}$/.test(postcode) ? postcode : undefined,
        country: text(address.country),
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
    });
}

// A directions session counts as a shop walk-in once the customer is this close.
export const WALKIN_ARRIVAL_RADIUS_METERS = 20;
