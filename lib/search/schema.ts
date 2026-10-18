import { z } from "zod";

/** The shape of a search request coming from outside the server: the search button, or the agent's tool. */
export const searchRequestSchema = z.object({
  text: z.string().max(200),
  dates: z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .refine((d) => d.from <= d.to, "The start date must not be after the end date.")
    .optional(),
  maxPrice: z.number().positive().optional(),
  days: z
    .object({ min: z.number().int().positive().optional(), max: z.number().int().positive().optional() })
    .optional(),
  ageBand: z.enum(["18-25", "25-35", "25-49"]).optional(),
  physicalRating: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  privateRoom: z.boolean().optional(),
});
