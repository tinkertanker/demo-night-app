"use client";

import { cn } from "~/lib/utils";
import { type DemoFeedback } from "~/server/api/routers/demo";

import PostcardContent from "~/components/PostcardContent";

export function FeedbackItem({ feedback }: { feedback: DemoFeedback }) {
  const summary = [
    feedback.claps
      ? `👏<span class="text-xs"> x${feedback.claps}</span>`
      : null,
    feedback.cheers
      ? `🥳<span class="text-xs"> x${feedback.cheers}</span>`
      : null,
    feedback.confetti
      ? `🎉<span class="text-xs"> x${feedback.confetti}</span>`
      : null,
  ].filter((s) => s) as string[];
  const summaryString = summary.join(" • ");
  return (
    <div className="z-10 flex w-full flex-col gap-1 rounded-lg bg-gray-300/50 p-4 font-medium leading-6 shadow-xl backdrop-blur">
      <div className="flex w-full items-center justify-between gap-2">
        <h3
          className={cn(
            "line-clamp-1 text-xl font-bold",
            !feedback.attendee?.name && "italic text-gray-500",
          )}
        >
          {feedback.attendee?.name ?? "Anonymous"}
        </h3>
        <p
          className="pl-2 font-semibold text-gray-500"
          dangerouslySetInnerHTML={{ __html: summaryString }}
        />
      </div>
      <PostcardContent feedback={feedback} />
    </div>
  );
}
