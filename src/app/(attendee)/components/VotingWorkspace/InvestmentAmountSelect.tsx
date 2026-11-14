"use client";

import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { type Award } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";

import { votingSettings } from "~/lib/types/eventConfig";
import { type PublicDemo } from "~/server/api/routers/event";
import { api } from "~/trpc/react";

export default function InvestmentAmountSelect({
  award,
  demos,
  eventId,
  attendeeId,
}: {
  award: Award;
  demos: PublicDemo[];
  eventId: string;
  attendeeId: string;
}) {
  const { config } = useWorkspaceContext();
  const settings = votingSettings(config);
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  // Amounts the attendee has tapped but the server has not confirmed yet.
  // Clicks in the same frame read the same render, so build on these instead.
  const intended = useRef<Record<string, number>>({});
  const {
    data: votes,
    isLoading,
    isError,
    refetch,
  } = api.vote.all.useQuery({ eventId, attendeeId });
  // Taps queue one after another (same scope) and show immediately, so a quick
  // second tap is never dropped while the first one saves.
  const mutation = api.vote.upsert.useMutation({
    scope: { id: `allocation:${eventId}:${attendeeId}` },
    onMutate: (vote) => {
      utils.vote.all.setData({ eventId, attendeeId }, (old) => {
        const others = (old ?? []).filter(
          (v) => !(v.awardId === vote.awardId && v.demoId === vote.demoId),
        );
        const existing = (old ?? []).find(
          (v) => v.awardId === vote.awardId && v.demoId === vote.demoId,
        );
        return [
          ...others,
          {
            id: existing?.id ?? `pending-${vote.demoId}`,
            createdAt: existing?.createdAt ?? new Date(),
            updatedAt: new Date(),
            ...vote,
            demoId: vote.demoId ?? null,
            amount: vote.amount ?? null,
          },
        ];
      });
    },
    onError: async (error, vote) => {
      // Rejected allocations (4xx) explain themselves; a server or network
      // failure is not the attendee's fault, so offer a retry instead.
      toast.error(
        (error.data?.httpStatus ?? 500) < 500
          ? error.message
          : "Could not save that. Please try again.",
      );
      if (vote.demoId) delete intended.current[vote.demoId];
      await utils.vote.all.invalidate({ eventId, attendeeId });
    },
    onSettled: async () => {
      if (queryClient.isMutating() <= 1) {
        intended.current = {};
        await utils.vote.all.invalidate({ eventId, attendeeId });
      }
    },
  });
  if (isLoading) return <p>Loading your allowance…</p>;
  if (isError)
    return (
      <button onClick={() => void refetch()}>
        Could not load votes. Try again
      </button>
    );
  const allocations = (votes ?? []).filter(
    (vote) => settings.mode === "stickers" || vote.awardId === award.id,
  );
  const total = allocations.reduce((sum, vote) => sum + (vote.amount ?? 0), 0);
  const remaining = settings.budget - total;
  const latest = (demoId: string) =>
    intended.current[demoId] ??
    allocations.find((vote) => vote.demoId === demoId)?.amount ??
    0;
  const update = (demoId: string, next: (current: number) => number) => {
    const latestTotal = allocations.reduce(
      (sum, vote) => sum + (vote.demoId ? latest(vote.demoId) : 0),
      Object.keys(intended.current)
        .filter((id) => !allocations.some((vote) => vote.demoId === id))
        .reduce((sum, id) => sum + latest(id), 0),
    );
    const current = latest(demoId);
    const amount = next(current);
    if (amount < 0 || latestTotal - current + amount > settings.budget) return;
    intended.current[demoId] = amount;
    mutation.mutate({ eventId, attendeeId, awardId: award.id, demoId, amount });
  };
  return (
    <section className="w-full space-y-3">
      {settings.categories && (
        <div>
          <h2 className="text-2xl font-bold">{award.name}</h2>
          <p className="text-gray-600">{award.description}</p>
        </div>
      )}
      <div
        className="sticky top-20 z-10 rounded-xl bg-primary p-4 text-white shadow-md"
        role="status"
      >
        <h2 className="text-xl font-bold">
          {settings.financial
            ? "Your Scout Fund"
            : settings.mode === "stickers"
              ? "Your favourite stickers"
              : "Your support allowance"}
        </h2>
        <p>
          {settings.format(total)} {settings.financial ? "invested" : "given"} ·
          Remaining: {settings.format(remaining)}
        </p>
        {settings.mode !== "stickers" && (
          <p className="text-sm">
            {mutation.isPending
              ? "Saving…"
              : remaining < 1
                ? "✓ All spent and saved"
                : "Each tap saves automatically"}
          </p>
        )}
        {settings.mode === "stickers" && (
          <p className="mt-2 text-sm">
            One favourite sticker per project. You can take it back and choose
            another.
          </p>
        )}
      </div>
      {demos
        .filter(
          (demo) =>
            demo.votable ||
            allocations.some(
              (vote) => vote.demoId === demo.id && (vote.amount ?? 0) > 0,
            ),
        )
        .map((demo) => {
          const amount =
            allocations.find((vote) => vote.demoId === demo.id)?.amount ?? 0;
          return (
            <div
              key={demo.id}
              className="space-y-3 rounded-xl bg-gray-200/80 p-4"
            >
              <h3 className="text-xl font-bold">{demo.name}</h3>
              {!demo.votable && (
                <p className="text-sm">
                  Voting closed for this project. You can take back your
                  support.
                </p>
              )}
              {settings.mode === "stickers" ? (
                <button
                  aria-pressed={amount > 0}
                  disabled={!amount && remaining < 1}
                  className="rounded-lg bg-white px-4 py-3 font-semibold disabled:opacity-50"
                  onClick={() =>
                    update(demo.id, (current) => (current ? 0 : 1))
                  }
                >
                  {amount
                    ? "⭐ Favourite — take back"
                    : "☆ Give favourite sticker"}
                </button>
              ) : !demo.votable ? (
                <button
                  disabled={amount === 0}
                  className="rounded-lg bg-white px-4 py-3 font-semibold disabled:opacity-50"
                  onClick={() => update(demo.id, () => 0)}
                >
                  Take back {settings.format(amount)}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  <div className="flex gap-1 sm:gap-2">
                    {[25000, 5000].map((step) => (
                      <button
                        key={step}
                        aria-label={`Take back ${settings.format(step)} from ${demo.name}`}
                        disabled={amount < step}
                        className="min-h-11 whitespace-nowrap rounded-lg bg-white px-2 py-2 text-sm disabled:opacity-40 sm:px-3 sm:text-base"
                        onClick={() =>
                          update(demo.id, (current) => current - step)
                        }
                      >
                        −{settings.format(step)}
                      </button>
                    ))}
                  </div>
                  <strong>{settings.format(amount)}</strong>
                  <div className="flex gap-1 sm:gap-2">
                    {[5000, 25000].map((step) => (
                      <button
                        key={step}
                        aria-label={`${settings.financial ? "Invest" : "Give"} ${settings.format(step)} to ${demo.name}`}
                        disabled={remaining < step}
                        className="min-h-11 whitespace-nowrap rounded-lg bg-primary px-2 py-2 text-sm text-white disabled:opacity-40 sm:px-3 sm:text-base"
                        onClick={() =>
                          update(demo.id, (current) => current + step)
                        }
                      >
                        +{settings.format(step)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      <p className="text-sm text-gray-600">
        Voting never requires a postcard. Feedback and appreciation stay
        available even when your allowance runs out.
      </p>
    </section>
  );
}
