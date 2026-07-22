import { AttendeeType } from "~/lib/types/attendeeTypes";

export function colorForAttendeeType(type: string): string {
  switch (type) {
    case AttendeeType.Founder:
      return "bg-blue-200 text-blue-800";
    case AttendeeType.Investor:
      return "bg-primary/20 text-primary-dark";
    case AttendeeType.Engineer:
      return "bg-purple-200 text-purple-800";
    case AttendeeType.ProductManager:
      return "bg-yellow-200 text-yellow-800";
    case AttendeeType.Designer:
      return "bg-pink-200 text-pink-800";
    case AttendeeType.Other:
    default:
      return "bg-gray-200 text-gray-800";
  }
}

export default function AttendeeTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const color = colorForAttendeeType(type);
  return (
    <span
      className={`whitespace-nowrap rounded-lg px-2 text-xs font-semibold ${color}`}
    >
      {type}
    </span>
  );
}
