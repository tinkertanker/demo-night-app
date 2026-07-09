import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { UpdateAttendeeForm } from "../UpdateAttendee";

import { LogoConfetti } from "~/components/Confetti";
import Sticker from "~/components/Sticker";

export default function PreWorkspace() {
  const { attendee, setAttendee, currentEvent } = useWorkspaceContext();
  const isPitchNight = currentEvent?.isPitchNight ?? false;
  return (
    <>
      <div className="pointer-events-none flex w-full justify-center pt-4">
        <Sticker name="fingerguns" size={128} />
      </div>

      <div className="absolute bottom-0 max-h-[calc(100dvh-120px)] w-full max-w-xl">
        <div className="size-full p-4">
          <UpdateAttendeeForm
            attendee={attendee}
            setAttendee={setAttendee}
            isPitchNight={isPitchNight}
          />
        </div>
      </div>

      <div className="z-3 pointer-events-none fixed inset-0">
        <LogoConfetti />
      </div>
    </>
  );
}
