import { useDashboardContext } from "../../contexts/DashboardContext";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { liveQueryOptions } from "~/lib/liveQuery";
import { cn } from "~/lib/utils";
import { type RouterOutputs, api } from "~/trpc/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type Voter = RouterOutputs["attendee"]["getVoters"][number];

export default function VotersPanel() {
  const { event, currentEvent, config, refetchEvent } = useDashboardContext();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const statusTrigger = useRef<HTMLButtonElement | null>(null);
  const {
    data: voters,
    isLoading,
    isError,
    refetch,
  } = api.attendee.getVoters.useQuery(event?.id ?? "", {
    enabled: !!event,
    ...liveQueryOptions(event?.id === currentEvent?.id),
  });
  const mutation = api.attendee.setVoterExcluded.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendee.getVoters.invalidate(event?.id),
        utils.attendee.getAnalytics.invalidate(event?.id),
        utils.award.getVotes.invalidate(),
        utils.vote.getTotalInvestments.invalidate(),
        utils.demo.getStats.invalidate(),
      ]);
      refetchEvent();
      setSelectedVoter(null);
    },
    onError: (error) => toast.error(error.message),
  });
  if (!event) return null;

  const visibleVoters = voters?.filter((voter) =>
    `${voter.name ?? ""} ${voter.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const investing =
    voters?.filter(
      (voter) =>
        !voter.excluded &&
        (config.isPitchNight ? voter.totalInvested > 0 : voter.voteCount > 0),
    ).length ?? 0;
  const excluded = voters?.filter((voter) => voter.excluded).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold md:text-2xl">Voters</h2>
        <p className="text-sm text-muted-foreground">
          {investing} {config.isPitchNight ? "investing" : "voted"} · {excluded}{" "}
          excluded
        </p>
        <p className="text-sm text-muted-foreground">
          Matching names are flagged for review, not automatically excluded.
        </p>
      </div>
      <Input
        aria-label="Search voters"
        placeholder="Search voters…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="px-2">Name</TableHead>
              <TableHead className="px-2 text-right">
                {config.isPitchNight ? "Invested" : "Votes"}
              </TableHead>
              <TableHead className="px-2 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading voters…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  <p role="alert">Could not load voters.</p>
                  <Button variant="ghost" onClick={() => void refetch()}>
                    Try again
                  </Button>
                </TableCell>
              </TableRow>
            ) : !visibleVoters?.length ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search ? "No matching voters." : "No voters yet."}
                </TableCell>
              </TableRow>
            ) : (
              visibleVoters.map((voter) => {
                const hasVotes = config.isPitchNight
                  ? voter.totalInvested > 0
                  : voter.voteCount > 0;
                const status = voter.excluded
                  ? "Excluded"
                  : hasVotes
                    ? "Counted"
                    : config.isPitchNight
                      ? "Not invested"
                      : "Not voted";
                return (
                  <TableRow key={voter.id} data-voter-id={voter.id}>
                    <TableCell className="w-full max-w-0 px-2 py-3">
                      <p className="break-words font-medium">
                        {voter.name ?? "Name not provided"}
                      </p>
                      {voter.duplicateName && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Possible duplicate
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        …{voter.id.slice(-6)}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 text-right tabular-nums">
                      {config.isPitchNight
                        ? `$${voter.totalInvested.toLocaleString("en-SG")}`
                        : voter.voteCount}
                    </TableCell>
                    <TableCell className="px-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              "gap-1 px-2 text-xs",
                              voter.excluded &&
                                "border-destructive/30 text-destructive hover:text-destructive",
                            )}
                            disabled={mutation.isPending}
                            aria-label={`${status}: change voting status for ${voter.name ?? "unnamed voter"}`}
                            onPointerDownCapture={(e) => {
                              statusTrigger.current = e.currentTarget;
                            }}
                            onKeyDownCapture={(e) => {
                              statusTrigger.current = e.currentTarget;
                            }}
                          >
                            {status}
                            <ChevronDown aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={mutation.isPending}
                            className={cn(
                              !voter.excluded &&
                                "text-destructive focus:text-destructive",
                            )}
                            onSelect={() =>
                              voter.excluded
                                ? mutation.mutate({
                                    eventId: event.id,
                                    attendeeId: voter.id,
                                    excluded: false,
                                  })
                                : setSelectedVoter(voter)
                            }
                          >
                            {voter.excluded
                              ? "Restore"
                              : "Exclude from this event"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog
        open={!!selectedVoter}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSelectedVoter(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // The menu item that opened this confirmation has unmounted.
            e.preventDefault();
            statusTrigger.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Exclude {selectedVoter?.name ?? "this voter"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their votes will no longer count for this event, and they will not
              be able to invest or vote. Totals and automatic winners will
              update. Their allocations are kept so you can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (selectedVoter)
                  mutation.mutate({
                    eventId: event.id,
                    attendeeId: selectedVoter.id,
                    excluded: true,
                  });
              }}
            >
              Exclude from this event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
