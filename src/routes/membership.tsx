import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/aidoru/AppShell";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership — AIDORU" },
      { name: "description", content: "AIDORU membership plans: Basic and Premium." },
    ],
  }),
  component: MembershipPage,
});

const plans = [
  {
    name: "Basic",
    price: "$1.99",
    color: "#62e5d7",
    features: [
      "5% win-rate boost",
      "$50M deposit benefit",
      "$150M bank capacity",
      "20 Genesis Crystals",
      "40% cooldown reduction",
      "5 renames per day",
      "3 level-50 Pokémon",
      "Custom profile fonts and colors",
    ],
  },
  {
    name: "Premium",
    price: "$5.99",
    color: "#b993ff",
    features: [
      "$70M deposit benefit",
      "Unlimited bank capacity",
      "30 Genesis Crystals",
      "Maximum cooldown reduction",
      "10% win-rate boost",
      "Premium badge and animated frames",
      "Special role",
      "Custom profile fonts and colors",
    ],
  },
];

const whatsappContacts = [
  { number: "+263780894295", href: "https://wa.me/263780894295" },
  { number: "+27628114340", href: "https://wa.me/27628114340" },
];

function MembershipPage() {
  return (
    <AppShell title="AIDORU Membership" hidePageHeading>
      <main className="mx-auto max-w-5xl space-y-6 pb-12">
        <section className="hof-panel p-6 sm:p-8">
          <h1 className="hof-heading text-3xl">AIDORU Membership</h1>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            return (
              <article key={plan.name} className="hof-panel overflow-hidden p-6 sm:p-7">
                <h2 className="hof-heading text-3xl">{plan.name}</h2>
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
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {whatsappContacts.map((contact) => (
                    <a
                      key={contact.number}
                      href={contact.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-3 text-center text-sm font-extrabold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    >
                      WhatsApp {contact.number}
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
