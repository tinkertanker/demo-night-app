"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getBrandingClient } from "~/lib/branding";
import { addSingaporeDays, formatEventDate } from "~/lib/singaporeDate";
import {
  DESCRIPTION_MAX_LENGTH,
  submissionInputSchema,
  withWebScheme,
} from "~/lib/submission";
import { type EventConfig } from "~/lib/types/eventConfig";
import { TAGLINE_MAX_LENGTH } from "~/lib/types/taglineMaxLength";
import { cn } from "~/lib/utils";
import { type CompleteEvent } from "~/server/api/routers/event";
import { api } from "~/trpc/react";

import Button from "~/components/Button";
import { LogoConfetti } from "~/components/Confetti";
import Sticker from "~/components/Sticker";

const DEMO_GUIDELINES_URL =
  "https://theaicollective.notion.site/demo-night-guidelines";
const PITCH_GUIDELINES_URL =
  "https://theaicollective.notion.site/pitch-night-guidelines";

const emptyForm = {
  name: "",
  tagline: "",
  description: "",
  email: "",
  url: "",
  pocName: "",
  demoUrl: "",
};

export default function SubmitDemoPage({ event }: { event: CompleteEvent }) {
  return (
    <>
      <div className="absolute bottom-0 max-h-[calc(100dvh-120px)] w-full max-w-2xl">
        <div className="size-full p-4">
          <SubmitDemoForm event={event} />
        </div>
      </div>

      <div className="z-3 pointer-events-none fixed inset-0">
        <LogoConfetti />
      </div>
    </>
  );
}

export function SubmitDemoForm({ event }: { event: CompleteEvent }) {
  const branding = getBrandingClient(
    (event.config as EventConfig | null)?.isPitchNight ?? false,
  );
  const createMutation = api.submission.create.useMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
    reset,
  } = useForm({ defaultValues: emptyForm });

  // Keep a draft on this device so a reload does not lose what was typed.
  const draftKey = `submissionDraft:${event.id}`;
  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft)
        reset({
          ...emptyForm,
          ...(JSON.parse(draft) as Partial<typeof emptyForm>),
        });
    } catch {
      localStorage.removeItem(draftKey);
    }
    const subscription = watch((values) =>
      localStorage.setItem(draftKey, JSON.stringify(values)),
    );
    return () => subscription.unsubscribe();
  }, [draftKey, reset, watch]);
  const descriptionLength = watch("description")?.trim().length ?? 0;

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        await createMutation
          .mutateAsync({
            eventId: event.id,
            name: data.name,
            tagline: data.tagline,
            description: data.description,
            email: data.email,
            url: withWebScheme(data.url),
            pocName: data.pocName,
            demoUrl: withWebScheme(data.demoUrl),
          })
          .then(() => {
            localStorage.removeItem(draftKey);
            toast.success(
              `Successfully submitted ${branding.isPitchNight ? "pitch" : "demo"}!`,
            );
            window.location.href = `${window.location.pathname}?success=true`;
          })
          .catch((error: { message: string; data?: unknown }) => {
            // Show server validation next to the field instead of raw JSON.
            const fieldErrors = (
              error.data as {
                zodError?: { fieldErrors?: Record<string, string[]> };
              } | null
            )?.zodError?.fieldErrors;
            const fields = Object.entries(fieldErrors ?? {});
            if (fields.length) {
              for (const [field, messages] of fields) {
                setError(field as keyof typeof data, {
                  message: messages[0],
                });
              }
              toast.error("Please fix the highlighted fields.");
            } else {
              toast.error(
                error.message.startsWith("[")
                  ? "Something went wrong. Please check the form and try again."
                  : error.message,
              );
            }
          });
      })}
      className="flex w-full flex-col items-center gap-4 font-medium"
    >
      <div>
        <Sticker name="handraise" size={120} className="mx-auto" />
        <h1 className="text-center text-4xl font-bold tracking-tight">
          {branding.isPitchNight
            ? "Submit Your Pitch! 🚀"
            : "Submit Your Demo! 🚀"}
        </h1>
        <p className="text-md max-w-xl pt-2 text-center font-medium leading-5 text-gray-500">
          We are so excited to see what you&apos;ve been building! Submissions
          close at 11:59pm Singapore time on{" "}
          {formatEventDate(addSingaporeDays(event.date, -1))}.{" "}
          {event.url && (
            <>
              For more info, see our{" "}
              <a
                href={event.url}
                className="text-blue-500 underline"
                target="_blank"
              >
                event page
              </a>
              !{" "}
            </>
          )}
          {branding.isPitchNight
            ? "Pitches will be timed at five minutes."
            : "Demos will be timed at three minutes."}{" "}
          Please read our{" "}
          <a
            href={
              branding.isPitchNight ? PITCH_GUIDELINES_URL : DEMO_GUIDELINES_URL
            }
            className="text-blue-500 underline"
            target="_blank"
          >
            {branding.isPitchNight ? "pitch" : "demo"} guidelines
          </a>
          !
        </p>
      </div>
      <div className="flex w-full flex-col gap-4 md:flex-row">
        <label className="flex w-full flex-col gap-1">
          <span className="text-lg font-semibold">
            {branding.isPitchNight ? "Startup Name" : "Demo / Startup Name"}
          </span>
          <input
            type="text"
            placeholder="The AI Collective"
            {...register("name", {
              required: `${branding.isPitchNight ? "Startup" : "Startup / demo"} name is required`,
              validate: (value) =>
                !!value.trim() ||
                `${branding.isPitchNight ? "Startup" : "Startup / demo"} name is required`,
            })}
            maxLength={100}
            className={cn(
              "z-10 rounded-lg border-2 bg-white/60 p-2 text-lg backdrop-blur",
              errors.name ? "border-red-500" : "border-gray-200",
            )}
          />
          {errors.name && (
            <span className="text-red-500">{errors.name.message}</span>
          )}
        </label>
        <label className="flex w-full flex-col gap-1">
          <span className="text-lg font-semibold">
            {branding.isPitchNight
              ? "Startup Website"
              : "Demo / Startup Website"}
          </span>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="aicollective.com"
            {...register("url", {
              required: `${branding.isPitchNight ? "Startup" : "Startup / demo"} website is required`,
              validate: (value) =>
                submissionInputSchema.shape.url.safeParse(withWebScheme(value))
                  .success ||
                "Please enter a website address, like aicollective.com",
            })}
            className={cn(
              "z-10 rounded-lg border-2 bg-white/60 p-2 text-lg backdrop-blur",
              errors.url ? "border-red-500" : "border-gray-200",
            )}
          />
          {errors.url && (
            <span className="text-red-500">{errors.url.message}</span>
          )}
        </label>
      </div>
      <div className="flex w-full flex-col gap-4 md:flex-row">
        <label className="flex w-full flex-col gap-1">
          <span className="text-lg font-semibold">Your Name</span>
          <input
            type="text"
            placeholder="Ada Lovelace"
            autoComplete="name"
            maxLength={100}
            {...register("pocName", {
              required: "Your name is required",
              validate: (value) => !!value.trim() || "Your name is required",
            })}
            className={`z-10 rounded-lg border-2 p-2 text-lg backdrop-blur ${errors.pocName ? "border-red-500" : "border-gray-200 bg-white/60"}`}
          />
          {errors.pocName && (
            <span className="text-red-500">{errors.pocName.message}</span>
          )}
        </label>
        <label className="flex w-full flex-col gap-1">
          <span className="text-lg font-semibold">Your Email</span>
          <input
            type="email"
            placeholder="ada@aicollective.com"
            autoComplete="email"
            {...register("email", {
              required: "Your email is required",
              validate: (value) =>
                submissionInputSchema.shape.email.safeParse(value).success ||
                "Please enter a valid email address, like ada@example.com",
            })}
            className={cn(
              "z-10 rounded-lg border-2 bg-white/60 p-2 text-lg backdrop-blur",
              errors.email ? "border-red-500" : "border-gray-200",
            )}
          />
          <span className="text-sm text-gray-500">
            Only organisers see this.
          </span>
          {errors.email && (
            <span className="text-red-500">{errors.email.message}</span>
          )}
        </label>
      </div>
      <label className="flex w-full flex-col gap-1">
        <div className="flex w-full flex-row items-center justify-start gap-1 font-semibold">
          <span className="text-lg">Tagline 👋</span>
          {watch("tagline")?.length >= 100 && (
            <span
              className={cn(
                "text-sm italic",
                watch("tagline")?.length >= TAGLINE_MAX_LENGTH
                  ? "text-red-500"
                  : "text-gray-400",
              )}
            >
              {`(${watch("tagline").length} / ${TAGLINE_MAX_LENGTH})`}
            </span>
          )}
        </div>
        <span className="italic text-gray-400">
          {branding.isPitchNight
            ? "Please describe your startup in 120 characters or less!"
            : "Please describe your startup / demo in 120 characters or less!"}
        </span>
        <textarea
          placeholder="Building a global community of the brightest minds in AI to discuss, exchange, and innovate."
          {...register("tagline", {
            required: "Tagline is required",
            validate: (value) => !!value.trim() || "Tagline is required",
            maxLength: {
              value: TAGLINE_MAX_LENGTH,
              message: `Tagline must be ${TAGLINE_MAX_LENGTH} characters or less`,
            },
          })}
          className={cn(
            "z-10 max-h-32 min-h-10 rounded-lg border-2 bg-white/60 p-2 text-lg backdrop-blur",
            errors.tagline ? "border-red-500" : "border-gray-200",
          )}
          rows={2}
        />
        {errors.tagline && (
          <span className="text-red-500">{errors.tagline.message}</span>
        )}
      </label>
      <label className="flex w-full flex-col gap-1">
        <div className="flex w-full flex-row items-center justify-start gap-1 font-semibold">
          <span className="text-lg">
            {branding.isPitchNight
              ? "Pitch Description 🧑‍💻"
              : "Demo Description 🧑‍💻"}
          </span>
          <span
            className={cn(
              "text-sm italic",
              descriptionLength > DESCRIPTION_MAX_LENGTH
                ? "text-red-500"
                : "text-gray-400",
            )}
          >
            {`(${descriptionLength} / ${DESCRIPTION_MAX_LENGTH})`}
          </span>
        </div>
        <span className="italic text-gray-400">
          {branding.isPitchNight
            ? "What does your startup do? What will you pitch during your five minutes? What feedback would you like from investors and the community?"
            : "What does your startup do? What do you plan to demo to the community during your three minutes? What feedback would you like from the community?"}
        </span>
        <textarea
          placeholder="Tell us more!"
          {...register("description", {
            required: `${branding.isPitchNight ? "Pitch" : "Demo"} description is required`,
            // Checked here instead of a maxLength attribute, which silently
            // cuts pasted text. Trimmed, like the server checks it.
            validate: (value) =>
              !value.trim()
                ? `${branding.isPitchNight ? "Pitch" : "Demo"} description is required`
                : value.trim().length <= DESCRIPTION_MAX_LENGTH ||
                  `Please keep this under ${DESCRIPTION_MAX_LENGTH} characters`,
          })}
          className={cn(
            "z-30 max-h-96 min-h-24 rounded-lg border-2 bg-white/60 p-2 text-lg backdrop-blur",
            errors.description ? "border-red-500" : "border-gray-200",
          )}
          rows={3}
        />
        {errors.description && (
          <span className="text-red-500">{errors.description.message}</span>
        )}
      </label>
      <label className="flex w-full flex-col gap-1">
        <div className="flex w-full flex-row items-center justify-start gap-1 font-semibold">
          <span className="text-lg ">
            {branding.isPitchNight ? "Additional Resources 🔗" : "Demo Link 🔗"}
          </span>
          <span className="text-sm italic text-gray-400">(optional)</span>
        </div>
        <span className="italic text-gray-400">
          {branding.isPitchNight
            ? "Have a link that showcases your startup? (e.g., pitch deck, demo video, website)"
            : "Do you have a link that shows what you plan to demo (for example a video or slides)? Paste it here."}
        </span>
        <input
          type="text"
          inputMode="url"
          placeholder="youtube.com/watch?v=dQw4w9WgXcQ"
          {...register("demoUrl", {
            validate: (value) =>
              !value.trim() ||
              submissionInputSchema.shape.url.safeParse(withWebScheme(value))
                .success ||
              "Please enter a link, like youtube.com/watch?v=…",
          })}
          className={cn(
            "z-10 rounded-lg border-2 bg-white/60 p-2 text-lg backdrop-blur",
            errors.demoUrl ? "border-red-500" : "border-gray-200",
          )}
        />
        {errors.demoUrl && (
          <span className="text-red-500">{errors.demoUrl.message}</span>
        )}
      </label>
      <Button
        pending={createMutation.isPending}
        isPitchNight={branding.isPitchNight}
      >
        {branding.isPitchNight ? "Submit Pitch" : "Submit Demo"}
      </Button>
    </form>
  );
}
