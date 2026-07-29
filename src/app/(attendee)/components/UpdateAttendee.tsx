"use client";

import { useWorkspaceContext } from "../contexts/WorkspaceContext";
import { type Attendee } from "@prisma/client";
import { CircleUserRoundIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getBrandingClient } from "~/lib/branding";

import Button from "~/components/Button";
import { useModal } from "~/components/modal/provider";

export function UpdateAttendeeButton({
  attendee,
  setAttendee,
}: {
  attendee: Attendee | null;
  setAttendee: (attendee: Attendee) => void;
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
  setAttendee: (attendee: Attendee) => void;
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
}: {
  attendee: Attendee | null;
  setAttendee: (attendee: Attendee) => void;
  onSubmit?: () => void;
  isPreDemo?: boolean;
  isPitchNight: boolean;
}) {
  const { register, handleSubmit } = useForm({
    values: {
      name: attendee?.name ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (!attendee) {
          toast.error("Failed to update profile. Hang with us!");
          return;
        }
        setAttendee({
          id: attendee.id,
          name: data.name,
          email: attendee.email,
          linkedin: attendee.linkedin,
          type: attendee.type,
        });
        const message = isPreDemo
          ? `Profile updated! Hang tight – ${isPitchNight ? "pitches" : "demos"} starting soon 😎`
          : "Sweet! Presenters will see your updated profile 😎";
        toast.success(message);
        onSubmit?.();
      })}
      className="flex w-full flex-col items-center gap-4 font-medium"
    >
      <div>
        <h1 className="text-center text-4xl font-bold tracking-tight">
          {isPreDemo ? "Welcome! 😄" : "Update Profile 🧑‍💼"}
        </h1>
      </div>
      <label className="flex w-full flex-col gap-1">
        <span className="text-lg font-semibold">Name</span>
        <input
          type="text"
          placeholder="Ada Lovelace"
          {...register("name")}
          className="z-30 rounded-lg border-2 border-gray-200 bg-white/60 p-2 text-lg backdrop-blur"
        />
      </label>
      <Button isPitchNight={isPitchNight}>Update Profile</Button>
    </form>
  );
}
