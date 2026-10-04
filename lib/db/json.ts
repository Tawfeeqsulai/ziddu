export function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function readEnumArray<const T extends string>(value: unknown, allowedValues: readonly T[]): T[] {
    return readStringArray(value).filter((item): item is T => allowedValues.includes(item as T));
}