"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import ConfettiExplosion from "react-dom-confetti";

import {
  QUICK_ACTIONS_ICON,
  QUICK_ACTIONS_TITLE,
  type QuickAction,
} from "~/lib/types/quickAction";
import { cn } from "~/lib/utils";

import { type LocalFeedback } from "./hooks/useFeedback";

export function ActionButtons({
  feedback,
  setFeedback,
  quickActions,
}: {
  feedback: LocalFeedback | null;
  setFeedback: (feedback: LocalFeedback) => void;
  quickActions: QuickAction[];
}) {
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    setIsExploding(false);
  }, [feedback?.demoId]);

  return (
    <div className="fixed bottom-3 z-10 flex w-full max-w-xl select-none items-center justify-evenly px-4 ">
      <div className="relative mb-5 flex flex-col items-center justify-center gap-1">
        <motion.button
          whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
          whileTap={{ scale: 1.5, transition: { duration: 0.2 } }}
          className={cn(
            "aspect-square w-20 rounded-full border-2 bg-white text-center text-[40px] shadow-lg shadow-black/10 transition-all",
            feedback?.tellMeMore ? "border-primary bg-primary/5" : "border-black/5",
          )}
          onClick={() => {
            if (feedback) {
              const updatedFeedback = {
                ...feedback,
                tellMeMore: !(feedback.tellMeMore || false),
              };
              setFeedback(updatedFeedback);
              setIsExploding(updatedFeedback.tellMeMore);
            }
          }}
        >
          <div className="pl-10">
            <ConfettiExplosion
              active={isExploding}
              config={{
                colors: ["#f05d57", "#f4827d", "#f9aca9"],
                elementCount: 200,
                duration: 5000,
              }}
            />
          </div>
          <span>📬</span>
        </motion.button>
        <p className="pointer-events-none absolute w-28 pt-[104px] text-center text-sm font-medium text-muted-foreground">
          Email me!
        </p>
      </div>
      <div className="relative flex flex-col items-center justify-center gap-1">
        <motion.button
          whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
          whileTap={{ scale: 1.5, transition: { duration: 0.2 } }}
          className={cn(
            "relative aspect-square w-28 rounded-full border-2 bg-white text-center text-lg text-primary-dark shadow-lg shadow-black/10 transition-all",
            feedback?.claps ? "border-primary bg-primary/5" : "border-black/5",
          )}
          onClick={() => {
            if (feedback) {
              const updatedFeedback = {
                ...feedback,
                claps: (feedback.claps || 0) + 1,
              };
              setFeedback(updatedFeedback);
            }
          }}
        >
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pb-4 text-[50px]">
            👏
          </p>
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 translate-y-full transform font-bold">
            {feedback?.claps ?? 0}
          </p>
        </motion.button>
      </div>
      <QuickActionsButton
        feedback={feedback}
        setFeedback={setFeedback}
        quickActions={quickActions}
      />
    </div>
  );
}

function QuickActionsButton({
  feedback,
  setFeedback,
  quickActions,
}: {
  feedback: LocalFeedback | null;
  setFeedback: (feedback: LocalFeedback) => void;
  quickActions: QuickAction[];
}) {
  const [showButtons, setShowButtons] = useState(false);

  return (
    <div>
      <div className="relative mb-5 flex flex-col items-center justify-center gap-1">
        <motion.button
          whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
          whileTap={{ scale: 1.5, transition: { duration: 0.2 } }}
          className={cn(
            "aspect-square w-20 rounded-full border-2 border-black/5 bg-white text-center text-[40px] shadow-lg shadow-black/10 transition-all",
            showButtons
              ? "border-primary bg-primary/5"
              : feedback?.quickActions.length
                ? "border-primary"
                : "",
          )}
          onClick={() => setShowButtons(!showButtons)}
        >
          {showButtons ? "❌" : QUICK_ACTIONS_ICON}
        </motion.button>
        <p className="pointer-events-none absolute w-32 pt-[104px] text-center text-sm font-medium text-muted-foreground">
          {QUICK_ACTIONS_TITLE}
        </p>
      </div>
      <AnimatePresence>
        {showButtons && (
          <motion.div
            className="absolute -top-[290px] flex flex-col gap-4"
            initial={{ opacity: 0, y: 100, x: -50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, x: -50, scale: 0.5 }}
          >
            {quickActions.map((action) => (
              <div key={action.id} className="relative w-[300px]">
                <p className="pointer-events-none absolute -left-3 top-1/2 line-clamp-1 -translate-x-full -translate-y-1/2 rounded-full bg-white/60 p-2 text-sm font-medium text-muted-foreground backdrop-blur-sm">
                  {action.description}
                </p>
                <motion.button
                  whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 1.5, transition: { duration: 0.2 } }}
                  className={cn(
                    "relative aspect-square w-20 rounded-full border-2 border-black/5 bg-white text-center text-[40px] shadow-lg shadow-black/10 transition-all",
                    feedback?.quickActions.includes(action.id)
                      ? "border-primary bg-primary/5"
                      : "",
                  )}
                  onClick={() => {
                    if (feedback) {
                      const updatedFeedback = {
                        ...feedback,
                        quickActions: feedback.quickActions.includes(action.id)
                          ? feedback.quickActions.filter(
                              (key) => key !== action.id,
                            )
                          : [...feedback.quickActions, action.id],
                      };
                      setFeedback(updatedFeedback);
                    }
                    setShowButtons(false);
                  }}
                >
                  {action.icon}
                </motion.button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
