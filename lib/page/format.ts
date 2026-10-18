const euros = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** 3, "day" → "3 days"; 1, "trip" → "1 trip" */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** `3 to 8 days`, `at least 3 days`, `at most 8 days` */
export function describeDays({ min, max }: { min?: number; max?: number }): string {
  if (min !== undefined && max !== undefined) return `${min} to ${max} days`;
  return min !== undefined ? `at least ${plural(min, "day")}` : `at most ${plural(max!, "day")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-20", "2026-10-27" → "20–27 Oct"; across months "31 Oct–6 Nov"; another year adds it: "28 Dec 2026–4 Jan 2027". */
export function describeWindow(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy !== ty) return `${fd} ${MONTHS[fm - 1]} ${fy}–${td} ${MONTHS[tm - 1]} ${ty}`;
  if (fm !== tm) return `${fd} ${MONTHS[fm - 1]}–${td} ${MONTHS[tm - 1]}`;
  return fd === td ? `${fd} ${MONTHS[fm - 1]}` : `${fd}–${td} ${MONTHS[fm - 1]}`;
}

/** 1219 → "€1,219" */
export function formatPrice(amount: number): string {
  return euros.format(amount);
}
