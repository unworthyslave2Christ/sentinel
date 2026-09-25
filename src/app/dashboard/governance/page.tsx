"use client";

import { useEffect, useState } from "react";

type Member = { id: string; email?: string; role: string; status?: string };
type Log = { id: string; actorEmail?: string; action: string; createdAt?: unknown };

const roles = [
  "OWNER",
  "ADMIN",
  "COMPLIANCE_MANAGER",
  "ANALYST",
  "REVIEWER",
  "VIEWER",
];

export default function GovernancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");

  async function load() {
    const [membersResponse, logsResponse] = await Promise.all([
      fetch("/api/organization/members"),
      fetch("/api/governance/logs"),
    ]);

    if (membersResponse.ok) setMembers(await membersResponse.json());
    if (logsResponse.ok) setLogs(await logsResponse.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addMember() {
    const response = await fetch("/api/organization/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (response.ok) {
      setEmail("");
      await load();
    }
  }

  async function changeRole(memberId: string, nextRole: string) {
    await fetch("/api/organization/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: nextRole }),
    });
    await load();
  }

  async function removeMember(memberId: string) {
    await fetch("/api/organization/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    await load();
  }

  return (
    <main className="space-y-8 p-8">
      <div>
        <p className="text-sm font-semibold text-blue-600">SENTINEL · GOVERNANCE</p>
        <h1 className="mt-1 text-3xl font-semibold">Organization governance</h1>
        <p className="mt-2 text-sm text-slate-500">
          Membership, role boundaries, and security activity.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Add member</h2>
        <div className="flex flex-wrap gap-3">
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={addMember}
            disabled={!email}
          >
            Add member
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Members</h2>
        <div className="mt-4 divide-y">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-medium">{member.email ?? "Pending member"}</div>
                <div className="text-xs text-slate-500">{member.status ?? "ACTIVE"}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={member.role}
                  onChange={(e) => changeRole(member.id, e.target.value)}
                  disabled={member.role === "OWNER"}
                >
                  {roles.map((item) => <option key={item}>{item}</option>)}
                </select>
                {member.role !== "OWNER" && (
                  <button
                    className="rounded border px-2 py-1 text-sm"
                    onClick={() => removeMember(member.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Security activity</h2>
        <div className="mt-4 divide-y">
          {logs.map((log) => (
            <div key={log.id} className="py-3 text-sm">
              <strong>{log.action}</strong>
              <span className="ml-2 text-slate-500">{log.actorEmail ?? "system"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
