export function storedCurrentEventDate(currentEvent: object): Date | null {
  if (!("date" in currentEvent) || typeof currentEvent.date !== "string") {
    return null;
  }
  const parsed = new Date(currentEvent.date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
