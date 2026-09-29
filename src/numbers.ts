// Numbers the lifter types.

// Null when blank, undefined when it isn't a number. Accepts a comma as the
// decimal separator too, as some keyboards type one.
export function parseDecimal(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

export function parseWholeNumber(text: string): number | undefined {
  return /^\d+$/.test(text.trim()) ? Number(text) : undefined;
}
