import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BadgeInfo } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { APPRECIATION_BADGES, postcardProgress } from "~/lib/postcards";
import { cn } from "~/lib/utils";
import { type PublicDemo } from "~/server/api/routers/event";

import { ReactionConfetti } from "~/components/Confetti";
import RatingSlider from "~/components/RatingSlider";
import { useModal } from "~/components/modal/provider";

import { ActionButtons } from "./ActionButtons";
import { DemoSelectionHeader } from "./DemoSelectionHeader";
import InfoModal from "./InfoModal";
import { FeedbackSaveStatus, useFeedback } from "./hooks/useFeedback";

export default function DemosWorkspace() {
  const { currentEvent, event, attendee, config } = useWorkspaceContext();
  const { id: eventId, currentDemoId } = currentEvent;
  const [selectedDemo, setSelectedDemo] = useState<PublicDemo>(event.demos[0]!);
  const { feedbackByDemoId, feedback, setFeedback, saveStatus, save } =
    useFeedback(eventId, attendee, selectedDemo);
  const modal = useModal();
  const [lastCommentChange, setLastCommentChange] = useState<number | null>(
    null,
  );
  const lastDemoIndex = useRef<number>(0);
  const progress = postcardProgress(Object.values(feedbackByDemoId));

  useEffect(() => {
    if (
      currentDemoId &&
      (!lastCommentChange || Date.now() - lastCommentChange >= 3000)
    ) {
      const demo = event.demos.find((d) => d.id === currentDemoId);
      if (demo) {
        setSelectedDemo(demo);
        setLastCommentChange(null);
      }
    }
  }, [currentDemoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedDemo) {
      lastDemoIndex.current = selectedDemo.index;
    }
  }, [selectedDemo]);

  return (
    <>
      <DemoSelectionHeader
        demos={event.demos}
        selectedDemo={selectedDemo}
        setSelectedDemo={setSelectedDemo}
        currentDemoId={currentDemoId}
      />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={selectedDemo.id}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={animationVariants(
            selectedDemo.index,
            lastDemoIndex.current,
          )}
          className="flex h-full flex-col items-center justify-center gap-6 p-4 pb-16 pt-6"
        >
          <div className="-mb-3 flex flex-col items-center">
            {selectedDemo.url ? (
              <Link
                href={selectedDemo.url}
                target="_blank"
                className="group flex items-center gap-3 transition-all"
              >
                <h1 className="line-clamp-1 text-4xl font-bold tracking-tight group-hover:underline">
                  {selectedDemo.name}
                </h1>
                <ArrowUpRight
                  size={28}
                  strokeWidth={3}
                  className="-mt-[5px] aspect-square w-7 flex-none rounded-lg bg-gray-200 p-[2px] text-gray-500 group-hover:bg-gray-300 group-hover:text-gray-700"
                />
              </Link>
            ) : (
              <h1 className="line-clamp-1 text-4xl font-bold tracking-tight">
                {selectedDemo.name}
              </h1>
            )}
            {selectedDemo.description && (
              <p className="min-h-[40px] px-2 text-center text-lg font-semibold italic leading-6 text-gray-500">
                {selectedDemo.description}
              </p>
            )}
          </div>
          <ActionButtons feedback={feedback} setFeedback={setFeedback} />
          <div className="w-full px-4 pb-6 pt-4">
            <RatingSlider feedback={feedback} setFeedback={setFeedback} />
          </div>
          <div className="flex w-full flex-col items-end gap-1">
            <section className="w-full space-y-3 rounded-xl border-2 border-amber-200 bg-amber-50/90 p-4">
              <h2 className="text-xl font-bold">Feedback postcard</h2>
              <p className="text-sm text-gray-600">
                Any prompt or badge is enough. Appreciation is free and never
                uses favourite votes.
              </p>
              <p role="status" className="text-sm font-semibold">
                Your feedback passport: {progress} distinct{" "}
                {progress === 1 ? "project" : "projects"}
                {config.feedbackGoal ? ` · Goal: ${config.feedbackGoal}` : ""}
              </p>
              {(
                [
                  ["liked", "I liked…"],
                  ["wonder", "I wonder…"],
                  ["tryNext", "You could try…"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm font-semibold">
                  {label}
                  <textarea
                    aria-label={label}
                    rows={2}
                    maxLength={4000}
                    value={feedback[key] ?? ""}
                    className="mt-1 block w-full rounded-md border bg-white p-2 text-base font-normal"
                    onChange={(e) => {
                      setFeedback({ ...feedback, [key]: e.target.value });
                      setLastCommentChange(Date.now());
                    }}
                  />
                </label>
              ))}
              <div
                className="flex flex-wrap gap-2"
                aria-label="Free appreciation badges"
              >
                {APPRECIATION_BADGES.map((badge) => (
                  <button
                    key={badge}
                    type="button"
                    aria-pressed={feedback.badges.includes(badge)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm",
                      feedback.badges.includes(badge)
                        ? "border-primary bg-primary text-white"
                        : "bg-white",
                    )}
                    onClick={() =>
                      setFeedback({
                        ...feedback,
                        badges: feedback.badges.includes(badge)
                          ? feedback.badges.filter((item) => item !== badge)
                          : [...feedback.badges, badge],
                      })
                    }
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </section>
            <textarea
              aria-label="Additional comment"
              value={feedback?.comment ?? ""}
              onChange={(e) => {
                setFeedback({ ...feedback, comment: e.target.value });
                setLastCommentChange(Date.now());
              }}
              rows={3}
              className="z-10 mt-4 block w-full resize-none rounded-lg border-2 border-gray-200 bg-white/60 p-2 text-lg font-medium backdrop-blur"
              placeholder="Additional comment (optional)"
            />
            <SaveStatusIndicator status={saveStatus} />
            {saveStatus === FeedbackSaveStatus.UNSAVED && (
              <button
                className="text-sm font-semibold underline"
                onClick={save}
              >
                Save postcard
              </button>
            )}
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600"
            onClick={() => modal?.show(<InfoModal event={event} />)}
          >
            <BadgeInfo size={20} /> About this event
          </button>
        </motion.div>
      </AnimatePresence>
      <div className="z-3 pointer-events-none fixed inset-0">
        {feedback && (
          <>
            <ReactionConfetti
              demoId={feedback.demoId}
              count={feedback.claps}
              emoji="👏"
            />
            <ReactionConfetti
              demoId={feedback.demoId}
              count={feedback.cheers}
              emoji="🥳"
            />
            <ReactionConfetti
              demoId={feedback.demoId}
              count={feedback.confetti}
              emoji="🎉"
            />
          </>
        )}
      </div>
    </>
  );
}

function SaveStatusIndicator({ status }: { status: FeedbackSaveStatus }) {
  return (
    <p
      className={cn(
        "pr-3 text-sm font-semibold italic text-gray-600",
        status !== FeedbackSaveStatus.SAVED && "animate-pulse",
      )}
    >
      {status === FeedbackSaveStatus.UNSAVED && "Not saved yet"}
      {status === FeedbackSaveStatus.SAVING && "Saving..."}
      {status === FeedbackSaveStatus.SAVED && "Saved!"}
    </p>
  );
}

function animationVariants(selectedDemoIndex: number, lastDemoIndex: number) {
  const direction = selectedDemoIndex > lastDemoIndex ? 1 : -1;
  return {
    initial: { opacity: 0, y: 400 * direction, scale: 0.75 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 200, damping: 20 },
    },
    exit: {
      opacity: 0,
      scale: 0.75,
      transition: { type: "spring", stiffness: 200, damping: 20 },
    },
  };
}
