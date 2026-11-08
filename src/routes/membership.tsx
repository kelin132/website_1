import { createFileRoute } from "@tanstack/react-router";
import { Crown, ShieldCheck, Sparkles } from "@/lib/lucide-icons";
import { AppShell } from "@/components/aidoru/AppShell";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership — AIDORU" },
      { name: "description", content: "Compare AIDORU Basic and Premium membership benefits." },
    ],
  }),
  component: MembershipPage,
});

const plans = [
  {
    name: "Basic",
    price: "$1.99",
    icon: ShieldCheck,
    color: "#62e5d7",
    features: [
      "5% win-rate boost",
      "$50M deposit benefit",
      "$150M bank capacity",
      "20 Genesis Crystals",
      "40% cooldown reduction",
      "5 renames per day",
      "3 level-50 Pokémon",
    ],
  },
  {
    name: "Premium",
    price: "$5.99",
    icon: Crown,
    color: "#b993ff",
    features: [
      "$70M deposit benefit",
      "Unlimited bank capacity",
      "30 Genesis Crystals",
      "Maximum cooldown reduction",
      "10% win-rate boost",
      "Premium badge and animated frames",
      "Special role",
    ],
  },
];

function MembershipPage() {
  return (
    <AppShell title="Membership" subtitle="Compare trainer benefits and membership tiers.">
      <main className="mx-auto max-w-5xl space-y-6 pb-12">
        <section className="hof-panel p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="size-7 text-cyan-200" />
            <div>
              <p className="hof-kicker">Trainer benefits</p>
              <h1 className="hof-heading text-3xl">AIDORU Membership</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl font-bold leading-7 text-slate-300">
            Membership is managed by the AIDORU owner. Ask the owner to activate a tier with
            <code className="mx-1 rounded bg-slate-900 px-2 py-1">.activate @user basic</code>
            or
            <code className="mx-1 rounded bg-slate-900 px-2 py-1">.activate @user premium</code>
            in WhatsApp or Discord.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <article key={plan.name} className="hof-panel overflow-hidden p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="hof-kicker">Trainer plan</p>
                    <h2 className="hof-heading mt-1 text-3xl">{plan.name}</h2>
                  </div>
                  <Icon className="size-8" style={{ color: plan.color }} />
                </div>
                <p className="mt-4 font-display text-4xl font-extrabold" style={{ color: plan.color }}>
                  {plan.price}<span className="ml-2 text-base font-bold text-slate-400">/ month</span>
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 font-bold text-slate-200">
                      <span className="mt-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: plan.color }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="mt-7 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm font-bold text-slate-400">
                  Contact the owner to activate this membership. Payments are not processed on this page.
                </p>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
