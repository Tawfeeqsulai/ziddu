import { normalizedLocationSchema, type NormalizedLocation } from "@/lib/location";

const onboardingLocationKey = "ziddu:onboarding-location";

export function saveOnboardingLocation(location: NormalizedLocation) {
  const parsed = normalizedLocationSchema.parse(location);
  window.sessionStorage.setItem(onboardingLocationKey, JSON.stringify(parsed));
}

export function readOnboardingLocation(): NormalizedLocation | null {
  const storedLocation = window.sessionStorage.getItem(onboardingLocationKey);
  if (!storedLocation) return null;

  try {
    const parsed = normalizedLocationSchema.safeParse(JSON.parse(storedLocation));
    if (parsed.success) return parsed.data;
  } catch {
    window.sessionStorage.removeItem(onboardingLocationKey);
    return null;
  }

  window.sessionStorage.removeItem(onboardingLocationKey);
  return null;
}

export function clearOnboardingLocation() {
  window.sessionStorage.removeItem(onboardingLocationKey);
}
