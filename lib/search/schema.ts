import { z } from "zod";

/**
 * The shape of a search request coming from outside the server: the search button, or the agent's
 * tool. The descriptions are read by the model.
 */
export const searchRequestSchema = z.object({
  text: z
    .string()
    .max(200)
    .describe(
      'What the user searches for, in plain words, including destinations: "hiking in Argentina", "northern lights". Not prices or dates, which have their own fields. Empty for all trips.',
    ),
  dates: z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .refine((d) => d.from <= d.to, "The start date must not be after the end date.")
    .optional()
    .describe("Only trips with a departure fully inside this window. ISO dates (YYYY-MM-DD)."),
  maxPrice: z.number().positive().optional().describe("The highest price in euros."),
  days: z
    .object({ min: z.number().int().positive().optional(), max: z.number().int().positive().optional() })
    .optional()
    .describe("The length of the trip in days."),
  ageBand: z.enum(["18-25", "25-35", "25-49"]).optional().describe("The age band of the departure."),
  physicalRating: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().describe("How physically demanding the trip is."),
  privateRoom: z.boolean().optional().describe("Only departures where a private room can be booked."),
});

/** The agent's get_departures tool: which trips on screen, and an optional date window. */
export const departuresInputSchema = z
  .object({
    tripIds: z
      .array(z.number().int())
      .min(1)
      .max(10)
      .optional()
      .describe("The trips to look at, by the # ids of the page state. Leave out for all the trips on screen."),
    from: z.iso.date().optional().describe("The start of the date window (YYYY-MM-DD). Send with `to`, or leave both out."),
    to: z.iso.date().optional().describe("The end of the date window (YYYY-MM-DD)."),
  })
  .refine((d) => (d.from === undefined) === (d.to === undefined), "Send both from and to, or neither.")
  .refine((d) => d.from === undefined || d.to === undefined || d.from <= d.to, "The start date must not be after the end date.");
