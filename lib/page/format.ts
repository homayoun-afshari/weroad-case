const euros = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** 1219 → "€1,219" */
export function formatPrice(amount: number): string {
  return euros.format(amount);
}
