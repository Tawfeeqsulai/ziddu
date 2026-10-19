export function productHashtag(value?: string | null) {
  const text = value?.trim();
  if (!text) return undefined;
  const tag = text.normalize("NFKC").replace(/[^\p{L}\p{N}_]+/gu, "");
  return tag ? `#${tag}` : undefined;
}

export function mergeHashtags(existing: string[], ...values: Array<string | null | undefined>) {
  return [...new Set([...existing, ...values.map(productHashtag).filter((tag): tag is string => Boolean(tag))])];
}
