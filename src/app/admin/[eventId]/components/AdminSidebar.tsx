"use client";

import { type AdminEvent } from "../contexts/DashboardContext";
import {
  CalendarIcon,
  ChevronDown,
  ChevronsUpDown,
  CirclePlay,
  CopyIcon,
  ExternalLink,
  LayoutDashboardIcon,
  MonitorPlayIcon,
  OctagonPause,
  PresentationIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";

import { formatEventDate } from "~/lib/singaporeDate";
import { EventPhase } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

import MascotLogo from "~/components/MascotLogo";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

import { LiveIndicator } from "./LiveIndicator";

export enum AdminTab {
  Demos = "demos",
  Awards = "awards",
  DemosAndFeedback = "demos-and-feedback",
  AwardsAndVoting = "awards-and-voting",
  Attendees = "attendees",
}

interface AdminSidebarProps {
  event: AdminEvent;
  selectedTab: AdminTab;
  setSelectedTab: (tab: AdminTab) => void;
}

export function AdminSidebar({
  event,
  selectedTab,
  setSelectedTab,
}: AdminSidebarProps) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: events } = api.event.allAdmin.useQuery();
  const { data: currentEvent, refetch: refetchEvent } =
    api.event.getLiveEvent.useQuery(event.id);
  const isLive = currentEvent?.id === event.id;
  const currentPhase = isLive ? currentEvent.phase : null;
  const joinCode = currentEvent?.joinCode ?? event.joinCode;
  const setLiveMutation = api.event.setLive.useMutation();

  const selectTab = useCallback(
    (tab: AdminTab) => {
      setSelectedTab(tab);
      if (isMobile) setOpenMobile(false);
    },
    [isMobile, setOpenMobile, setSelectedTab],
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-14">
                  <div className="flex items-center gap-2">
                    <MascotLogo seed={event.id} size={40} className="-ml-1" />
                    <div className="flex flex-col items-start">
                      <div className="flex items-center">
                        <div className="line-clamp-1 text-base font-bold leading-6">
                          {event.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <time>{formatEventDate(event.date)}</time>
                      </div>
                    </div>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ChevronDown className="rotate-90" />
                    <span>Back to Admin Dashboard</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {events?.map((e) => (
                    <DropdownMenuItem
                      key={e.id}
                      onClick={() => router.push(`/admin/${e.id}`)}
                    >
                      <div className="flex flex-col items-start">
                        <div className="line-clamp-1 font-bold leading-6">
                          {e.name}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <time>{formatEventDate(e.date)}</time>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <div className="flex flex-col gap-2 px-4 py-2">
        {event.url && (
          <Button
            onClick={() => window.open(event.url, "_blank")}
            variant="outline"
            className="w-full"
          >
            <ExternalLink className="size-4" />
            View event
          </Button>
        )}
        <Button
          onClick={async () => {
            await setLiveMutation.mutateAsync({
              eventId: event.id,
              live: !isLive,
            });
            void refetchEvent();
          }}
          disabled={setLiveMutation.isPending}
          variant={isLive ? "destructive" : "default"}
          className="w-full"
        >
          {isLive ? (
            <OctagonPause className="size-4" />
          ) : (
            <CirclePlay className="size-4" />
          )}
          {isLive ? "Stop live event" : "Start live event"}
        </Button>
        {isLive && joinCode && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  Join code
                </span>
                <span className="font-mono text-2xl font-bold tracking-widest">
                  {joinCode}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy join link"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`${window.location.origin}/${joinCode}`)
                    .then(() => toast.success("Join link copied"));
                }}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                window.open(`/admin/${event.id}/present`, "_blank")
              }
            >
              <MonitorPlayIcon className="size-4" />
              Open presenter view
            </Button>
          </div>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => selectTab(AdminTab.Demos)}
                  className={selectedTab === AdminTab.Demos ? "bg-accent" : ""}
                >
                  <div className="flex items-center gap-2">
                    <PresentationIcon className="h-4 w-4" />
                    <span>Demos</span>
                  </div>
                </SidebarMenuButton>
                <SidebarMenuBadge>{event.demos.length}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => selectTab(AdminTab.Awards)}
                  className={selectedTab === AdminTab.Awards ? "bg-accent" : ""}
                >
                  <div className="flex items-center gap-2">
                    <TrophyIcon className="h-4 w-4" />
                    <span>Awards</span>
                  </div>
                </SidebarMenuButton>
                <SidebarMenuBadge>{event.awards.length}</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => selectTab(AdminTab.DemosAndFeedback)}
                  className={
                    selectedTab === AdminTab.DemosAndFeedback ||
                    selectedTab === AdminTab.AwardsAndVoting
                      ? "bg-accent"
                      : ""
                  }
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboardIcon className="h-4 w-4" />
                    <span>Control Centre</span>
                    {currentPhase === EventPhase.Demos ||
                    currentPhase === EventPhase.Voting ||
                    currentPhase === EventPhase.Results ? (
                      <LiveIndicator />
                    ) : null}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => selectTab(AdminTab.Attendees)}
                  className={
                    selectedTab === AdminTab.Attendees ? "bg-accent" : ""
                  }
                >
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    <span>Attendees</span>
                  </div>
                </SidebarMenuButton>
                <SidebarMenuBadge>{event._count.attendees}</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
