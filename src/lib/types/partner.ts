import { z } from "zod";

export const partnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().min(1, "URL is required"),
  description: z.string().min(1, "Description is required"),
});

export type Partner = z.infer<typeof partnerSchema>;

export const DEFAULT_PARTNERS: Partner[] = [
  {
    name: "The AI Collective",
    url: "https://www.aicollective.com",
    description:
      "We are building the human layer for the AI era – uniting people in forums worldwide to navigate the rapid acceleration of technological progress.",
  },
  // {
  //   name: "Product Hunt",
  //   url: "https://www.producthunt.com",
  //   description:
  //     "The place to discover your next favorite thing. Launch, share, and discover new products in tech.",
  // },
];
