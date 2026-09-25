import { signIn } from "@/server/auth";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold text-blue-600">SENTINEL</div>
        <h1 className="mt-2 text-2xl font-semibold">Sign in to your compliance workspace</h1>
        <p className="mt-2 text-sm text-slate-500">Continue with Google to access your organizational compliance workforce.</p>
        <form action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }} className="mt-6">
          <button className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white">Continue with Google</button>
        </form>
      </div>
    </main>
  );
}
