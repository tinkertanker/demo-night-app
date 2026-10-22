import { z } from "zod";

import { DEFAULT_PARTNERS, partnerSchema } from "./partner";

export const eventConfigSchema = z.object({
  partners: z.array(partnerSchema).default(DEFAULT_PARTNERS),
  isPitchNight: z.boolean().default(false),
  surveyUrl: z.string().optional(),
  votingMode: z.enum(["allocation", "stickers", "awards"]).optional(),
  votingUnit: z.enum(["thumbs", "stars", "points", "dollars"]).optional(),
  stickerAllowance: z.number().int().min(1).max(10).optional(),
  feedbackGoal: z.number().int().min(1).max(100).optional(),
  template: z.enum(["pitching", "categories", "noLeaderboard"]).optional(),
});

export type EventConfig = z.infer<typeof eventConfigSchema>;

export const EVENT_TEMPLATES = {
  pitching: {
    label: "Pitching",
    description:
      "Allocate money or support, then reveal funding-based winners.",
    defaults: {
      isPitchNight: true,
      votingMode: "allocation",
      votingUnit: "dollars",
    },
  },
  categories: {
    label: "Categories",
    description:
      "Choose one project per category and reveal each category's winner.",
    defaults: {
      isPitchNight: false,
      votingMode: "awards",
      votingUnit: "thumbs",
    },
  },
  noLeaderboard: {
    label: "No Leaderboard",
    description:
      "Give favourite stickers and postcards without public rankings or winners.",
    defaults: {
      isPitchNight: false,
      votingMode: "stickers",
      votingUnit: "thumbs",
    },
  },
} as const;

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  partners: DEFAULT_PARTNERS,
  template: "pitching",
  ...EVENT_TEMPLATES.pitching.defaults,
};

export const VOTING_UNITS = {
  thumbs: { symbol: "👍", name: "thumbs-ups" },
  stars: { symbol: "★", name: "stars" },
  points: { symbol: "●", name: "points" },
  dollars: { symbol: "$", name: "dollars" },
} as const;

// Missing fields are legacy records, not new-event defaults.
export function votingSettings(raw: unknown) {
  const config = eventConfigSchema.parse(raw ?? {});
  const defaults = config.template
    ? EVENT_TEMPLATES[config.template].defaults
    : undefined;
  const mode =
    config.votingMode ??
    defaults?.votingMode ??
    (config.isPitchNight ? "allocation" : "awards");
  const unit = config.votingUnit ?? defaults?.votingUnit ?? "dollars";
  const financial = mode === "allocation" && unit === "dollars";
  return {
    template: config.template,
    categories: config.template === "categories",
    showResults: config.template !== "noLeaderboard",
    mode,
    unit,
    financial,
    weighted: mode !== "awards",
    budget: mode === "stickers" ? config.stickerAllowance ?? 5 : 100000,
    step: mode === "stickers" ? 1 : 1000,
    symbol: mode === "stickers" ? "⭐" : VOTING_UNITS[unit].symbol,
    name: mode === "stickers" ? "favourite stickers" : VOTING_UNITS[unit].name,
    label:
      mode === "stickers" ? "Stickers" : financial ? "Investments" : "Support",
    format: (amount: number) =>
      mode === "stickers"
        ? `${amount} ⭐`
        : financial
          ? `$${amount / 1000}k`
          : `${VOTING_UNITS[unit].symbol} ${amount.toLocaleString()}`,
  };
}
