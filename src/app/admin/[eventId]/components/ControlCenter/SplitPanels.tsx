import { type ReactNode } from "react";

import { cn } from "~/lib/utils";

export type MobilePanel = "left" | "right";

function PanelTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "h-10 rounded-md px-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function SplitPanels({
  left,
  right,
  leftLabel,
  rightLabel,
  mobilePanel,
  onMobilePanelChange,
}: {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
  mobilePanel: MobilePanel;
  onMobilePanelChange: (panel: MobilePanel) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="tablist"
        aria-label="Switch panels"
        className="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1 md:hidden"
      >
        <PanelTab
          selected={mobilePanel === "left"}
          onClick={() => onMobilePanelChange("left")}
        >
          {leftLabel}
        </PanelTab>
        <PanelTab
          selected={mobilePanel === "right"}
          onClick={() => onMobilePanelChange("right")}
        >
          {rightLabel}
        </PanelTab>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          role="tabpanel"
          aria-label={leftLabel}
          className={cn(
            "min-h-0 bg-background md:flex md:w-1/2 md:flex-1 md:flex-col md:overflow-hidden md:pr-2",
            mobilePanel === "left" ? "flex flex-1 flex-col" : "hidden",
          )}
        >
          {left}
        </div>
        <div className="hidden w-px shrink-0 bg-border md:block" />
        <div
          role="tabpanel"
          aria-label={rightLabel}
          className={cn(
            "min-h-0 bg-background md:flex md:w-1/2 md:flex-1 md:flex-col md:overflow-hidden md:pl-2",
            mobilePanel === "right" ? "flex flex-1 flex-col" : "hidden",
          )}
        >
          {right}
        </div>
      </div>
    </div>
  );
}
