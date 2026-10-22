"use client";

import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { type Award } from "@prisma/client";
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
  const {
    data: votes,
    isLoading,
    isError,
    refetch,
  } = api.vote.all.useQuery({ eventId, attendeeId });
  const mutation = api.vote.upsert.useMutation({
    onSuccess: async () => {
      await utils.vote.all.invalidate({ eventId, attendeeId });
    },
    onError: (error) => toast.error(error.message),
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
  const update = (demoId: string, amount: number) =>
    mutation.mutate({ eventId, attendeeId, awardId: award.id, demoId, amount });
  return (
    <section className="w-full space-y-3">
      {settings.categories && (
        <div>
          <h2 className="text-2xl font-bold">{award.name}</h2>
          <p className="text-gray-600">{award.description}</p>
        </div>
      )}
      <div className="rounded-xl bg-primary p-4 text-white" role="status">
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
                  disabled={mutation.isPending || (!amount && remaining < 1)}
                  className="rounded-lg bg-white px-4 py-3 font-semibold disabled:opacity-50"
                  onClick={() => update(demo.id, amount ? 0 : 1)}
                >
                  {amount
                    ? "⭐ Favourite — take back"
                    : "☆ Give favourite sticker"}
                </button>
              ) : !demo.votable ? (
                <button
                  disabled={mutation.isPending}
                  className="rounded-lg bg-white px-4 py-3 font-semibold disabled:opacity-50"
                  onClick={() => update(demo.id, 0)}
                >
                  Take back {settings.format(amount)}
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    {[25000, 5000].map((step) => (
                      <button
                        key={step}
                        aria-label={`Take back ${settings.format(step)} from ${demo.name}`}
                        disabled={mutation.isPending || amount < step}
                        className="rounded-lg bg-white px-3 py-2 disabled:opacity-40"
                        onClick={() => update(demo.id, amount - step)}
                      >
                        −{settings.format(step)}
                      </button>
                    ))}
                  </div>
                  <strong>{settings.format(amount)}</strong>
                  <div className="flex gap-2">
                    {[5000, 25000].map((step) => (
                      <button
                        key={step}
                        aria-label={`${settings.financial ? "Invest" : "Give"} ${settings.format(step)} to ${demo.name}`}
                        disabled={mutation.isPending || remaining < step}
                        className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-40"
                        onClick={() => update(demo.id, amount + step)}
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
