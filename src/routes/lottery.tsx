import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Ticket } from "lucide-react";
import { AppShell } from "@/components/aidoru/AppShell";
import { requireUser } from "@/lib/auth.server";
import { getDb } from "@/lib/db.server";
import { resolveUserIdentityKeys } from "@/lib/userIdentity";

export const Route = createFileRoute("/lottery")({
  head: () => ({
    meta: [
      { title: "Lottery — AIDORU" },
      { name: "description", content: "Track the live AIDORU lottery, entrants, prize pool, and your odds." },
    ],
  }),
  component: LotteryPage,
});

const fetchLottery = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const db = await getDb();
  const [round, aliases] = await Promise.all([
    db.collection("lottery").findOne({ _id: "current" }),
    resolveUserIdentityKeys(db, user as unknown as Record<string, unknown>),
  ]);
  const tickets = Array.isArray(round?.tickets) ? round.tickets : [];
  const aliasSet = new Set(aliases.map(String));
  const mine = tickets.filter((ticket) =>
    aliasSet.has(String(ticket.userId ?? ""))
    || (Array.isArray(ticket.accountIds) && ticket.accountIds.some((id: unknown) => aliasSet.has(String(id)))),
  );
  return {
    jackpot: Number(round?.jackpot) || 0,
    totalTickets: Number(round?.totalTickets) || tickets.length,
    maxEntries: 16,
    ticketPrice: 15_000,
    myTickets: mine.reduce((sum, ticket) => sum + (Number(ticket.count) || 0), 0),
    participants: tickets.map((ticket, index) => ({
      name: String(ticket.name || `Trainer ${index + 1}`).slice(0, 32),
      count: Math.max(1, Number(ticket.count) || 1),
    })),
  };
});

function LotteryPage() {
  const load = useServerFn(fetchLottery);
  const query = useQuery({
    queryKey: ["aidoru", "lottery", "current"],
    queryFn: () => load(),
    refetchInterval: 15_000,
    retry: false,
  });

  return (
    <AppShell title="AIDORU Lottery" subtitle="Follow the current draw and check your chance to win.">
      <div className="mx-auto max-w-4xl space-y-5 pb-10">
        {query.isLoading ? (
          <section className="hof-panel flex items-center justify-center gap-3 p-10 font-bold">
            <LoaderCircle className="size-5 animate-spin" /> Loading the current draw…
          </section>
        ) : query.isError ? (
          <section className="hof-panel p-6 font-bold text-rose-200">
            {query.error instanceof Error ? query.error.message : "Lottery information is unavailable."}
          </section>
        ) : (
          <>
            <section className="hof-panel overflow-hidden p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <Ticket className="size-7 text-cyan-200" />
                <div>
                  <p className="hof-kicker">Current draw</p>
                  <h1 className="hof-heading text-3xl">Lottery tracker</h1>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Stat label="Prize pool" value={`$${query.data.jackpot.toLocaleString()}`} />
                <Stat label="Entrants" value={`${query.data.totalTickets} / ${query.data.maxEntries}`} />
                <Stat label="Your chance" value={`${query.data.totalTickets ? ((query.data.myTickets / query.data.totalTickets) * 100).toFixed(1) : "0.0"}%`} />
              </div>
              <p className="mt-4 text-sm font-bold text-slate-300">
                Ticket price: ${query.data.ticketPrice.toLocaleString()} · Your tickets: {query.data.myTickets}
              </p>
              <p className="mt-2 text-sm font-bold text-slate-400">
                Buy a ticket in WhatsApp or Discord with <code>.lottery</code>.
              </p>
            </section>
            <section className="hof-panel p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="hof-heading text-2xl">Participants</h2>
                <span className="text-sm font-bold text-cyan-100">{query.data.participants.length} entered</span>
              </div>
              {query.data.participants.length ? (
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {query.data.participants.map((participant, index) => (
                    <li key={`${participant.name}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 font-bold">
                      <span>{index + 1}. {participant.name}</span>
                      <span className="text-sm text-cyan-100">{participant.count} ticket</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center font-bold text-slate-400">
                  No tickets have been entered yet.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold text-cyan-100">{value}</p>
    </div>
  );
}
