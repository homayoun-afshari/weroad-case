const euros = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** 3, "day" → "3 days"; 1, "trip" → "1 trip" */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** `3 to 8 days`, `at least 3 days`, `at most 8 days` */
export function describeDays({ min, max }: { min?: number; max?: number }): string {
  if (min !== undefined && max !== undefined) return `${min} to ${max} days`;
  return min !== undefined ? `at least ${plural(min, "day")}` : `at most ${plural(max!, "day")}`;
}

/** 1219 → "€1,219" */
export function formatPrice(amount: number): string {
  return euros.format(amount);
}
