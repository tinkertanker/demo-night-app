import { type Feedback } from "@prisma/client";

import { type FeedbackAndAttendee } from "~/server/api/routers/demo";

import { hasPostcard } from "./postcards";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// Plain text for pasting into chat or email. Reaction-only entries are counted
// in the summary line rather than listed one by one.
export function formatFeedbackForCopy(
  demoName: string,
  feedback: FeedbackAndAttendee[],
) {
  const ratings = feedback.flatMap((f) => (f.rating ? [f.rating] : []));
  const sum = (key: "claps" | "cheers" | "confetti") =>
    feedback.reduce((total, f) => total + f[key], 0);
  const summary = [
    plural(feedback.length, "response"),
    ratings.length > 0 &&
      `Average rating ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}`,
    `👏 ${sum("claps")}`,
    `🥳 ${sum("cheers")}`,
    `🎉 ${sum("confetti")}`,
  ].filter(Boolean);

  const entries = feedback.filter(hasPostcard).map((f) => {
    const name = f.attendee.name?.trim() ? f.attendee.name.trim() : "Anonymous";
    const byline = [
      f.attendee.type ? `${name} (${f.attendee.type})` : name,
      f.rating && `Rating ${f.rating}`,
    ].filter(Boolean);
    const lines = [
      byline.join(" · "),
      f.comment?.trim(),
      f.liked?.trim() && `I liked… ${f.liked.trim()}`,
      f.wonder?.trim() && `I wonder… ${f.wonder.trim()}`,
      f.tryNext?.trim() && `You could try… ${f.tryNext.trim()}`,
      f.badges.length > 0 && `Badges: ${f.badges.join(", ")}`,
    ];
    return lines.filter(Boolean).join("\n");
  });

  return [`Feedback for ${demoName}`, summary.join(" · "), ...entries].join(
    "\n\n",
  );
}

export function feedbackScore(feedback: Feedback) {
  // Display ordering only: appreciation never adds voting points.
  let score = hasPostcard(feedback) ? 1000 : 0;
  score += [
    feedback.comment,
    feedback.liked,
    feedback.wonder,
    feedback.tryNext,
  ].reduce((total, text) => total + (text?.trim().length ?? 0), 0);
  score += feedback.badges?.length ?? 0;
  score += (feedback.rating ?? 0) * 5;
  score += feedback.claps ?? 0;
  score += feedback.cheers ?? 0;
  score += feedback.confetti ?? 0;
  return score;
}
