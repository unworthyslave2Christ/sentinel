import { signOut } from "@/server/auth";

export function SignOutButton() {
  return (
    <form action={async () => {
      "use server";
      await signOut({ redirectTo: "/" });
    }}>
      <button className="mt-2 text-xs text-slate-500 hover:text-slate-900">Sign out</button>
    </form>
  );
}
