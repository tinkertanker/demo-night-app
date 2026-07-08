import { type DemoStats as Stats } from "~/server/api/routers/demo";

export default function DemoStats({
  stats,
  isPitchNight,
}: {
  stats: Stats;
  isPitchNight: boolean;
}) {
  const showMoneyRaised = isPitchNight && stats.totalMoneyRaised > 0;

  return (
    <div className="z-10 flex w-full flex-col gap-4">
      {/* Row 1 (pitch nights only): Money Raised */}
      {showMoneyRaised && (
        <div className="flex w-full flex-row gap-2 rounded-lg bg-gray-300/50 p-2 shadow-xl backdrop-blur">
          <div className="flex basis-full flex-col items-center justify-center rounded-lg bg-white/50 py-2">
            <p className="line-clamp-1 text-sm font-bold text-gray-500">
              💸 Money Raised
            </p>
            <p className="line-clamp-1 text-xl font-bold">
              ${stats.totalMoneyRaised.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Row 2: Total and reactions */}
      <div className="flex w-full flex-row gap-2 rounded-lg bg-gray-300/50 p-2 shadow-xl backdrop-blur">
        <div className="flex basis-1/4 flex-col items-center justify-center rounded-lg bg-white/50 py-2">
          <p className="line-clamp-1 text-sm font-bold text-gray-500">Total</p>
          <p className="line-clamp-1 text-xl font-bold">
            {stats.totalFeedback}
          </p>
        </div>
        <div className="flex basis-1/4 flex-col items-center justify-center rounded-lg bg-white/50 py-2">
          <p className="line-clamp-1">👏</p>
          <p className="line-clamp-1 text-xl font-bold">
            {stats.totalClaps.toLocaleString()}
          </p>
        </div>
        <div className="flex basis-1/4 flex-col items-center justify-center rounded-lg bg-white/50 py-2">
          <p className="line-clamp-1">🥳</p>
          <p className="line-clamp-1 text-xl font-bold">
            {stats.totalCheers.toLocaleString()}
          </p>
        </div>
        <div className="flex basis-1/4 flex-col items-center justify-center rounded-lg bg-white/50 py-2">
          <p className="line-clamp-1">🎉</p>
          <p className="line-clamp-1 text-xl font-bold">
            {stats.totalConfetti.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
