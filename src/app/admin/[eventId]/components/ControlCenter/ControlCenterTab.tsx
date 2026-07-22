import { useDashboardContext } from "../../contexts/DashboardContext";
import { AdminTab } from "../AdminSidebar";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EventPhase, displayName } from "~/lib/types/currentEvent";
import { type EventConfig } from "~/lib/types/eventConfig";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { Button } from "~/components/ui/button";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import AwardsAndVotingTab from "./AwardsAndVotingTab";
import DemosAndFeedbackTab from "./DemosAndFeedbackTab";
import { phaseConfigs } from "./PhaseConfig";

export default function ControlCenterTab({
  selectedTab,
  setSelectedTab,
}: {
  selectedTab: AdminTab;
  setSelectedTab: (tab: AdminTab) => void;
}) {
  const { currentEvent, event, refetchEvent } = useDashboardContext();
  const eventConfig = event?.config as EventConfig;
  const isPitchNight = eventConfig?.isPitchNight ?? false;
  const updateCurrentStateMutation = api.event.updateCurrentState.useMutation();
  const [suggestedPhase, setSuggestedPhase] = useState<EventPhase | null>(null);

  const setPhase = useCallback(
    (phase: EventPhase) => {
      updateCurrentStateMutation
        .mutateAsync({ phase })
        .then(() => refetchEvent());
    },
    [updateCurrentStateMutation, refetchEvent],
  );

  useEffect(() => {
    if (!currentEvent?.phase) return;

    if (
      currentEvent.phase === EventPhase.Voting ||
      currentEvent.phase === EventPhase.Results
    ) {
      setSelectedTab(AdminTab.AwardsAndVoting);
    } else {
      setSelectedTab(AdminTab.DemosAndFeedback);
    }
  }, [currentEvent?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    switch (currentEvent?.phase) {
      case EventPhase.Pre:
        if (
          currentEvent.currentDemoId === null ||
          currentEvent?.currentDemoId === event?.demos[0]?.id
        ) {
          setSuggestedPhase(EventPhase.Demos);
          return;
        }
        break;
      case EventPhase.Demos:
        const lastDemo = event?.demos[event.demos.length - 1];
        if (currentEvent?.currentDemoId === lastDemo?.id) {
          setSuggestedPhase(EventPhase.Voting);
          return;
        }
        break;
      case EventPhase.Voting:
        if (event?.awards.every((award) => award.winnerId)) {
          setSuggestedPhase(EventPhase.Results);
          return;
        }
        break;
      case EventPhase.Results:
        if (currentEvent?.currentAwardId === event?.awards[0]?.id) {
          setSuggestedPhase(EventPhase.Recap);
          return;
        }
        break;
      default:
        setSuggestedPhase(null);
    }
    setSuggestedPhase(null);
  }, [currentEvent, event?.demos, event?.awards]);

  if (!event) return null;

  const isLive = currentEvent?.id === event.id;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 md:gap-4">
      <TooltipProvider>
        <div
          className={cn(
            "sticky top-0 z-20 -mx-2 flex items-center gap-2 border-b bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            "md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
            !isLive && "md:hidden",
          )}
        >
          <SidebarTrigger className="size-11 shrink-0 md:hidden" />
          {isLive && currentEvent ? (
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-between md:overflow-visible md:pb-0">
              {phaseConfigs.map((config) => (
                <PhaseButton
                  key={config.phase}
                  config={config}
                  currentPhase={currentEvent.phase}
                  suggestedPhase={suggestedPhase}
                  isPitchNight={isPitchNight}
                  onPhaseSelect={() => setPhase(config.phase)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground md:hidden">
              Start the live event from the menu to control phases
            </p>
          )}
        </div>
      </TooltipProvider>
      <div className="min-h-0 flex-1">
        {selectedTab === AdminTab.DemosAndFeedback ? (
          <DemosAndFeedbackTab />
        ) : selectedTab === AdminTab.AwardsAndVoting ? (
          <AwardsAndVotingTab />
        ) : null}
      </div>
    </div>
  );
}

interface PhaseButtonProps {
  config: (typeof phaseConfigs)[number];
  currentPhase: EventPhase;
  suggestedPhase: EventPhase | null;
  isPitchNight: boolean;
  onPhaseSelect: () => void;
}

function PhaseButton({
  config,
  currentPhase,
  suggestedPhase,
  isPitchNight,
  onPhaseSelect,
}: PhaseButtonProps) {
  const label = displayName(config.phase, isPitchNight);
  const tooltipContent = useMemo(() => {
    if (suggestedPhase === config.phase) {
      return (
        <div className="flex items-center gap-2">
          <CircleCheck className="h-4 w-4 text-primary" />
          {config.suggestedDescription}
        </div>
      );
    }
    if (currentPhase === config.warningPhase) {
      return (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          {config.warningDescription}
        </div>
      );
    }
    return null;
  }, [config, currentPhase, suggestedPhase]);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          onClick={onPhaseSelect}
          aria-label={label}
          aria-pressed={config.phase === currentPhase}
          className={cn(
            "relative h-11 shrink-0 px-3 md:h-10 md:w-[calc(20%-0.4rem)] md:min-w-0 md:flex-none",
            config.phase === currentPhase
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "",
            currentPhase === config.warningPhase &&
              suggestedPhase !== config.phase &&
              "hover:bg-yellow-100/80 hover:text-yellow-500",
            suggestedPhase === config.phase && "animate-pulse-border border-2",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <config.icon className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">{label}</span>
            <span className="truncate text-xs sm:hidden">
              {shortPhaseLabel(config.phase, isPitchNight)}
            </span>
          </div>
        </Button>
      </TooltipTrigger>
      {tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
    </Tooltip>
  );
}

function shortPhaseLabel(phase: EventPhase, isPitchNight: boolean): string {
  switch (phase) {
    case EventPhase.Pre:
      return "Pre";
    case EventPhase.Demos:
      return isPitchNight ? "Pitch" : "Demo";
    case EventPhase.Voting:
      return isPitchNight ? "Invest" : "Vote";
    case EventPhase.Results:
      return "Results";
    case EventPhase.Recap:
      return "Recap";
  }
}
