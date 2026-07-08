"use client";

import { cn } from "../lib/utils";
import Image from "next/image";
import React from "react";
import { type ReactNode } from "react";

export default function Logos({
  size = "sm",
  className,
  logoPath,
}: {
  size: "sm" | "lg";
  className?: string;
  logoPath: string;
}): ReactNode {
  const logoSize = size === "sm" ? 32 : 110;
  return (
    <div
      className={cn(
        `flex flex-row items-center justify-center`,
        size === "sm" ? "gap-1" : "gap-4",
        className,
      )}
    >
      <Image
        src={logoPath}
        id="logo"
        alt="logo"
        width={logoSize}
        height={logoSize}
        className="logo"
      />
    </div>
  );
}
