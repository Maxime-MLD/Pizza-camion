const PLACEHOLDER_WORD = "TODO";
const PLACEHOLDER_MARKERS = [
  `${PLACEHOLDER_WORD}_`,
  `${PLACEHOLDER_WORD}-`,
  `${PLACEHOLDER_WORD}:`,
  ["", "example"].join("."),
  ["example", "com"].join("."),
] as const;

export function isPlaceholderValue(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) =>
    normalizedValue.includes(marker.toLowerCase()),
  );
}
