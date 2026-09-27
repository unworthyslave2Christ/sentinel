export type MonitorFrequency =
  | "EVERY_3_MINUTES"
  | "EVERY_5_MINUTES"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY";

export function nextRunAt(frequency: MonitorFrequency, from = new Date()) {
  const d = new Date(from);
  if (frequency === "EVERY_3_MINUTES") d.setUTCMinutes(d.getUTCMinutes() + 3);
  else if (frequency === "EVERY_5_MINUTES") d.setUTCMinutes(d.getUTCMinutes() + 5);
  else if (frequency === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function frequencyLabel(frequency: MonitorFrequency) {
  switch (frequency) {
    case "EVERY_3_MINUTES": return "Every 3 minutes";
    case "EVERY_5_MINUTES": return "Every 5 minutes";
    case "DAILY": return "Daily";
    case "WEEKLY": return "Weekly";
    case "MONTHLY": return "Monthly";
  }
}
