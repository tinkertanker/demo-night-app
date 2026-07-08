import { getBrandingClient } from "~/lib/branding";
import { type EventConfig } from "~/lib/types/eventConfig";
import { type CompleteEvent } from "~/server/api/routers/event";

import Button from "~/components/Button";
import { useModal } from "~/components/modal/provider";

type ActionItem = {
  icon: string;
  title?: string;
  description?: string;
};

const actionItems: ActionItem[] = [
  {
    icon: "👏",
    title: "Clap:",
    description: "Show your appreciation — tap as many times as you like!",
  },
  {
    icon: "🥳",
    title: "Cheer:",
    description: "Big moment? Let them know you loved it!",
  },
  {
    icon: "🎉",
    title: "Celebrate:",
    description: "Shower the demo with confetti!",
  },
];

export default function InfoModal({ event }: { event: CompleteEvent }) {
  const config = event.config as EventConfig;
  const { isPitchNight } = getBrandingClient(config?.isPitchNight);
  const modal = useModal();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        modal?.hide();
      }}
      className="flex w-full flex-col items-center gap-8 font-medium"
    >
      <div>
        <h1 className="line-clamp-1 text-center text-4xl font-bold tracking-tight">
          About Actions
        </h1>
        <p className="text-md max-w-[330px] pt-2 text-center font-medium leading-5 text-gray-500">
          Now&apos;s your chance to engage with the{" "}
          {isPitchNight ? "pitches" : "demos"}! Presenters will receive a
          summary of all feedback after the event and can follow up!
        </p>
      </div>
      <ul className="text-md flex w-full flex-col gap-2 font-semibold leading-6 text-gray-700">
        {actionItems.map((item) => (
          <li key={item.icon} className="flex items-center gap-3">
            <span className="text-4xl">{item.icon}</span>
            <p>
              <span className="font-bold text-black">{item.title} </span>
              {item.description}
            </p>
          </li>
        ))}
      </ul>
      <Button pending={false} isPitchNight={isPitchNight}>
        Got it!
      </Button>
    </form>
  );
}
