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

  return (
    <div className="flex w-full flex-row gap-2">
      <Card className="flex basis-1/5 flex-col items-center justify-center py-2">
        <p className="line-clamp-1 h-5 text-sm font-bold text-muted-foreground">
          Total
        </p>
        <p className="line-clamp-1 text-lg font-bold">{feedback.length}</p>
      </Card>
      <Card className="flex basis-1/5 flex-col items-center justify-center py-2">
        <p className="line-clamp-1 h-5 text-sm text-muted-foreground">#️⃣</p>
        <p className="line-clamp-1 text-lg font-bold">
          {agg.numRatings > 0 ? (agg.rating / agg.numRatings).toFixed(1) : "-"}
        </p>
      </Card>
      <Card className="flex basis-1/5 flex-col items-center justify-center py-2">
        <p className="line-clamp-1 h-5 text-sm text-muted-foreground">👏</p>
        <p className="line-clamp-1 text-lg font-bold">
          {agg.claps.toLocaleString()}
        </p>
      </Card>
      <Card className="flex basis-1/5 flex-col items-center justify-center py-2">
        <p className="line-clamp-1 h-5 text-sm text-muted-foreground">🥳</p>
        <p className="line-clamp-1 text-lg font-bold">
          {agg.cheers.toLocaleString()}
        </p>
      </Card>
      <Card className="flex basis-1/5 flex-col items-center justify-center py-2">
        <p className="line-clamp-1 h-5 text-sm text-muted-foreground">🎉</p>
        <p className="line-clamp-1 text-lg font-bold">
          {agg.confetti.toLocaleString()}
        </p>
      </Card>
    </div>
  );
}
