"use client";

import { useWorkspaceContext } from "../contexts/WorkspaceContext";
import { type Attendee } from "@prisma/client";
import { CircleUserRoundIcon } from "lucide-react";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getBrandingClient } from "~/lib/branding";
import { attendeeNameSchema } from "~/lib/voters";

import Button from "~/components/Button";
import { useModal } from "~/components/modal/provider";

export function UpdateAttendeeButton({
  attendee,
  setAttendee,
}: {
  attendee: Attendee | null;
  setAttendee: (attendee: Attendee) => Promise<void>;
}) {
  const { currentEvent } = useWorkspaceContext();
  const { isPitchNight } = getBrandingClient(currentEvent?.isPitchNight);
  const modal = useModal();
  return (
    <CircleUserRoundIcon
      className="cursor-pointer hover:opacity-50 focus:outline-none"
      size={28}
      color="black"
      onClick={() =>
        modal?.show(
          <UpdateAttendeeModal
            attendee={attendee}
            setAttendee={setAttendee}
            isPitchNight={isPitchNight}
          />,
        )
      }
    />
  );
}

export function UpdateAttendeeModal({
  attendee,
  setAttendee,
  isPitchNight,
}: {
  attendee: Attendee | null;
  setAttendee: (attendee: Attendee) => Promise<void>;
  isPitchNight: boolean;
}) {
  const modal = useModal();

  return (
    <UpdateAttendeeForm
      attendee={attendee}
      setAttendee={setAttendee}
      onSubmit={() => modal?.hide()}
      isPreDemo={false}
      isPitchNight={isPitchNight}
    />
  );
}

export function UpdateAttendeeForm({
  attendee,
  setAttendee,
  onSubmit,
  isPreDemo = true,
  isPitchNight,
  isJoining = false,
}: {
  attendee: Attendee | null;
  setAttendee: (attendee: Attendee) => Promise<void>;
  onSubmit?: () => void;
  isPreDemo?: boolean;
  isPitchNight: boolean;
  isJoining?: boolean;
}) {
  const nameId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    values: {
      name: attendee?.name ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        if (!attendee) {
          toast.error("Failed to update profile. Hang with us!");
          return;
        }
        try {
          await setAttendee({ ...attendee, name: data.name.trim() });
          const message = isJoining
            ? "Name saved!"
            : isPreDemo
              ? `Profile updated! Hang tight – ${isPitchNight ? "pitches" : "demos"} starting soon 😎`
              : "Sweet! Presenters will see your updated profile 😎";
          toast.success(message);
          onSubmit?.();
        } catch {
          toast.error("Could not save your name. Please try again.");
        }
      })}
      className="flex w-full flex-col items-center gap-4 font-medium"
    >
      <div>
        <h1 className="text-center text-4xl font-bold tracking-tight">
          {isPreDemo || isJoining ? "Enter your name" : "Update Profile 🧑‍💼"}
        </h1>
      </div>
      <div className="flex w-full flex-col gap-1">
        <label htmlFor={nameId} className="text-lg font-semibold">
          Name
        </label>
        <input
          id={nameId}
          type="text"
          placeholder="Ada Lovelace"
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${nameId}-error` : `${nameId}-hint`}
          {...register("name", {
            validate: (value) =>
              attendeeNameSchema.safeParse(value).success ||
              "Please enter your name",
          })}
          className="z-30 rounded-lg border-2 border-gray-200 bg-white/60 p-2 text-lg backdrop-blur"
        />
        <span
          id={`${nameId}-hint`}
          className="text-sm font-normal text-gray-600"
        >
          Please use your real name so the organiser can recognise you.
        </span>
        {errors.name && (
          <span
            id={`${nameId}-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.name.message}
          </span>
        )}
      </div>
      <Button isPitchNight={isPitchNight} pending={isSubmitting}>
        {isJoining ? "Continue" : "Submit"}
      </Button>
    </form>
  );
}
