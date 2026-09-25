import Link from "next/link";
import { getCurrentSession } from "@/server/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await getCurrentSession();

  if (!s?.user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 hidden w-60 border-r bg-white p-5 md:block">
        <Link className="text-xl font-bold" href="/dashboard">SENTINEL</Link>
        <nav className="mt-10 space-y-1 text-sm">
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard">Overview</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/documents">Documents</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/audits">Audits</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/findings">Findings</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/policies">Policies & controls</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/workforce">Workforce</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/tasks">Remediation</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/graph">Evidence graph</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/monitoring">Monitoring</Link>
          <Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/review">Human review</Link>
<Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/analytics">Analytics</Link>
<Link className="block rounded p-2 hover:bg-slate-100" href="/dashboard/governance">Governance</Link>
        </nav>
        <div className="absolute bottom-5 text-xs text-slate-500">
          {s.user.email}
          <br />
          <SignOutButton />
        </div>
      </aside>
      <main className="md:pl-60">{children}</main>
    </div>
  );
}
