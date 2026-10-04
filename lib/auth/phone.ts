import "server-only";

export function normalizeIndianPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s()-]/g, "");
  const national = compact.startsWith("+91")
    ? compact.slice(3)
    : compact.startsWith("91") && compact.length === 12
      ? compact.slice(2)
      : compact;

  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
}

export function isNormalizedIndianPhone(input: string): boolean {
  return normalizeIndianPhone(input) === input;
}