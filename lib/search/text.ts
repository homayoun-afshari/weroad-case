/** Lowercase words without accents or punctuation: "Nápoli, Italy!" → ["napoli", "italy"]. */
export function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
