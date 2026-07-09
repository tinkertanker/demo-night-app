"use client";

import { useEffect, useState } from "react";

import Sticker from "./Sticker";

// Friendly "hello" Krobot poses that read well at logo size. Rotating between a
// few keeps the top-left mascot feeling alive without picking a single winner.
const MASCOTS = ["ok", "fingerguns", "thumbsup"] as const;

function seededIndex(seed: string, mod: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % mod;
}

/**
 * The top-left header mascot. When a `seed` is provided (e.g. the event id) the
 * pose is deterministic across SSR and stable for that event; without one we
 * pick after mount to avoid a hydration mismatch. Renders a {@link Sticker}, so
 * it also feeds LogoConfetti via the `.logo` class.
 */
export default function MascotLogo({
  seed,
  size = 40,
  className,
}: {
  seed?: string | null;
  size?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(() =>
    seed ? seededIndex(seed, MASCOTS.length) : 0,
  );

  useEffect(() => {
    if (!seed) setIndex(Math.floor(Math.random() * MASCOTS.length));
  }, [seed]);

  return <Sticker name={MASCOTS[index]!} size={size} className={className} />;
}
