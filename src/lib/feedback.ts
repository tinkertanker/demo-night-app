import { type Feedback } from "@prisma/client";

export function feedbackScore(feedback: Feedback) {
  let score = feedback.comment ? 1000 : 0;
  score += feedback.comment?.length ?? 0;
  score += (feedback.rating ?? 0) * 5;
  score += feedback.claps ?? 0;
  score += feedback.cheers ?? 0;
  score += feedback.confetti ?? 0;
  return score;
}
