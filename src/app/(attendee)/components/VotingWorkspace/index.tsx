import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import DemosWorkspace from "../DemosWorkspace";
import {
  type FeedbackByDemoId,
  useFeedback,
} from "../DemosWorkspace/hooks/useFeedback";
import { SurveyCTA } from "../SurveyCTA";
import { type Award } from "@prisma/client";
import { useState } from "react";

import { liveQueryOptions } from "~/lib/liveQuery";
import { stickerAwardId } from "~/lib/types/award";
import { type EventConfig } from "~/lib/types/eventConfig";
import { votingSettings } from "~/lib/types/eventConfig";
import { type PublicDemo } from "~/server/api/routers/event";
import { api } from "~/trpc/react";

import Button from "~/components/Button";
import Sticker from "~/components/Sticker";
import LoadingScreen from "~/components/loading/LoadingScreen";

import AwardVoteSelect from "./AwardVoteSelect";
import InvestmentAmountSelect from "./InvestmentAmountSelect";
import { type VoteByAwardId, useVotes } from "./hooks/useVotes";
import { UpdateAttendeeForm } from "~/app/(attendee)/components/UpdateAttendee";

export default function VotingWorkspace() {
  const { currentEvent, attendee, setAttendee, config } = useWorkspaceContext();
  const {
    data: status,
    isError,
    refetch,
  } = api.attendee.votingStatus.useQuery(
    { eventId: currentEvent.id, attendeeId: attendee.id },
    liveQueryOptions(),
  );
  if (isError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4 text-center">
        <p role="alert">Could not check your voting status.</p>
        <Button onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  }
  if (!status) return <LoadingScreen />;
  if (status.excluded) {
    return (
      <div
        className="mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center"
        role="status"
      >
        <Sticker name="face" size={104} />
        <h1 className="text-2xl font-bold">
          Your {votingSettings(config).financial ? "investments" : "votes"} are
          not counted
        </h1>
        <p className="text-gray-600">
          The organiser has excluded your entry from this event. Please speak to
          them if this is a mistake.
        </p>
      </div>
    );
  }
  if (status.nameRequired) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-8">
        <UpdateAttendeeForm
          attendee={attendee}
          setAttendee={setAttendee}
          isPitchNight={config.isPitchNight}
          isPreDemo={false}
          isJoining
        />
      </div>
    );
  }
  return <VotingContent />;
}

function VotingContent() {
  const { currentEvent, event, attendee } = useWorkspaceContext();
  const { feedbackByDemoId } = useFeedback(
    currentEvent.id,
    attendee,
    event.demos[0]!,
  );
  const config = event.config as EventConfig;
  const settings = votingSettings(config);
  const { votes, setVote } = useVotes(
    currentEvent.id,
    attendee,
    settings.categories,
  );
  const [showPostcards, setShowPostcards] = useState(false);
  const surveyUrl = config?.surveyUrl;

  const votableAwards = event.awards.filter(
    (award) =>
      award.votable &&
      (settings.mode !== "stickers" ||
        award.id === stickerAwardId(event.awards)),
  );

  const markSurveyOpenedMutation =
    api.eventFeedback.markSurveyOpened.useMutation();

  const handleSurveyClick = () => {
    markSurveyOpenedMutation.mutate({
      eventId: currentEvent.id,
      attendeeId: attendee.id,
    });
  };

  return (
    <div className="w-full max-w-xl">
      <div className="flex justify-center gap-2 p-3">
        <button
          className="rounded-lg border bg-white px-4 py-2"
          aria-pressed={!showPostcards}
          onClick={() => setShowPostcards(false)}
        >
          Voting
        </button>
        <button
          className="rounded-lg border bg-white px-4 py-2"
          aria-pressed={showPostcards}
          onClick={() => setShowPostcards(true)}
        >
          Feedback postcards
        </button>
      </div>
      <div hidden={!showPostcards}>
        <DemosWorkspace />
      </div>
      <div hidden={showPostcards}>
        <div className="flex size-full flex-col items-center justify-center gap-4 p-4">
          <Sticker name="heart" size={104} className="-mb-2" />
          <div>
            <h1 className="text-center text-4xl font-bold tracking-tight">
              {settings.financial
                ? "Investing Time! 💰"
                : settings.mode === "stickers"
                  ? "Choose your favourites! ⭐"
                  : settings.mode === "awards"
                    ? "Voting Time! 🗳️"
                    : `Give your support! ${settings.symbol}`}
            </h1>
            <p className="text-md max-w-[330px] pt-2 text-center font-medium leading-5 text-gray-500">
              {settings.weighted
                ? `You have ${settings.format(settings.budget)} ${settings.name} ${settings.mode === "stickers" ? "to give to your favourite projects" : "to allocate to your favourites"}.`
                : settings.categories
                  ? "Choose one project per category. The same project can win more than one category. Each category is tallied independently."
                  : settings.showResults
                    ? "Who gets immortalized in the Demo Night Hall of Fame? You decide! Note that you can only vote for each demoist once so choose wisely!"
                    : "Choose your favourite project. There are no public rankings or winners."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-8">
            {settings.weighted
              ? // Allocation and sticker votes share amount-based results.
                votableAwards.map((award) => (
                  <InvestmentAmountSelect
                    key={award.id}
                    award={award}
                    demos={event.demos}
                    eventId={currentEvent.id}
                    attendeeId={attendee.id}
                  />
                ))
              : // Demo Night: Show traditional voting interface
                votableAwards.map((award) => (
                  <AwardVoteItem
                    key={award.id}
                    award={award}
                    demos={event.demos}
                    votes={votes}
                    setVote={setVote}
                    feedbackByDemoId={feedbackByDemoId}
                  />
                ))}
          </div>
          {surveyUrl && (
            <SurveyCTA
              surveyUrl={surveyUrl}
              onSurveyClick={handleSurveyClick}
              className="z-10"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AwardVoteItem({
  award,
  demos,
  votes,
  setVote,
  feedbackByDemoId,
}: {
  award: Award;
  demos: PublicDemo[];
  votes: VoteByAwardId;
  setVote: (awardId: string, demoId: string | null) => void;
  feedbackByDemoId: FeedbackByDemoId;
}) {
  return (
    <div className="flex flex-col font-medium">
      <h2 className="text-2xl font-bold">{award.name}</h2>
      <p className="text-md pb-2 pl-[2px] text-lg font-semibold italic leading-6 text-gray-500">
        {award.description}
      </p>
      <AwardVoteSelect
        award={award}
        demos={demos}
        votes={votes}
        onSelect={setVote}
        feedbackByDemoId={feedbackByDemoId}
      />
    </div>
  );
}
