import { SubmissionStatus } from "@prisma/client";

import { statusTitle } from "~/lib/types/submissionStatus";

export function statusColor(status: SubmissionStatus): string {
  switch (status) {
    case SubmissionStatus.PENDING:
      return "bg-gray-200 text-gray-800";
    case SubmissionStatus.WAITLISTED:
      return "bg-blue-200 text-blue-800";
    case SubmissionStatus.AWAITING_CONFIRMATION:
      return "bg-yellow-200 text-yellow-800";
    case SubmissionStatus.CONFIRMED:
      return "bg-primary/20 text-primary-dark";
    case SubmissionStatus.CANCELLED:
    case SubmissionStatus.REJECTED:
      return "bg-gray-300 text-gray-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

export default function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus;
}) {
  if (!status) return null;
  const color = statusColor(status);
  return (
    <span
      className={`whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ${color}`}
    >
      {statusTitle(status)}
    </span>
  );
}
