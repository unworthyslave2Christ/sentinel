import Link from "next/link";
import SentinelBrand from "@/components/sentinel-brand";

export default function AuthRequired() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <SentinelBrand href="/" iconSize={44} textClassName="text-lg font-bold tracking-[0.18em]" />
        </div>
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h1 className="text-xl font-semibold text-slate-900">Not authenticated</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You must sign in before accessing the Sentinel compliance workspace.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/auth/signin" className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white">
            Sign in / Sign up
          </Link>
          <Link href="/" className="rounded-lg border px-4 py-3 text-sm font-medium text-slate-700">
            Return to landing page
          </Link>
        </div>
      </section>
    </main>
  );
}
