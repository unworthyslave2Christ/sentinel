import { auth } from "@/server/auth";

export async function getCurrentSession() {
  return auth();
}
