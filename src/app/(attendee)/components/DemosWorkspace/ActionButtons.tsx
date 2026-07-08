"use client";

import { motion } from "framer-motion";

import { cn } from "~/lib/utils";

import { type LocalFeedback } from "./hooks/useFeedback";

export function ActionButtons({
  feedback,
  setFeedback,
}: {
  feedback: LocalFeedback | null;
  setFeedback: (feedback: LocalFeedback) => void;
}) {
  return (
    <div className="fixed bottom-3 z-10 flex w-full max-w-xl select-none items-center justify-evenly px-4 ">
      <ReactionButton
        feedback={feedback}
        setFeedback={setFeedback}
        reaction="cheers"
        emoji="🥳"
        size="small"
      />
      <ReactionButton
        feedback={feedback}
        setFeedback={setFeedback}
        reaction="claps"
        emoji="👏"
        size="large"
      />
      <ReactionButton
        feedback={feedback}
        setFeedback={setFeedback}
        reaction="confetti"
        emoji="🎉"
        size="small"
      />
    </div>
  );
}

function ReactionButton({
  feedback,
  setFeedback,
  reaction,
  emoji,
  size,
}: {
  feedback: LocalFeedback | null;
  setFeedback: (feedback: LocalFeedback) => void;
  reaction: "claps" | "cheers" | "confetti";
  emoji: string;
  size: "small" | "large";
}) {
  const count = feedback?.[reaction] ?? 0;

  return (
    <div className="relative flex flex-col items-center justify-center gap-1">
      <motion.button
        whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
        whileTap={{ scale: 1.5, transition: { duration: 0.2 } }}
        className={cn(
          "aspect-square rounded-full border-2 bg-white text-center shadow-lg shadow-black/10 transition-all",
          count > 0 ? "border-primary bg-primary/5" : "border-black/5",
          size === "large"
            ? "relative w-28 text-lg text-primary-dark"
            : "relative w-20 text-primary-dark",
        )}
        onClick={() => {
          if (feedback) {
            setFeedback({
              ...feedback,
              [reaction]: count + 1,
            });
          }
        }}
      >
        {size === "large" ? (
          <>
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pb-4 text-[50px]">
              {emoji}
            </p>
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 translate-y-full transform font-bold">
              {count}
            </p>
          </>
        ) : (
          <>
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pb-3 text-[40px]">
              {emoji}
            </p>
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 translate-y-full transform text-sm font-bold">
              {count}
            </p>
          </>
        )}
      </motion.button>
    </div>
  );
}
