import { z } from "zod";

import { DEFAULT_PARTNERS, partnerSchema } from "./partner";

export const eventConfigSchema = z.object({
  partners: z.array(partnerSchema).default(DEFAULT_PARTNERS),
  isPitchNight: z.boolean().default(false),
  surveyUrl: z.string().optional(),
});

export type EventConfig = z.infer<typeof eventConfigSchema>;

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  partners: DEFAULT_PARTNERS,
  isPitchNight: false,
};
