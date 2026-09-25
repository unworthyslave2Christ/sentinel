export type MonitorFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export function nextRunAt(frequency: MonitorFrequency, from = new Date()) {
  const d = new Date(from);
  if (frequency === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function frequencyLabel(frequency: MonitorFrequency) {
  return frequency === "DAILY" ? "Daily" : frequency === "WEEKLY" ? "Weekly" : "Monthly";
}
