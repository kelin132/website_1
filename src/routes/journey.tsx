import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { ArrowDownToLine, ArrowUpFromLine, Crown, Gift, Grip, Search, Sparkles, Swords } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/aidoru/AppShell";
import { UserAvatar } from "@/components/aidoru/UserAvatar";
import { useSession, useSessionWriter } from "@/components/aidoru/session";
import { claimDailyReward, movePartyPokemon, reorderParty, setLead } from "@/lib/aidoru.functions";
import { DAILY_BASE_REWARD, formatCoins, rankFromLevel, trainerLevelProgress, type OwnedPokemon } from "@/lib/game";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "Journey — AIDORU Pokémon party" },
      {
        name: "description",
        content: "Manage the live Pokémon party and PC from your AIDORU trainer account.",
      },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  return (
    <AppShell
      title="Pokémon Journey"
      subtitle="The same Pokémon party that battles for you in WhatsApp."
    >
      <JourneyBody />
    </AppShell>
  );
}

function JourneyBody() {
  const { data: user } = useSession();
  const writeSession = useSessionWriter();
  const [firstSlot, setFirstSlot] = useState<number | null>(null);
  const [secondSlot, setSecondSlot] = useState<number | null>(null);
  const [selectedPokemonId, setSelectedPokemonId] = useState<string | null>(null);
  const [collectionSearch, setCollectionSearch] = useState("");
  const claim = useServerFn(claimDailyReward);
  const lead = useServerFn(setLead);
  const reorder = useServerFn(reorderParty);
  const move = useServerFn(movePartyPokemon);

  const claimMutation = useMutation({
    mutationFn: () => claim(),
    onSuccess: (result) => {
      writeSession(result.user);
      void confetti({ particleCount: 90, spread: 70, colors: ["#18e0e7", "#f8c84e"] });
      toast.success(`+${formatCoins(result.reward)} coins · day ${result.streak}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const leadMutation = useMutation({
    mutationFn: (pokemonId: string) => lead({ data: { pokemonId } }),
    onSuccess: (next) => {
      writeSession(next);
      toast.success("Lead Pokémon updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reorderMutation = useMutation({
    mutationFn: () => reorder({ data: { first: firstSlot!, second: secondSlot! } }),
    onSuccess: (next) => {
      writeSession(next);
      setFirstSlot(null);
      setSecondSlot(null);
      toast.success("Party order updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const moveMutation = useMutation({
    mutationFn: (data: { pokemonId: string; destination: "party" | "pc" }) => move({ data }),
    onSuccess: (next) => {
      writeSession(next);
      toast.success("Trainer party updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const party = user?.partyPokemon ?? [];
  const pc = user?.pcPokemon ?? [];
  const collection = [...party, ...pc];
  const search = collectionSearch.trim().toLowerCase();
  const filteredParty = useMemo(
    () =>
      party.filter((pokemon) =>
        `${pokemon.nickname ?? ""} ${pokemon.displayName} ${pokemon.name}`.toLowerCase().includes(search),
      ),
    [party, search],
  );
  const filteredPc = useMemo(
    () =>
      pc.filter((pokemon) =>
        `${pokemon.nickname ?? ""} ${pokemon.displayName} ${pokemon.name}`.toLowerCase().includes(search),
      ),
    [pc, search],
  );
  const selectedPokemon =
    collection.find((pokemon) => pokemon.id === selectedPokemonId) ??
    party.find((pokemon) => pokemon.id === user?.leadPokemonId) ??
    party[0] ??
    pc[0] ??
    null;
  const selectedInParty = Boolean(selectedPokemon && party.some((pokemon) => pokemon.id === selectedPokemon.id));
  const levelProgress = trainerLevelProgress(user?.trainerLevel ?? 1, user?.trainerXp ?? 0);
  const selectedCount = [firstSlot, secondSlot].filter(Boolean).length;

  if (!user) return null;

  return (
    <div
      className="journey-page space-y-5 pb-10"
      style={{ "--journey-accent": journeyTypeAccent(selectedPokemon?.primaryType) } as CSSProperties}
    >
      <section className="journey-trainer-hero hof-panel">
        <div className="journey-trainer-copy">
          <p className="hof-kicker">Trainer level {user.trainerLevel}</p>
          <h2 className="hof-heading mt-1 text-3xl">{user.name}'s journey</h2>
          <p className="journey-rank">{rankFromLevel(user.trainerLevel)}</p>
          <div className="journey-trainer-progress" role="img" aria-label={`Trainer XP ${levelProgress.current} of ${levelProgress.needed}`}>
            <span style={{ width: `${levelProgress.percent}%` }} />
          </div>
          <p className="journey-trainer-xp">
            {levelProgress.current.toLocaleString()} / {levelProgress.needed.toLocaleString()} XP
            <span>{party.length}/6 party slots</span>
          </p>
        </div>
        <UserAvatar
          name={user.name}
          src={user.avatarUrl}
          videoSrc={user.avatarVideoUrl}
          className="journey-trainer-avatar size-16 border-2 border-white/60 sm:size-20"
        />
        <button
          type="button"
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
          className="journey-daily-button hof-button inline-flex items-center gap-2"
        >
          <Gift className="size-4" />
          {claimMutation.isPending ? "Claiming…" : `Daily +${DAILY_BASE_REWARD}`}
        </button>
      </section>

      <section
        className="journey-spotlight hof-panel"
        style={{ "--journey-accent": journeyTypeAccent(selectedPokemon?.primaryType) } as CSSProperties}
      >
        {selectedPokemon ? (
          <>
            <div className="journey-spotlight-art">
              <span className="journey-pokedex-number">No. {String(selectedPokemon.pokedexId).padStart(3, "0")}</span>
              {selectedPokemon.shiny && (
                <span className="journey-shiny-badge"><Sparkles className="size-3" /> SHINY</span>
              )}
              <img
                src={selectedPokemon.imageUrl}
                alt={selectedPokemon.nickname || selectedPokemon.displayName}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <div className="journey-spotlight-details">
              <p className="hof-kicker">{selectedInParty ? "Active party" : "PC storage"} · selected Pokémon</p>
              <h2 className="journey-spotlight-name">{selectedPokemon.nickname || selectedPokemon.displayName}</h2>
              <div className="journey-party-types justify-start">
                {selectedPokemon.types.slice(0, 2).map((type) => <span key={type}>{type}</span>)}
              </div>
              <div className="journey-stat-row">
                <div><span>LEVEL</span><strong>{selectedPokemon.level}</strong></div>
                <div><span>HEALTH</span><strong>{selectedPokemon.hp}/{selectedPokemon.maxHp}</strong></div>
                <div><span>EXPERIENCE</span><strong>{selectedPokemon.xp.toLocaleString()}</strong></div>
              </div>
              <div className="journey-xp-track" role="img" aria-label={`${selectedPokemon.xp} of ${selectedPokemon.xpNeeded} experience to next level`}>
                <span style={{ width: `${Math.min(100, Math.round((selectedPokemon.xp / Math.max(1, selectedPokemon.xpNeeded)) * 100))}%` }} />
              </div>
              <div className="journey-hp-track" role="img" aria-label={`${selectedPokemon.displayName} health ${selectedPokemon.hp} of ${selectedPokemon.maxHp}`}>
                <span style={{ width: `${Math.max(0, Math.min(100, selectedPokemon.maxHp ? (selectedPokemon.hp / selectedPokemon.maxHp) * 100 : 0))}%` }} />
              </div>
              <div className="journey-spotlight-actions">
                {selectedInParty ? (
                  <>
                    <button
                      type="button"
                      onClick={() => leadMutation.mutate(selectedPokemon.id)}
                      disabled={leadMutation.isPending || user.leadPokemonId === selectedPokemon.id}
                      className="journey-action-primary"
                    >
                      <Crown className="size-4" />
                      {user.leadPokemonId === selectedPokemon.id ? "Lead Pokémon" : "Set as lead"}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMutation.mutate({ pokemonId: selectedPokemon.id, destination: "pc" })}
                      disabled={moveMutation.isPending}
                      className="journey-action-secondary"
                    >
                      <ArrowDownToLine className="size-4" /> Move to PC
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => moveMutation.mutate({ pokemonId: selectedPokemon.id, destination: "party" })}
                    disabled={moveMutation.isPending}
                    className="journey-action-primary"
                  >
                    <ArrowUpFromLine className="size-4" /> Add to party
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState text="Your Pokémon will appear here after you start your journey in WhatsApp." />
        )}
      </section>

      <label className="journey-collection-search">
        <Search className="size-4 text-cyan-200" />
        <input
          value={collectionSearch}
          onChange={(event) => setCollectionSearch(event.target.value)}
          placeholder="Search your Pokémon…"
          aria-label="Search your Pokémon"
        />
        <span>{collection.length} owned</span>
      </label>

      <section className="journey-party-panel hof-panel p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="hof-kicker">Battle formation · {party.length}/6</p>
            <h2 className="hof-heading mt-1 text-3xl">Your party</h2>
            <p className="journey-party-summary mt-2 text-sm text-muted-foreground">
              Select a Pokémon to view it. Tap two slot numbers to reorder.
            </p>
          </div>
          <Swords className="size-7 text-cyan-300" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredParty.map((pokemon) => {
            const index = party.findIndex((entry) => entry.id === pokemon.id);
            return (
              <PartyCard
                key={pokemon.id}
                pokemon={pokemon}
                slot={index + 1}
                lead={user.leadPokemonId === pokemon.id}
                selected={selectedPokemon?.id === pokemon.id}
                reorderSelected={firstSlot === index + 1 || secondSlot === index + 1}
                onSlot={() => {
                  if (firstSlot === index + 1) {
                    setFirstSlot(null);
                    setSecondSlot(null);
                  } else if (!firstSlot) {
                    setFirstSlot(index + 1);
                  } else {
                    setSecondSlot(index + 1);
                  }
                }}
                onSelect={() => setSelectedPokemonId(pokemon.id)}
                onLead={() => leadMutation.mutate(pokemon.id)}
                onMove={() => moveMutation.mutate({ pokemonId: pokemon.id, destination: "pc" })}
              />
            );
          })}
          {party.length === 0 && (
            <EmptyState text="No active party found. Start your Pokémon journey in WhatsApp with .startjourney." />
          )}
          {party.length > 0 && filteredParty.length === 0 && (
            <EmptyState text="No party Pokémon matched your search." />
          )}
        </div>
        {selectedCount === 2 && (
          <button
            type="button"
            onClick={() => reorderMutation.mutate()}
            disabled={reorderMutation.isPending}
            className="hof-button mt-5"
          >
            {reorderMutation.isPending ? "Swapping…" : `Swap slots ${firstSlot} and ${secondSlot}`}
          </button>
        )}
      </section>

      <section className="hof-panel p-5 sm:p-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="hof-kicker">Trainer storage</p>
            <h2 className="hof-heading mt-1 text-3xl">Pokémon PC</h2>
          </div>
          <Grip className="size-7 text-cyan-300" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredPc.map((pokemon) => (
            <PcCard
              key={pokemon.id}
              pokemon={pokemon}
              selected={selectedPokemon?.id === pokemon.id}
              onSelect={() => setSelectedPokemonId(pokemon.id)}
              onMove={() => moveMutation.mutate({ pokemonId: pokemon.id, destination: "party" })}
            />
          ))}
          {pc.length === 0 && (
            <EmptyState text="Your PC is empty. Catch more Pokémon through the bot to expand your collection." />
          )}
          {pc.length > 0 && filteredPc.length === 0 && (
            <EmptyState text="No PC Pokémon matched your search." />
          )}
        </div>
      </section>
    </div>
  );
}

function PartyCard({
  pokemon,
  slot,
  lead,
  selected,
  reorderSelected,
  onSelect,
  onSlot,
  onLead,
  onMove,
}: {
  pokemon: OwnedPokemon;
  slot: number;
  lead: boolean;
  selected: boolean;
  reorderSelected: boolean;
  onSelect: () => void;
  onSlot: () => void;
  onLead: () => void;
  onMove: () => void;
}) {
  return (
    <article
      className={`journey-party-card hof-pokemon-card relative overflow-hidden rounded-3xl border p-4 ${lead ? "journey-party-lead border-cyan-300/70" : "border-white/10"} ${selected ? "journey-party-selected" : ""} ${reorderSelected ? "ring-2 ring-amber-300/80" : ""}`}
    >
      <button
        type="button"
        onClick={onSlot}
        aria-label={`Select party slot ${slot} — ${pokemon.nickname || pokemon.displayName}`}
        aria-pressed={reorderSelected}
        className="absolute left-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/60 font-mono-ui text-xs text-cyan-200"
      >
        {slot}
      </button>
      {lead && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-cyan-300 px-2 py-1 font-mono-ui text-[9px] font-bold text-[#03232e] uppercase">
          <Crown className="size-3" /> Lead
        </span>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`View ${pokemon.nickname || pokemon.displayName}`}
        aria-pressed={selected}
        className="journey-party-select"
      >
        <img
          src={pokemon.imageUrl}
          alt=""
          className="journey-party-art mx-auto h-40 w-full object-contain"
          loading="lazy"
          decoding="async"
        />
        <div className="text-center">
          <p className="font-display text-xl font-bold">{pokemon.nickname || pokemon.displayName}</p>
          <p className="mt-1 font-mono-ui text-[10px] text-cyan-100">
            LV {pokemon.level} <span aria-hidden="true">·</span> {pokemon.hp}/{pokemon.maxHp} HP
          </p>
          <div className="journey-party-hp" role="img" aria-label={`${pokemon.displayName} health ${pokemon.hp} of ${pokemon.maxHp}`}>
            <span style={{ width: `${Math.max(0, Math.min(100, pokemon.maxHp ? (pokemon.hp / pokemon.maxHp) * 100 : 0))}%` }} />
          </div>
          <div className="journey-party-types" role="group" aria-label={`${pokemon.displayName} types`}>
            {pokemon.types.slice(0, 2).map((type) => <span key={type}>{type}</span>)}
          </div>
        </div>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onLead}
          disabled={lead}
          className="hof-tab px-2 py-2 font-mono-ui text-[9px] uppercase disabled:opacity-40"
        >
          {lead ? "Lead" : "Set lead"}
        </button>
        <button
          type="button"
          onClick={onMove}
          className="hof-tab inline-flex items-center justify-center gap-1 px-2 py-2 font-mono-ui text-[9px] uppercase"
        >
          <ArrowDownToLine className="size-3" /> PC
        </button>
      </div>
    </article>
  );
}

function PcCard({
  pokemon,
  selected,
  onSelect,
  onMove,
}: {
  pokemon: OwnedPokemon;
  selected: boolean;
  onSelect: () => void;
  onMove: () => void;
}) {
  return (
    <article className={`journey-pc-card hof-pokemon-card rounded-3xl border border-white/10 p-4 text-center ${selected ? "journey-party-selected" : ""}`}>
      <button type="button" onClick={onSelect} className="journey-party-select" aria-pressed={selected} aria-label={`View ${pokemon.nickname || pokemon.displayName}`}>
        <img
          src={pokemon.imageUrl}
          alt=""
          className="mx-auto h-32 w-full object-contain"
          loading="lazy"
          decoding="async"
        />
        <p className="font-display text-lg font-bold">{pokemon.nickname || pokemon.displayName}</p>
        <p className="mt-1 font-mono-ui text-[10px] text-muted-foreground">LV {pokemon.level} · {pokemon.hp}/{pokemon.maxHp} HP</p>
      </button>
      <button
        type="button"
        onClick={onMove}
        className="hof-tab mt-4 inline-flex items-center gap-1 px-3 py-2 font-mono-ui text-[9px] uppercase"
      >
        <ArrowUpFromLine className="size-3" /> Add to party
      </button>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="col-span-full rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function journeyTypeAccent(type?: string) {
  const colors: Record<string, string> = {
    grass: "#88d64f",
    fire: "#ff8968",
    water: "#66c8f2",
    electric: "#f2d15f",
    psychic: "#ef8bb7",
    ice: "#8ae5e6",
    dragon: "#a78bfa",
    ghost: "#aa91e8",
    dark: "#9aa0ad",
    ground: "#d2a572",
    rock: "#bdb08a",
    bug: "#a6c95e",
    fairy: "#eea8df",
    fighting: "#e18a70",
    steel: "#9eb8c7",
    poison: "#c17bc9",
    flying: "#98b5e8",
    normal: "#b9b8a2",
  };
  return colors[String(type ?? "").toLowerCase()] ?? "#69dce4";
}
