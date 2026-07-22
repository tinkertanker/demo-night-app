import { type Feedback } from "@prisma/client";
import { useMemo } from "react";

import { Card } from "~/components/ui/card";

export default function FeedbackOverview({
  feedback,
}: {
  feedback: Feedback[];
}) {
  const agg = useMemo(() => {
    const agg = {
      stars: 0,
      rating: 0,
      numRatings: 0,
      claps: 0,
      cheers: 0,
      confetti: 0,
    };
    for (const f of feedback) {
      agg.rating += f.rating ?? 0;
      agg.numRatings += f.rating ? 1 : 0;
      agg.claps += f.claps;
      agg.cheers += f.cheers;
      agg.confetti += f.confetti;
    }
    return agg;
  }, [feedback]);

  const cells = [
    {
      label: "Total",
      value: String(feedback.length),
      boldLabel: true,
    },
    {
      label: "#️⃣",
      value:
        agg.numRatings > 0 ? (agg.rating / agg.numRatings).toFixed(1) : "-",
    },
    {
      label: "👏",
      value: agg.claps.toLocaleString(),
    },
    {
      label: "🥳",
      value: agg.cheers.toLocaleString(),
    },
    {
      label: "🎉",
      value: agg.confetti.toLocaleString(),
    },
  ];

  return (
    <div className="grid w-full grid-cols-5 gap-1.5 sm:gap-2">
      {cells.map((cell) => (
        <Card
          key={cell.label}
          className="flex flex-col items-center justify-center px-1 py-1.5 sm:py-2"
        >
          <p
            className={`line-clamp-1 h-4 text-xs text-muted-foreground sm:h-5 sm:text-sm ${
              cell.boldLabel ? "font-bold" : ""
            }`}
          >
            {cell.label}
          </p>
          <p className="line-clamp-1 text-base font-bold sm:text-lg">
            {cell.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
