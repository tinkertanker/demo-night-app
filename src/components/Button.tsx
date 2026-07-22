"use client";

import Link from "next/link";

import { cn } from "~/lib/utils";

import LoadingDots from "./loading/LoadingDots";

export default function Button({
  children,
  onClick,
  pending = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  pending?: boolean;
  className?: string;
  /** Kept for call-site compatibility; colour is always Tinkercademy primary. */
  isPitchNight?: boolean;
}) {
  return (
    <button
      type="submit"
      className={cn(
        `z-30 flex h-12 w-full items-center justify-center gap-2 space-x-2 rounded-lg px-4 py-2 text-lg font-semibold text-white shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]`,
        pending
          ? "cursor-not-allowed"
          : "bg-primary hover:bg-primary-dark",
        className,
      )}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? <LoadingDots color="#fff" /> : children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        `z-10 mt-4 rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-sm transition-all hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]`,
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
