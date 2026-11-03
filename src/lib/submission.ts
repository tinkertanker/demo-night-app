import { z } from "zod";

import { TAGLINE_MAX_LENGTH } from "~/lib/types/taglineMaxLength";

// Demo links are rendered as clickable hrefs, so only web links are allowed
// (a javascript: URL would run script when an attendee clicks it).
export const webUrlSchema = z
  .string()
  .trim()
  .max(2000, "Please use a shorter link")
  .url("Please enter a website address, like https://example.com")
  .refine((url) => /^https?:\/\//i.test(url), {
    message: "Website addresses must start with http:// or https://",
  })
  .refine(hasDottedHost, {
    message: "Please enter a full website address, like example.com",
  });

// Zod runs refinements even after .url() fails; unparsable input passes here
// and is reported by .url() instead.
function hasDottedHost(url: string) {
  try {
    return new URL(url).hostname.includes(".");
  } catch {
    return true;
  }
}

// "example.com" -> "https://example.com". Anything that already names a
// scheme (https:, javascript:, ...) is left alone for validation to judge.
export function withWebScheme(value: string) {
  const url = value.trim();
  if (!url || /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)) return url;
  return `https://${url}`;
}

const requiredText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max, `Please keep this under ${max} characters`);

export const submissionInputSchema = z.object({
  eventId: z.string(),
  name: requiredText(100, "Name is required"),
  tagline: requiredText(TAGLINE_MAX_LENGTH, "Tagline is required"),
  description: requiredText(2000, "Description is required"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email("Please enter a valid email address, like ada@example.com"),
  url: webUrlSchema,
  pocName: requiredText(100, "Your name is required"),
  demoUrl: webUrlSchema.optional().or(z.literal("")),
});
