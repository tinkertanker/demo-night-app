import { useDashboardContext } from "../../contexts/DashboardContext";
import { LiveIndicator } from "../LiveIndicator";
import { type Demo } from "@prisma/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  EyeIcon,
  Radio,
  Trash,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { feedbackScore } from "~/lib/feedback";
import { EventPhase } from "~/lib/types/currentEvent";
import { type EventConfig } from "~/lib/types/eventConfig";
import { cn } from "~/lib/utils";
import { type FeedbackAndAttendee } from "~/server/api/routers/demo";
import { api } from "~/trpc/react";

import AttendeeTypeBadge from "~/components/AttendeeTypeBadge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import Sticker from "~/components/Sticker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import FeedbackOverview from "./FeedbackOverview";
import { env } from "~/env";

const REFRESH_INTERVAL =
  env.NEXT_PUBLIC_NODE_ENV === "development" ? 1_000 : 5_000;

export default function DemosAndFeedbackTab() {
  const { currentEvent, event, refetchEvent } = useDashboardContext();
  const eventConfig = event?.config as EventConfig;
  const isPitchNight = eventConfig?.isPitchNight ?? false;
  const itemLabel = isPitchNight ? "pitch" : "demo";
  const listLabel = isPitchNight ? "Pitches" : "Demos";
  const isDemoPhase =
    currentEvent?.id === event?.id && currentEvent?.phase === EventPhase.Demos;
  const [selectedDemo, setSelectedDemo] = useState<Demo | undefined>(
    event?.demos.find((demo) => demo.id === currentEvent?.currentDemoId),
  );

  const votableIndices = useMemo(() => {
    if (!event) return new Map<string, number>();
    const votableDemos = event.demos.filter((d) => d.votable);
    return new Map(votableDemos.map((d, i) => [d.id, i + 1]));
  }, [event]);

  const { data: feedback, refetch: refetchFeedback } =
    api.demo.getFeedback.useQuery(selectedDemo?.id ?? "", {
      enabled: !!selectedDemo,
      refetchInterval:
        currentEvent?.id === event?.id ? REFRESH_INTERVAL : false,
    });

  const scoredFeedback = useMemo(() => {
    if (!feedback) return [];
    return feedback.sort((a, b) => feedbackScore(b) - feedbackScore(a));
  }, [feedback]);

  const updateCurrentEventStateMutation =
    api.event.updateCurrentState.useMutation();
  const deleteFeedbackMutation = api.feedback.delete.useMutation();

  const currentDemoIndex = useMemo(() => {
    if (!event || !currentEvent?.currentDemoId) return -1;
    return event.demos.findIndex((d) => d.id === currentEvent.currentDemoId);
  }, [event, currentEvent?.currentDemoId]);

  const liveDemo = currentDemoIndex >= 0 ? event?.demos[currentDemoIndex] : undefined;
  const prevDemo =
    currentDemoIndex > 0 ? event?.demos[currentDemoIndex - 1] : undefined;
  const nextDemo =
    currentDemoIndex >= 0 && event && currentDemoIndex < event.demos.length - 1
      ? event.demos[currentDemoIndex + 1]
      : undefined;

  const goLive = useCallback(
    (demo: Demo) => {
      setSelectedDemo(demo);
      if (!isDemoPhase) return;
      updateCurrentEventStateMutation
        .mutateAsync({ currentDemoId: demo.id })
        .then(() => refetchEvent());
    },
    [isDemoPhase, updateCurrentEventStateMutation, refetchEvent],
  );

  if (!event) return null;

  const demoList = (
    <DemoList
      demos={event.demos}
      selectedDemoId={selectedDemo?.id}
      liveDemoId={isDemoPhase ? currentEvent?.currentDemoId : undefined}
      votableIndices={votableIndices}
      isDemoPhase={isDemoPhase}
      listLabel={listLabel}
      onSelect={(demo) => goLive(demo)}
      onPeek={(demo) => setSelectedDemo(demo)}
    />
  );

  const feedbackPanel = (
    <FeedbackPanel
      selectedDemo={selectedDemo}
      feedback={feedback ?? []}
      scoredFeedback={scoredFeedback}
      onDelete={(id) =>
        deleteFeedbackMutation
          .mutateAsync(id)
          .then(() => refetchFeedback())
      }
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      {isDemoPhase && (
        <StageControls
          itemLabel={itemLabel}
          liveDemo={liveDemo}
          prevDemo={prevDemo}
          nextDemo={nextDemo}
          position={
            currentDemoIndex >= 0
              ? `${currentDemoIndex + 1} / ${event.demos.length}`
              : null
          }
          onPrev={() => prevDemo && goLive(prevDemo)}
          onNext={() => nextDemo && goLive(nextDemo)}
          isPending={updateCurrentEventStateMutation.isPending}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0">
        <div className="min-h-0 md:w-1/2 md:overflow-hidden md:pr-2">
          {demoList}
        </div>
        <div className="hidden w-px shrink-0 bg-border md:block" />
        <div className="min-h-0 md:w-1/2 md:overflow-hidden md:pl-2">
          {feedbackPanel}
        </div>
      </div>
    </div>
  );
}

function StageControls({
  itemLabel,
  liveDemo,
  prevDemo,
  nextDemo,
  position,
  onPrev,
  onNext,
  isPending,
}: {
  itemLabel: string;
  liveDemo?: Demo;
  prevDemo?: Demo;
  nextDemo?: Demo;
  position: string | null;
  onPrev: () => void;
  onNext: () => void;
  isPending: boolean;
}) {
  return (
    <div className="sticky top-[3.75rem] z-10 rounded-xl border bg-background p-2 shadow-sm md:static md:top-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-12 shrink-0 px-0"
          disabled={!prevDemo || isPending}
          onClick={onPrev}
          aria-label={`Previous ${itemLabel}`}
        >
          <ChevronLeft className="size-6" />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Radio className="size-3 text-red-500" />
            On stage
            {position && <span className="normal-case tracking-normal">· {position}</span>}
          </div>
          <p className="line-clamp-2 text-base font-semibold leading-tight md:text-lg">
            {liveDemo?.name ?? `No ${itemLabel} selected`}
          </p>
        </div>

        <Button
          variant="default"
          size="lg"
          className="h-12 w-12 shrink-0 px-0"
          disabled={!nextDemo || isPending}
          onClick={onNext}
          aria-label={`Next ${itemLabel}`}
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>
      {(prevDemo || nextDemo) && (
        <div className="mt-1.5 flex justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="line-clamp-1 min-w-0 flex-1 text-left">
            {prevDemo ? prevDemo.name : ""}
          </span>
          <span className="line-clamp-1 min-w-0 flex-1 text-right">
            {nextDemo ? nextDemo.name : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function DemoList({
  demos,
  selectedDemoId,
  liveDemoId,
  votableIndices,
  isDemoPhase,
  listLabel,
  onSelect,
  onPeek,
}: {
  demos: Demo[];
  selectedDemoId?: string;
  liveDemoId?: string | null;
  votableIndices: Map<string, number>;
  isDemoPhase: boolean;
  listLabel: string;
  onSelect: (demo: Demo) => void;
  onPeek: (demo: Demo) => void;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold md:text-2xl">{listLabel}</h2>
      <div className="max-h-[min(50vh,420px)] overflow-y-auto rounded-lg border md:max-h-[calc(100vh-180px)]">
        <Table>
          <TableHeader className="sticky top-0 z-[1] bg-background">
            <TableRow>
              <TableHead className="w-[44px]">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[44px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demos.length === 0 ? (
              <TableRow>
                <td
                  colSpan={3}
                  className="py-6 text-center italic text-muted-foreground/50"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Sticker name="gasp" size={72} />
                    No {listLabel.toLowerCase()} (yet!)
                  </div>
                </td>
              </TableRow>
            ) : (
              demos.map((demo) => (
                <TableRow
                  key={demo.id}
                  className={cn(
                    "cursor-pointer",
                    selectedDemoId === demo.id && "bg-accent",
                    liveDemoId === demo.id && "bg-primary/5",
                  )}
                  onClick={() => onSelect(demo)}
                >
                  <TableCell className="py-3 font-medium md:py-2">
                    {demo.votable ? votableIndices.get(demo.id) : "-"}
                  </TableCell>
                  <TableCell className="flex items-center gap-2 py-3 md:py-2">
                    <span className="line-clamp-2 font-semibold md:line-clamp-1">
                      {demo.name}
                    </span>
                    {liveDemoId === demo.id && <LiveIndicator />}
                  </TableCell>
                  <TableCell className="py-0">
                    {isDemoPhase && selectedDemoId !== demo.id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 md:size-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPeek(demo);
                            }}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sneak peek</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FeedbackPanel({
  selectedDemo,
  feedback,
  scoredFeedback,
  onDelete,
}: {
  selectedDemo?: Demo;
  feedback: FeedbackAndAttendee[];
  scoredFeedback: FeedbackAndAttendee[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 md:min-w-[300px]">
      <div className="flex flex-col items-start gap-2">
        <h2 className="text-xl font-semibold md:text-2xl">
          {selectedDemo?.name
            ? `Feedback for ${selectedDemo.name}`
            : "Feedback"}
        </h2>
        <FeedbackOverview feedback={feedback} />
      </div>
      <div className="max-h-[min(55vh,520px)] space-y-2 overflow-y-auto md:max-h-[calc(100vh-180px)]">
        <AnimatePresence mode="popLayout">
          {feedback.length > 0 ? (
            scoredFeedback.map((item) => (
              <FeedbackItem key={item.id} item={item} onDelete={onDelete} />
            ))
          ) : (
            <div className="p-6 text-center text-sm italic text-muted-foreground/50 md:p-10">
              No feedback (yet!)
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FeedbackItem({
  item,
  onDelete,
}: {
  item: FeedbackAndAttendee;
  onDelete: (id: string) => void;
}) {
  const summaryString = useMemo(() => {
    const summary: string[] = [];
    if (item.rating) {
      summary.push(String.fromCodePoint(48 + item.rating, 65039, 8419));
    }
    if (item.claps) {
      summary.push(`👏<span class="text-xs text-black"> x${item.claps}</span>`);
    }
    if (item.cheers) {
      summary.push(`🥳<span class="text-xs text-black"> x${item.cheers}</span>`);
    }
    if (item.confetti) {
      summary.push(
        `🎉<span class="text-xs text-black"> x${item.confetti}</span>`,
      );
    }
    return summary.join(" • ");
  }, [item]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span
              className={cn(
                "line-clamp-1 font-semibold",
                item.attendee.name?.length ?? 0 > 0
                  ? "text-black"
                  : "italic text-muted-foreground",
              )}
            >
              {item.attendee.name?.length ?? 0 > 0
                ? item.attendee.name
                : "Anonymous"}
            </span>
            <AttendeeTypeBadge type={item.attendee.type} />
            <p
              className="shrink-0 font-semibold text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: `${summaryString ? `• ${summaryString}` : ""}`,
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 md:size-8"
            onClick={() => onDelete(item.id)}
          >
            <Trash className="h-4 w-4 stroke-muted-foreground" />
          </Button>
        </CardHeader>
        <CardContent className="-mt-3 p-3 pt-0 md:-mt-4 md:p-4 md:pt-0">
          {item.comment && (
            <p className="text-sm italic">&ldquo;{item.comment}&rdquo;</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
