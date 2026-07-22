"use client";

export function LiveIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1">
      <div className="relative flex size-2">
        <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <div className="relative inline-flex size-2 rounded-full bg-primary" />
      </div>
      <span className="text-xs font-medium text-primary">LIVE</span>
    </div>
  );
}
