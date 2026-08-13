import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { UpdateAttendeeForm } from "../UpdateAttendee";

import { LogoConfetti } from "~/components/Confetti";
import Sticker from "~/components/Sticker";

export default function PreWorkspace() {
  const { attendee, setAttendee, currentEvent } = useWorkspaceContext();
  const isPitchNight = currentEvent?.isPitchNight ?? false;
  return (
    <>
      <div className="flex w-full flex-col items-center px-4 pt-8">
        <div className="pointer-events-none flex w-full justify-center">
          <Sticker name="fingerguns" size={128} />
        </div>
        <div className="mt-6 w-full max-w-xl">
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
