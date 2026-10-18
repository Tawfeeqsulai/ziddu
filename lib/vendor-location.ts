type VendorLocation = {
  address: string;
  locality: string;
  city: string;
  latitude?: number;
  longitude?: number;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeVendorLocation(value: unknown): VendorLocation {
  let record: Record<string, unknown> = {};
  let address = text(value);

  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        record = parsed as Record<string, unknown>;
        address = text(record.text) || text(record.address) || address;
      }
    } catch {
      // Keep an invalid JSON string readable as a regular address.
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    record = value as Record<string, unknown>;
    address = text(record.text) || text(record.address);
  }

  const parts = address.split(",").map((part) => part.trim()).filter(Boolean).filter((part) =>
    !/^[1-9]\d{5}$/.test(part) && !/^(india|tamil nadu|karnataka|kerala|telangana|maharashtra|delhi)$/i.test(part),
  );
  const city = text(record.city) || (parts.length > 1 ? parts[parts.length - 1] : "");
  const locality = text(record.locality) || text(record.neighbourhood) || text(record.neighborhood) ||
    (parts.length > 2 ? parts[parts.length - 2] : parts[0] || "");
  const latitude = record.latitude == null || record.latitude === "" ? Number.NaN : Number(record.latitude);
  const longitude = record.longitude == null || record.longitude === "" ? Number.NaN : Number(record.longitude);

  return {
    address,
    locality,
    city,
    ...(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? { latitude } : {}),
    ...(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? { longitude } : {}),
  };
}
