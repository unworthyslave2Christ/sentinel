import { Timestamp } from "firebase-admin/firestore";

export function serializeFirestore<T>(value: T): T {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString() as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestore) as T;
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        serializeFirestore(child),
      ]),
    ) as T;
  }

  return value;
}