import type { AgeBand, PhysicalRating, SearchRequest } from "@/lib/search/types";

/** What the search controls hold, as the inputs hold it: strings, and "" for empty. */
export interface FormValues {
  text: string;
  dateFrom: string;
  dateTo: string;
  maxPrice: string;
  minDays: string;
  maxDays: string;
  ageBand: AgeBand | "";
  physicalRating: PhysicalRating | "";
  privateRoom: boolean;
}

const positive = (value: string): number | undefined => {
  const number = Number(value);
  return value.trim() !== "" && Number.isFinite(number) && number > 0 ? number : undefined;
};

/** The search request the controls describe. Empty controls leave their filter out. */
export function formToRequest(form: FormValues): SearchRequest {
  const request: SearchRequest = { text: form.text.trim() };
  // A date window needs both ends; the inputs require both once one is set
  if (form.dateFrom && form.dateTo) request.dates = { from: form.dateFrom, to: form.dateTo };
  const maxPrice = positive(form.maxPrice);
  if (maxPrice !== undefined) request.maxPrice = maxPrice;
  const min = positive(form.minDays);
  const max = positive(form.maxDays);
  if (min !== undefined || max !== undefined) request.days = { min, max };
  if (form.ageBand) request.ageBand = form.ageBand;
  if (form.physicalRating) request.physicalRating = form.physicalRating;
  if (form.privateRoom) request.privateRoom = true;
  return request;
}

/** The controls for a search request: the inverse of formToRequest, used when an undo restores a page state. */
export function requestToForm(request: SearchRequest): FormValues {
  return {
    text: request.text,
    dateFrom: request.dates?.from ?? "",
    dateTo: request.dates?.to ?? "",
    maxPrice: request.maxPrice === undefined ? "" : String(request.maxPrice),
    minDays: request.days?.min === undefined ? "" : String(request.days.min),
    maxDays: request.days?.max === undefined ? "" : String(request.days.max),
    ageBand: request.ageBand ?? "",
    physicalRating: request.physicalRating ?? "",
    privateRoom: request.privateRoom ?? false,
  };
}
