"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { JOIN_CODE_LENGTH, normalizeJoinCode } from "~/lib/joinCode";
import { api } from "~/trpc/react";

import Button from "~/components/Button";

const LAST_JOIN_CODE_KEY = "lastJoinCode";

export function rememberJoinCode(joinCode: string) {
  try {
    localStorage.setItem(LAST_JOIN_CODE_KEY, joinCode);
  } catch {}
}

export default function JoinEventForm({
  invalidCode,
}: {
  invalidCode?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_JOIN_CODE_KEY);
      if (stored && stored !== invalidCode) setLastCode(stored);
    } catch {}
  }, [invalidCode]);

  const { data: lastEvent } = api.event.getLiveByCode.useQuery(lastCode ?? "", {
    enabled: !!lastCode,
  });

  const joinCode = normalizeJoinCode(code);

  return (
    <div className="z-10 flex w-full max-w-xs flex-col items-center gap-4">
      <form
        className="flex w-full flex-col items-center gap-4 font-medium"
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode.length !== JOIN_CODE_LENGTH) return;
          if (joinCode === invalidCode) return;
          setPending(true);
          router.push(`/${joinCode}`);
        }}
      >
        <label className="flex w-full flex-col gap-1">
          <span className="text-center text-lg font-semibold">
            Enter your event code
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())
            }
            maxLength={JOIN_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABCD"
            aria-label="Event code"
            className="z-30 rounded-lg border-2 border-gray-200 bg-white/60 p-2 text-center font-mono text-3xl font-bold uppercase tracking-[0.4em] backdrop-blur placeholder:text-gray-300"
          />
        </label>
        {invalidCode && (
          <p className="text-center text-sm font-semibold text-red-600">
            No live event with code {invalidCode}. Check the code on screen and
            try again.
          </p>
        )}
        <Button pending={pending}>Join</Button>
      </form>
      {lastEvent && lastCode && (
        <Link
          href={`/${lastCode}`}
          className="text-sm font-semibold text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-gray-900 hover:decoration-gray-600"
        >
          Rejoin {lastEvent.name}
        </Link>
      )}
    </div>
  );
}
