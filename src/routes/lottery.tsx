import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Trophy, WalletCards } from "@/lib/lucide-icons";
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
  const now = new Date();
  const { start: dayStart, end: dayEnd } = getHarareDayRange(now);
  const [round, aliases, dailyDraws] = await Promise.all([
    db.collection("lottery").findOne({ _id: "current" }),
    resolveUserIdentityKeys(db, user as unknown as Record<string, unknown>),
    db.collection("lottery_announcements")
      .find(
        { type: "lottery_draw", createdAt: { $gte: dayStart, $lt: dayEnd } },
        { projection: { createdAt: 1, "payload.winners": 1, "payload.totalTickets": 1, "payload.prize": 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
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
    dailyDrawDate: new Intl.DateTimeFormat("en", {
      timeZone: "Africa/Harare",
      dateStyle: "full",
    }).format(now),
    dailyWinners: dailyDraws.map((draw) => ({
      id: String(draw._id),
      drawnAt: new Date(draw.createdAt).toISOString(),
      totalTickets: Number(draw.payload?.totalTickets) || 0,
      prize: Number(draw.payload?.prize) || 0,
      winners: (Array.isArray(draw.payload?.winners) ? draw.payload.winners : [])
        .map((winner) => ({
          name: String(winner.name || "Trainer").slice(0, 48),
          amount: Number(winner.amount) || 0,
        }))
        .filter((winner) => winner.amount > 0),
    })),
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
            <section className="hof-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Trophy className="size-6 text-amber-200" />
                  <div>
                    <p className="hof-kicker">Daily results · {query.data.dailyDrawDate}</p>
                    <h2 className="hof-heading text-2xl">Today’s winners</h2>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-bold text-slate-300">
                  Resets at midnight · Harare
                </span>
              </div>
              {query.data.dailyWinners.length ? (
                <div className="mt-5 space-y-4">
                  {query.data.dailyWinners.map((draw) => (
                    <article key={draw.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-300">
                        <span>
                          Drawn {new Intl.DateTimeFormat("en", {
                            timeZone: "Africa/Harare",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(draw.drawnAt))}
                        </span>
                        <span>{draw.totalTickets} tickets · ${draw.prize.toLocaleString()} paid</span>
                      </div>
                      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                        {draw.winners.map((winner, index) => (
                          <li key={`${draw.id}-${index}`} className="rounded-xl border border-amber-200/10 bg-amber-200/[0.04] px-3 py-3">
                            <span className="block text-xs font-black uppercase tracking-wider text-amber-100/70">
                              {["1st place", "2nd place", "3rd place"][index] || `Winner ${index + 1}`}
                            </span>
                            <strong className="mt-1 block truncate text-white">{winner.name}</strong>
                            <span className="mt-1 block font-display text-lg font-extrabold text-amber-100">
                              ${winner.amount.toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-xl border border-dashed border-white/15 p-5 text-center font-bold text-slate-400">
                  No winners have been announced today. New draw results will appear here.
                </p>
              )}
            </section>
            <section className="hof-panel overflow-hidden p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <WalletCards className="size-7 text-cyan-200" />
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

function getHarareDayRange(now: Date) {
  const zone = "Africa/Harare";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const readParts = (date: Date) =>
    Object.fromEntries(
      formatter.formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
  const localMidnightUtc = (year: number, month: number, day: number) => {
    const target = Date.UTC(year, month - 1, day);
    let guess = target;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const local = readParts(new Date(guess));
      const localAsUtc = Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
        local.second,
      );
      guess += target - localAsUtc;
    }
    return new Date(guess);
  };
  const { year, month, day } = readParts(now);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: localMidnightUtc(year, month, day),
    end: localMidnightUtc(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
    ),
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold text-cyan-100">{value}</p>
    </div>
  );
}
