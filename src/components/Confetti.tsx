"use client";

import { useEffect, useRef, useState } from "react";
import Confetti from "react-confetti";
import type Particle from "react-confetti/dist/types/Particle";

import useWindowSize from "~/lib/hooks/useWindowSize";

export function ReactionConfetti({
  demoId,
  count,
  emoji,
}: {
  demoId: string;
  count: number;
  emoji: string;
}) {
  const { windowSize } = useWindowSize();
  const [_active, _setActive] = useState(false);
  const [previousFeedbackDemoId, setPreviousFeedbackDemoId] =
    useState<string>("");
  const [previousCount, setPreviousCount] = useState(0);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (demoId !== previousFeedbackDemoId) {
      setPreviousFeedbackDemoId(demoId);
      setPreviousCount(count);
      _setActive(false);
      return;
    }
    if (count > previousCount) {
      _setActive(true);
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      timeoutId.current = setTimeout(
        () => {
          _setActive(false);
        },
        100 * (count - previousCount),
      );
    }
    setPreviousCount(count);
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, [demoId, count]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawShape = (ctx: CanvasRenderingContext2D) => {
    ctx.font = "40px sans-serif";
    ctx.fillText(emoji, 0, 0);
  };

  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      drawShape={drawShape}
      tweenDuration={10000}
      gravity={0.05}
      numberOfPieces={_active ? 50 : 0}
    />
  );
}

export function ResultsConfetti({
  currentAwardIndex,
}: {
  currentAwardIndex: number | null;
}) {
  const { windowSize } = useWindowSize();
  const [_active, _setActive] = useState(false);
  const [previousAwardIndex, setPreviousAwardIndex] = useState<number | null>(
    currentAwardIndex,
  );
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (
      currentAwardIndex !== null &&
      (previousAwardIndex == null || currentAwardIndex > previousAwardIndex)
    ) {
      _setActive(true);
      timeoutId.current = setTimeout(() => {
        _setActive(false);
      }, 3000);
    } else {
      _setActive(false);
    }
    setPreviousAwardIndex(currentAwardIndex);
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, [currentAwardIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      tweenDuration={3000}
      gravity={0.05}
      colors={["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"]}
      numberOfPieces={_active ? 500 : 0}
    />
  );
}

export function LogoConfetti({ run = true }: { run?: boolean }) {
  const { windowSize } = useWindowSize();
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    const logoElements = Array.from(
      document.getElementsByClassName("logo"),
    ).filter((el): el is HTMLImageElement => el instanceof HTMLImageElement);

    // Create new Image objects and wait for them to load
    const loadImages = logoElements.map((logoEl) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = logoEl.src;
      });
    });

    void Promise.all(loadImages).then(setImages);
  }, []); // Only run once on mount

  const drawShape = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    if (!images || images.length === 0) return;
    const img = images[particle.shape % images.length];
    if (!img || !(img instanceof HTMLImageElement)) return;
    try {
      const size = 36;
      const aspectRatio = img.width / img.height;
      let drawWidth = size;
      let drawHeight = size;

      if (aspectRatio > 1) {
        // Image is wider than tall, fit to width
        drawHeight = size / aspectRatio;
      } else {
        // Image is taller than wide, fit to height
        drawWidth = size * aspectRatio;
      }

      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
    } catch (error) {
      console.error("Error drawing image:", error);
    }
  };

  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      drawShape={drawShape}
      basicFloat={true}
      numberOfShapes={images.length}
      initialVelocityY={{ min: -10, max: 0 }}
      tweenDuration={30_000}
      gravity={0.01}
      numberOfPieces={20}
      run={run}
    />
  );
}
