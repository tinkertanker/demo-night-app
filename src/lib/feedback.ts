import { type Feedback } from "@prisma/client";

import { hasPostcard } from "./postcards";

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
