"use client";

import { type Event } from "@prisma/client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { formatDateDDMMYYYY, parseDateDDMMYYYY } from "~/lib/singaporeDate";
import {
  DEFAULT_EVENT_CONFIG,
  EVENT_TEMPLATES,
  type EventConfig,
  VOTING_UNITS,
  votingSettings,
} from "~/lib/types/eventConfig";
import { api } from "~/trpc/react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";

import { DeleteEventButton } from "./DeleteEvent";
import { env } from "~/env";

const generateRandomId = () => {
  return Math.random().toString(36).substring(2, 5).toUpperCase();
};

export function UpsertEventModal({
  event,
  onSubmit,
  onDeleted,
  open,
  onOpenChange,
}: {
  event?: Event;
  onSubmit: (event: Event) => void;
  onDeleted: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [defaultId] = useState(() => generateRandomId());
  const [template, setTemplate] = useState<EventConfig["template"] | "">(
    event ? (event.config as EventConfig)?.template ?? "" : "pitching",
  );
  const [isPitchNight, setIsPitchNight] = useState(
    event ? (event.config as EventConfig)?.isPitchNight ?? false : true,
  );
  const [useTestData, setUseTestData] = useState(false);
  const initialSettings = votingSettings(event?.config ?? DEFAULT_EVENT_CONFIG);
  const [votingMode, setVotingMode] = useState(initialSettings.mode);
  const [votingUnit, setVotingUnit] = useState(initialSettings.unit);
  const [stickerAllowance, setStickerAllowance] = useState(
    initialSettings.mode === "stickers" ? initialSettings.budget : 5,
  );
  const [feedbackGoal, setFeedbackGoal] = useState(
    (event?.config as EventConfig)?.feedbackGoal?.toString() ?? "",
  );
  const upsertMutation = api.event.upsert.useMutation();
  const populateTestDataMutation = api.event.populateTestData.useMutation();

  const isDevMode = env.NEXT_PUBLIC_NODE_ENV === "development";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    values: {
      name: event?.name ?? "",
      id: event?.id ?? defaultId,
      date: formatDateDDMMYYYY(event?.date ?? new Date()),
      url: event?.url ?? "",
      joinCode: event?.joinCode ?? "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit" : "Create New"} Event</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => {
            const parsedDate = parseDateDDMMYYYY(data.date);
            if (!parsedDate) {
              toast.error("Date must be in dd/mm/yyyy format");
              return;
            }

            const config: EventConfig = {
              ...(event?.config as EventConfig),
              template: template === "" ? undefined : template,
              isPitchNight,
              votingMode,
              votingUnit,
              stickerAllowance,
              feedbackGoal: feedbackGoal ? Number(feedbackGoal) : undefined,
            };
            upsertMutation
              .mutateAsync({
                originalId: event?.id,
                id: data.id,
                name: data.name,
                date: parsedDate,
                url: data.url,
                config,
                joinCode: data.joinCode || undefined,
              })
              .then(async (result) => {
                // If creating new event and test data checkbox is checked, populate test data
                if (!event && useTestData && isDevMode) {
                  try {
                    await populateTestDataMutation.mutateAsync({
                      eventId: result.id,
                      isPitchNight,
                    });
                    toast.success("Successfully created event with test data!");
                  } catch (testDataError) {
                    // Event was created successfully, but test data failed
                    toast.warning(
                      `Event created, but test data population failed: ${(testDataError as Error).message}`,
                    );
                  }
                } else {
                  toast.success(
                    `Successfully ${event ? "updated" : "created"} event!`,
                  );
                }
                onOpenChange(false);
                onSubmit(result);
              })
              .catch((error) => {
                toast.error(
                  `Failed to ${event ? "update" : "create"} event: ${error.message}`,
                );
              });
          })}
          className="flex min-w-0 flex-col gap-4"
        >
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Name</span>
            <input
              type="text"
              {...register("name", { required: true })}
              className="rounded-md border border-gray-200 p-2"
              placeholder="SF Demo Night 🚀"
              autoComplete="off"
              autoFocus
            />
          </label>
          <input type="hidden" {...register("id")} required />
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Date</span>
            <input
              type="text"
              {...register("date", { required: true })}
              className="rounded-md border border-gray-200 p-2"
              placeholder="dd/mm/yyyy"
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">URL (Optional)</span>
            <input
              type="url"
              {...register("url")}
              className="rounded-md border border-gray-200 p-2"
              autoComplete="off"
              placeholder="https://lu.ma/demo-night"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Join code (Optional)</span>
            <input
              type="text"
              {...register("joinCode", {
                pattern: /^[A-Za-z0-9]{4}$/,
              })}
              className="rounded-md border border-gray-200 p-2 font-mono uppercase tracking-widest"
              autoComplete="off"
              maxLength={4}
              placeholder="Generated automatically"
            />
            {errors.joinCode ? (
              <span className="text-sm text-red-600">
                Join codes must be exactly 4 letters or digits.
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                4 letters or digits attendees enter to join while the event is
                live.
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Event template</span>
            <select
              className="w-full min-w-0 rounded-md border p-2"
              value={template}
              onChange={(e) => {
                const next = e.target.value as NonNullable<
                  EventConfig["template"]
                >;
                setTemplate(next);
                const defaults = EVENT_TEMPLATES[next].defaults;
                setIsPitchNight(defaults.isPitchNight);
                setVotingMode(defaults.votingMode);
                setVotingUnit(defaults.votingUnit);
              }}
            >
              {!template && (
                <option value="" disabled>
                  Legacy event — existing behaviour
                </option>
              )}
              {Object.entries(EVENT_TEMPLATES).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              {template
                ? EVENT_TEMPLATES[template].description
                : "Existing branding, voting and results are preserved."}{" "}
              Templates are starting points; customise settings below.
              {event &&
                " Existing awards and feedback are kept. Edit categories in Awards & Voting. Templates and allowances cannot change after votes are recorded."}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Voting mechanics</span>
            <select
              className="w-full min-w-0 rounded-md border p-2"
              value={votingMode}
              onChange={(e) =>
                setVotingMode(e.target.value as typeof votingMode)
              }
            >
              <option value="allocation">Allocation — 100,000 per award</option>
              {template !== "categories" && (
                <option value="stickers">Favourite stickers</option>
              )}
              <option value="awards">
                One choice per{" "}
                {template === "categories" ? "category" : "award"}
              </option>
            </select>
          </label>
          {votingMode === "allocation" && (
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Displayed unit</span>
              <select
                className="w-full min-w-0 rounded-md border p-2"
                value={votingUnit}
                onChange={(e) =>
                  setVotingUnit(e.target.value as typeof votingUnit)
                }
              >
                {Object.entries(VOTING_UNITS).map(([key, unit]) => (
                  <option key={key} value={key}>
                    {unit.symbol} {unit.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {votingMode === "stickers" && (
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Favourite sticker allowance</span>
              <input
                className="rounded-md border p-2"
                type="number"
                min={1}
                max={10}
                required
                value={stickerAllowance}
                onChange={(e) => setStickerAllowance(Number(e.target.value))}
              />
              <span className="text-sm text-gray-500">
                Five by default, one per project, shared across the event. Uses
                the first-place award.
              </span>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-semibold">
              Personal feedback goal (optional)
            </span>
            <input
              className="rounded-md border p-2"
              type="number"
              min={1}
              max={100}
              value={feedbackGoal}
              onChange={(e) => setFeedbackGoal(e.target.value)}
            />
            <span className="text-sm text-gray-500">
              Distinct projects, not comments. No leaderboard or required
              sequence.
            </span>
          </label>
          {!event && isDevMode && (
            <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <Switch
                id="useTestData"
                checked={useTestData}
                onCheckedChange={(checked) => setUseTestData(checked === true)}
                className="mt-0.5 select-none data-[state=checked]:border-yellow-500 data-[state=checked]:bg-yellow-500"
              />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="useTestData"
                  className="cursor-pointer font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Use Test Data (Dev Only)
                </label>
                <p className="text-sm text-gray-600">
                  Populate the event with 10 demo companies, 10 attendees,
                  feedback entries, and sample votes. Great for testing!
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={upsertMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary-dark"
            >
              {event ? "Update Event" : "Create Event"}
            </Button>
            {event && (
              <DeleteEventButton eventId={event.id} onDeleted={onDeleted} />
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
