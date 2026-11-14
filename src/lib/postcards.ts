import { z } from "zod";

export const APPRECIATION_BADGES = [
  "Creative idea",
  "Really useful",
  "Great explanation",
  "Made me smile",
] as const;

export const postcardFields = {
  liked: z.string().max(4000).nullable().optional(),
  wonder: z.string().max(4000).nullable().optional(),
  tryNext: z.string().max(4000).nullable().optional(),
  badges: z
    .array(z.enum(APPRECIATION_BADGES))
    .max(4)
    .refine(
      (badges) => new Set(badges).size === badges.length,
      "Choose each badge only once",
    )
    .optional(),
};

export type Postcard = {
  demoId?: string;
  comment?: string | null;
  liked?: string | null;
  wonder?: string | null;
  tryNext?: string | null;
  badges?: string[];
};

export function hasPostcard(feedback: Postcard) {
  return (
    [feedback.comment, feedback.liked, feedback.wonder, feedback.tryNext].some(
      (text) => !!text?.trim(),
    ) || !!feedback.badges?.length
  );
}

export function postcardProgress(feedback: Postcard[]) {
  return new Set(
    feedback
      .filter(hasPostcard)
      .map((item) => item.demoId)
      .filter(Boolean),
  ).size;
}
