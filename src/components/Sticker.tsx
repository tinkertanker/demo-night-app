import Image from "next/image";

import { cn } from "~/lib/utils";

/**
 * A Krobot sticker from tinkertanker/tkrobot-stickers. The `logo` class
 * makes LogoConfetti pick the sticker up as a floating confetti shape.
 */
export default function Sticker({
  name,
  size = 160,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/images/stickers/${name}.png`}
      alt={name}
      width={size}
      height={size}
      className={cn("logo select-none", className)}
      priority
    />
  );
}
