import Link from "next/link";
import SentinelBrand from "@/components/sentinel-brand";

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <SentinelBrand iconSize={52} textClassName="text-xl font-bold tracking-[0.2em]" />
          <div className="mt-6 text-sm font-semibold text-blue-600">
            ORGANIZATIONAL COMPLIANCE WORKFORCE
          </div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">
            Continuously investigate your organization's compliance risk.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Sentinel analyzes contracts, policies and regulatory documents,
            correlates evidence, and produces structured findings for human review.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-slate-950 px-5 py-3 font-medium text-white" href="/auth/signin">
              Start an audit
            </Link>
            <Link className="rounded-lg border bg-white px-5 py-3 font-medium text-slate-700" href="/auth/signin">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
