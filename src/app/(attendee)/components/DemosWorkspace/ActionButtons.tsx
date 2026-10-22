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
    <div className="relative z-10 flex w-full max-w-xl select-none items-center justify-evenly px-4">
      <ReactionButton
        feedback={feedback}
        setFeedback={setFeedback}
        reaction="cheers"
        emoji="🥳"
      />
      <ReactionButton
        feedback={feedback}
        setFeedback={setFeedback}
        reaction="claps"
        emoji="👏"
      />
      <ReactionButton
        feedback={feedback}
        setFeedback={setFeedback}
        reaction="confetti"
        emoji="🎉"
      />
    </div>
  );
}

function ReactionButton({
  feedback,
  setFeedback,
  reaction,
  emoji,
}: {
  feedback: LocalFeedback | null;
  setFeedback: (feedback: LocalFeedback) => void;
  reaction: "claps" | "cheers" | "confetti";
  emoji: string;
}) {
  const count = feedback?.[reaction] ?? 0;
  const label = { claps: "Clap", cheers: "Cheer", confetti: "Celebrate" }[
    reaction
  ];

  return (
    <div className="relative flex flex-col items-center justify-center gap-1">
      <motion.button
        aria-label={`${label} (${count})`}
        whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
        whileTap={{ scale: 1.5, transition: { duration: 0.2 } }}
        className={cn(
          "relative flex size-24 flex-col items-center justify-center rounded-full border-2 bg-white text-center text-primary-dark shadow-lg shadow-black/10 transition-all",
          count > 0 ? "border-primary bg-primary/5" : "border-black/5",
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
        <span aria-hidden="true" className="text-[40px] leading-none">
          {emoji}
        </span>
        <span className="mt-1 text-sm font-bold">{count}</span>
      </motion.button>
    </div>
  );
}
