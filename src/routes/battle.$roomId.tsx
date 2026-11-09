import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  DoorOpen,
  Eye,
  Flame,
  Heart,
  LoaderCircle,
  Music2,
  Package,
  Radio,
  RotateCcw,
  Share2,
  Shield,
  Swords,
  UserRound,
  Volume2,
  VolumeX,
  Zap,
} from "@/lib/lucide-icons";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AppShell } from "@/components/aidoru/AppShell";
import { applyBattleAction, fetchBattleRoom } from "@/lib/aidoru.functions";
import type { BattleAction, BattlePokemon, BattleRoom, BattleTrainer } from "@/lib/game";

export const Route = createFileRoute("/battle/$roomId")({
  head: () => ({
    meta: [
      { title: "Battle Room — AIDORU" },
      {
        name: "description",
        content: "A live Pokémon battle room with moves, items, switching, and spectators.",
      },
    ],
  }),
  component: BattleRoomPage,
});

function BattleRoomPage() {
  const { roomId } = Route.useParams();
  return (
    <AppShell
      title="Pokémon Battle"
      subtitle="Enter the arena, ready your party, or spectate the live battle."
      hidePageHeading
    >
      <BattleRoomBody roomId={roomId} />
    </AppShell>
  );
}

function BattleRoomBody({ roomId }: { roomId: string }) {
  const queryClient = useQueryClient();
  const loadRoom = useServerFn(fetchBattleRoom);
  const act = useServerFn(applyBattleAction);
  const battleQueryKey = ["aidoru", "battle-room", roomId] as const;
  const actionPendingRef = useRef(false);
  const query = useQuery({
    queryKey: battleQueryKey,
    queryFn: () => loadRoom({ data: { roomId } }),
    refetchInterval: (current) => {
      if (actionPendingRef.current) return false;
      const status = current.state.data?.status;
      return status === "active" ? 650 : status === "waiting" ? 2500 : false;
    },
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (action: BattleAction) => act({ data: { roomId, action } }),
    onMutate: async () => {
      actionPendingRef.current = true;
      await queryClient.cancelQueries({ queryKey: battleQueryKey });
    },
    onSuccess: (room) => queryClient.setQueryData(battleQueryKey, room),
    onSettled: () => {
      actionPendingRef.current = false;
    },
  });
  const reactionMutation = useMutation({
    mutationFn: (emoji: string) => act({ data: { roomId, action: { type: "reaction", emoji } } }),
    onSuccess: (nextRoom) => {
      queryClient.setQueryData<BattleRoom>(["aidoru", "battle-room", roomId], (current) =>
        current
          ? {
              ...current,
              reactions: nextRoom.reactions,
              spectators: nextRoom.spectators,
            }
          : nextRoom,
      );
    },
  });
  const [flash, setFlash] = useState<string | null>(null);
  const redirectedToLogin = useRef(false);
  const room = query.data;

  useEffect(() => {
    const message = query.error instanceof Error ? query.error.message : "";
    if (!query.isError || redirectedToLogin.current || !/^not signed in\.$/i.test(message)) return;
    redirectedToLogin.current = true;
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`/?returnTo=${encodeURIComponent(returnTo)}`);
  }, [query.error, query.isError]);

  if (query.isLoading)
    return (
      <RoomState
        icon={<LoaderCircle className="size-7 animate-spin" />}
        text="Loading battle room…"
      />
    );
  if (query.isError || !room) {
    const message = query.error instanceof Error ? query.error.message : "Battle room unavailable.";
    return (
      <RoomState
        icon={<DoorOpen className="size-7" />}
        text={
          message === "Not signed in."
            ? "Opening the trainer portal so you can sign in and return to this battle…"
            : message
        }
      />
    );
  }

  const perform = (action: BattleAction) => {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setFlash(null);
    mutation.mutate(action, {
      onError: (error) =>
        setFlash(error instanceof Error ? error.message : "That battle action failed."),
    });
  };
  const isSpectator = room.joinedAs === "spectator";
  const me = room.joinedAs === "challenger" ? room.challenger : room.opponent;
  const foe = room.joinedAs === "challenger" ? room.opponent : room.challenger;
  const viewedMe = isSpectator ? room.challenger : me;
  const viewedFoe = isSpectator ? room.opponent : foe;
  const waitingForOpponent = !room.opponent;
  const waitingForReady = Boolean(room.opponent && room.status === "waiting");
  const forcedSwitch = room.forcedSwitch === room.joinedAs;
  const myTurn = room.turn === room.joinedAs;
  const sendReaction = (emoji: string) => {
    setFlash(null);
    reactionMutation.mutate(emoji, {
      onError: (error) =>
        setFlash(error instanceof Error ? error.message : "That reaction could not be sent."),
    });
  };
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/battle?room=${encodeURIComponent(room.code)}`;

  return (
    <div className={`aidoru-page aidoru-page-battle-room space-y-5 pb-12 ${isSpectator ? "battle-spectator-only" : ""}`}>
      <div className="battle-room-audio-dock" role="group" aria-label="Battle audio controls">
        <BattleSoundscape
          combatLog={room.combatLog}
          status={room.status}
          pokemon={[...room.challenger.party, ...(room.opponent?.party ?? [])]}
        />
        <BattleMusic status={room.status} />
      </div>
      <BattleEndSound status={room.status} winnerId={room.winnerId} playerId={me?.id ?? null} />

      {!isSpectator && waitingForOpponent && <WaitingRoomCard room={room} />}
      {!isSpectator && waitingForReady && (
        <section className="battle-ready-banner hof-panel p-5">
          <p className="hof-kicker">Both parties loaded</p>
          <h2 className="hof-heading mt-1 text-3xl">Waiting for both trainers.</h2>
          <p className="mt-2 text-sm text-slate-300">
            The battle starts automatically when both trainers open this room.
          </p>
        </section>
      )}

      <BattleArena
        room={room}
        me={viewedMe}
        foe={viewedFoe}
        myTurn={myTurn}
        forcedSwitch={forcedSwitch}
        isSpectator={isSpectator}
        mutationPending={mutation.isPending}
        reactionPending={reactionMutation.isPending}
        onAction={perform}
        onReaction={sendReaction}
        shareUrl={shareUrl}
      />
      {flash && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {flash}
        </p>
      )}
    </div>
  );
}

function WaitingRoomCard({ room }: { room: BattleRoom }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const roomUrl = `${typeof window === "undefined" ? "" : window.location.origin}/battle?room=${encodeURIComponent(room.code)}`;
  const copy = (value: string, kind: "code" | "link") => {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    void clipboard.writeText(value).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600);
    });
  };
  const share = () => {
    if (navigator.share) {
      void navigator
        .share({
          title: "AIDORU Pokémon Battle",
          text: `Join my Pokémon battle with code ${room.code}.`,
          url: roomUrl,
        })
        .catch(() => undefined);
      return;
    }
    copy(roomUrl, "link");
  };

  return (
    <section className="battle-waiting-card hof-panel">
      <div className="battle-waiting-heading">
        <div>
          <p className="hof-kicker">Room ready</p>
          <h2 className="battle-panel-title">Waiting for trainer</h2>
        </div>
        <span className="battle-waiting-status">
          <span className="battle-waiting-dot" />
          Open
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">
        Share this code or link. The first signed-in trainer who opens it joins automatically.
      </p>
      <div className="battle-code-box">
        <p className="hof-kicker">Room code</p>
        <p className="battle-code-value">{room.code}</p>
        <p className="battle-code-url">{roomUrl}</p>
      </div>
      <div className="battle-waiting-actions">
        <button
          type="button"
          onClick={() => copy(room.code, "code")}
          className="battle-secondary-button"
        >
          {copied === "code" ? (
            <>
              <Check className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy code
            </>
          )}
        </button>
        <button type="button" onClick={share} className="battle-primary-button">
          <Share2 className="size-4" />
          {copied === "link" ? "Link copied" : "Share room"}
        </button>
      </div>
      <a href="/battle" className="battle-back-link">
        Return to battle lobby
      </a>
    </section>
  );
}

function BattleSoundscape({
  combatLog,
  status,
  pokemon,
}: {
  combatLog: string[];
  status: BattleRoom["status"];
  pokemon: BattleRoom["challenger"]["party"];
}) {
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);
  const cryAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousLength = useRef(combatLog.length);

  const context = () => {
    if (typeof window === "undefined") return null;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioRef.current ??= new AudioContextCtor();
    void audioRef.current.resume();
    return audioRef.current;
  };

  const tone = (
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.035,
  ) => {
    const ctx = context();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  };

  useEffect(() => {
    const unlock = () => {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      audioRef.current ??= new AudioContextCtor();
      void audioRef.current.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      previousLength.current = combatLog.length;
      return;
    }
    const newEntries = combatLog.slice(previousLength.current);
    if (newEntries.length === 0) return;
    previousLength.current = combatLog.length;
    const faintEntry = newEntries.find((entry) => /fainted/i.test(entry));
    const latest = faintEntry ?? [...newEntries].reverse().find((entry) => /used|counterattacked|sent out/i.test(entry)) ?? "";
    const lowerLog = faintEntry?.toLowerCase() ?? "";
    const cryingPokemon = pokemon.find((entry) => {
      const names = [entry.displayName, entry.name].filter(Boolean).map((name) => name.toLowerCase());
      return names.some((name) => name.length > 1 && lowerLog.includes(name));
    });
    if (cryingPokemon && Number(cryingPokemon.pokedexId) > 0 && faintEntry) {
      const cry = cryAudioRef.current ?? new Audio();
      cryAudioRef.current = cry;
      cry.src = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${cryingPokemon.pokedexId}.ogg`;
      cry.volume = 0.38;
      cry.currentTime = 0;
      void cry.play().catch(() => undefined);
    }
    if (faintEntry) {
      const faintSound = new Audio("/battle-music/se_faint.mp3");
      faintSound.volume = 0.52;
      void faintSound.play().catch(() => undefined);
      tone(180, 0.24, "sawtooth", 0.06);
      window.setTimeout(() => tone(110, 0.35, "triangle", 0.045), 100);
    } else if (/wins|victory|complete/i.test(latest) || status === "finished") {
      tone(523, 0.18, "triangle");
      window.setTimeout(() => tone(659, 0.24, "triangle"), 130);
    } else if (/hit|damage|used|attacked|sent out/i.test(latest)) {
      tone(260, 0.08, "square", 0.025);
    }
  }, [combatLog, enabled, pokemon, status]);

  useEffect(() => {
    if (!enabled) return;
    const ctx = context();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 98;
    gain.gain.value = 0.006;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    const pulse = window.setInterval(() => {
      oscillator.frequency.setTargetAtTime(98 + Math.random() * 16, ctx.currentTime, 0.8);
    }, 1800);
    return () => {
      window.clearInterval(pulse);
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    };
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((value) => !value)}
      className={`battle-audio-button ${enabled ? "battle-audio-button-on" : ""}`}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute battle effects" : "Enable battle effects"}
      title={enabled ? "Battle effects on" : "Battle effects off"}
    >
      {enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
    </button>
  );
}

function BattleWildlife() {
  return (
    <div className="battle-wildlife" aria-hidden="true">
      <img className="battle-wildlife-one" src="/pokemon-gifs/10.gif" alt="" />
      <img className="battle-wildlife-two" src="/pokemon-gifs/25.gif" alt="" />
      <img className="battle-wildlife-three" src="/pokemon-gifs/133.gif" alt="" />
    </div>
  );
}

function BattleTrainerSprite({
  trainer,
  side,
}: {
  trainer: BattleTrainer | null;
  side: "me" | "foe";
}) {
  return (
    <div className={`battle-trainer trainer-${side}`} aria-hidden="true">
      {trainer?.trainerSpriteUrl ? (
        <img src={trainer.trainerSpriteUrl} alt="" />
      ) : (
        <UserRound className="size-10 text-cyan-100/70" />
      )}
    </div>
  );
}

const battleMusicTracks = [
  "mus_vs_trainer",
  "mus_vs_wild",
  "mus_vs_gym_leader",
  "mus_vs_champion",
] as const;
const victoryTracks = [
  "mus_victory_trainer",
  "mus_victory_gym_leader",
  "mus_victory_road",
] as const;
const defeatTracks = ["mus_too_bad", "se_failure", "se_faint"] as const;

function BattleMusic({ status }: { status: BattleRoom["status"] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track] = useState(
    () => battleMusicTracks[Math.floor(Math.random() * battleMusicTracks.length)],
  );
  const [enabled, setEnabled] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const active = enabled && status !== "finished";
    audio.volume = 0.22;
    audio.loop = true;
    audio.preload = active ? "auto" : "none";
    if (!active) {
      audio.pause();
      return;
    }
    const resume = () => {
      if (document.visibilityState === "hidden" || !audio.paused) return;
      void audio.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    };
    resume();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("touchstart", resume, { passive: true });
    window.addEventListener("keydown", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    audio.addEventListener("ended", resume);
    audio.addEventListener("pause", resume);
    audio.addEventListener("canplay", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("touchstart", resume);
      window.removeEventListener("keydown", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      audio.removeEventListener("ended", resume);
      audio.removeEventListener("pause", resume);
      audio.removeEventListener("canplay", resume);
      audio.pause();
    };
  }, [enabled, status]);
  const toggleMusic = () => {
    if (enabled && !autoplayBlocked) {
      setEnabled(false);
      return;
    }
    setEnabled(true);
    setAutoplayBlocked(false);
    if (status !== "finished" && audioRef.current) {
      void audioRef.current.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    }
  };
  return (
    <>
      <audio
        ref={audioRef}
        src={`/battle-music/${track}.mp3`}
        autoPlay
        loop
        preload="auto"
        playsInline
      />
      <button
        type="button"
        className={`battle-audio-button ${enabled && !autoplayBlocked ? "battle-audio-button-on" : ""}`}
        onClick={toggleMusic}
        aria-pressed={enabled && !autoplayBlocked}
        aria-label={enabled && !autoplayBlocked ? "Turn battle music off" : "Turn battle music on"}
        title={enabled && !autoplayBlocked ? "Battle music on" : "Tap to start battle music"}
      >
        <Music2 aria-hidden="true" />
      </button>
      {autoplayBlocked && status !== "finished" && (
        <span className="battle-audio-hint battle-audio-hint-blocked" role="status">
          Tap to enable music
        </span>
      )}
    </>
  );
}

function BattleEndSound({
  status,
  winnerId,
  playerId,
}: {
  status: BattleRoom["status"];
  winnerId: string | null;
  playerId: string | null;
}) {
  const playedKey = useRef<string | null>(null);
  const [track] = useState(() => ({
    victory: victoryTracks[Math.floor(Math.random() * victoryTracks.length)],
    defeat: defeatTracks[Math.floor(Math.random() * defeatTracks.length)],
  }));
  const won = Boolean(winnerId && playerId && winnerId === playerId);
  const result = won ? "victory" : "defeat";
  useEffect(() => {
    if (status !== "finished" || !playerId || playedKey.current === `${winnerId}:${playerId}`)
      return;
    playedKey.current = `${winnerId}:${playerId}`;
    const audio = new Audio(`/battle-music/${track[result]}.mp3`);
    audio.volume = 0.46;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [playerId, result, status, track, winnerId]);
  return null;
}

function BattleArena({
  room,
  me,
  foe,
  myTurn,
  forcedSwitch,
  isSpectator,
  mutationPending,
  reactionPending,
  onAction,
  onReaction,
  shareUrl,
}: {
  room: BattleRoom;
  me: BattleTrainer | null;
  foe: BattleTrainer | null;
  myTurn: boolean;
  forcedSwitch: boolean;
  isSpectator: boolean;
  mutationPending: boolean;
  reactionPending: boolean;
  onAction: (action: BattleAction) => void;
  onReaction: (emoji: string) => void;
  shareUrl: string;
}) {
  const activeMe = me?.party[me.activeIndex] ?? null;
  const activeFoe = foe?.party[foe.activeIndex] ?? null;
  const [tab, setTab] = useState<"moves" | "items" | "switch">("moves");
  const [recallSide, setRecallSide] = useState<"me" | "foe" | null>(null);
  const [sendOutSide, setSendOutSide] = useState<"me" | "foe" | null>(null);
  const [damageSide, setDamageSide] = useState<"me" | "foe" | null>(null);
  const [damageAmount, setDamageAmount] = useState<number | null>(null);
  const [damageId, setDamageId] = useState(0);
  const [faintSide, setFaintSide] = useState<"me" | "foe" | null>(null);
  const [faintId, setFaintId] = useState(0);
  const previousHp = useRef({
    meId: activeMe?.id ?? null,
    foeId: activeFoe?.id ?? null,
    me: activeMe?.hp ?? null,
    foe: activeFoe?.hp ?? null,
  });
  const previousActiveIds = useRef({ me: activeMe?.id ?? null, foe: activeFoe?.id ?? null });
  useEffect(() => {
    const next = {
      meId: activeMe?.id ?? null,
      foeId: activeFoe?.id ?? null,
      me: activeMe?.hp ?? null,
      foe: activeFoe?.hp ?? null,
    };
    const activeChanged =
      previousHp.current.meId !== next.meId || previousHp.current.foeId !== next.foeId;
    if (activeChanged) {
      previousHp.current = next;
      return;
    }
    const faintedSide =
      previousHp.current.me !== null &&
      previousHp.current.me > 0 &&
      next.me !== null &&
      next.me <= 0
        ? "me"
        : previousHp.current.foe !== null &&
            previousHp.current.foe > 0 &&
            next.foe !== null &&
            next.foe <= 0
          ? "foe"
          : null;
    const hitSide =
      previousHp.current.me !== null && next.me !== null && next.me < previousHp.current.me
        ? "me"
        : previousHp.current.foe !== null && next.foe !== null && next.foe < previousHp.current.foe
          ? "foe"
          : null;
    previousHp.current = next;
    if (hitSide) {
      const pkmn = hitSide === "me" ? activeMe : activeFoe;
      if (pkmn && !faintedSide) {
        const sound = new Audio(
          `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pkmn.pokedexId}.ogg`,
        );
        sound.volume = 0.38;
        void sound.play().catch(() => undefined);
      }
    }
    if (!faintedSide) return;
    setRecallSide(faintedSide);
    const timer = window.setTimeout(
      () => setRecallSide((side) => (side === faintedSide ? null : side)),
      1150,
    );
    return () => window.clearTimeout(timer);
  }, [activeMe?.hp, activeFoe?.hp]);
  useEffect(() => {
    const next = { me: activeMe?.id ?? null, foe: activeFoe?.id ?? null };
    const changedSide =
      previousActiveIds.current.me && next.me && previousActiveIds.current.me !== next.me
        ? "me"
        : previousActiveIds.current.foe && next.foe && previousActiveIds.current.foe !== next.foe
          ? "foe"
          : null;
    previousActiveIds.current = next;
    if (!changedSide) return;
    setSendOutSide(changedSide);
    const timer = window.setTimeout(
      () => setSendOutSide((side) => (side === changedSide ? null : side)),
      1050,
    );
    return () => window.clearTimeout(timer);
  }, [activeMe?.id, activeFoe?.id]);
  const [transitionId, setTransitionId] = useState(0);
  const [superEffectiveId, setSuperEffectiveId] = useState(0);
  const [superEffectiveActive, setSuperEffectiveActive] = useState(false);
  const previousLogLength = useRef(room.combatLog.length);
  useEffect(() => {
    if (room.combatLog.length <= previousLogLength.current) return;
    const newEntries = room.combatLog.slice(previousLogLength.current);
    previousLogLength.current = room.combatLog.length;
    const attackEntry = [...newEntries].reverse().find((entry) => / used |counterattacked/i.test(entry));
    const faintEntry = newEntries.find((entry) => /fainted/i.test(entry));
    if (attackEntry) setTransitionId((value) => value + 1);
    const lowerAttack = attackEntry?.toLowerCase() ?? "";
    const meAttacked = me?.party.some((pokemon) =>
      lowerAttack.includes(`${pokemon.displayName.toLowerCase()} used`),
    );
    const foeAttacked = foe?.party.some((pokemon) => {
      const name = pokemon.displayName.toLowerCase();
      return lowerAttack.includes(`${name} used`) || lowerAttack.includes(`${name} counterattacked`);
    });
    const damagedSide = meAttacked ? "foe" : foeAttacked ? "me" : null;
    const damageMatch = attackEntry?.match(/(\d+) damage/i) ?? null;
    if (damagedSide && damageMatch) {
      setDamageSide(damagedSide);
      setDamageAmount(Number(damageMatch[1]));
      setDamageId((value) => value + 1);
      window.setTimeout(() => {
        setDamageSide((side) => (side === damagedSide ? null : side));
        setDamageAmount((amount) => (amount === Number(damageMatch[1]) ? null : amount));
      }, 950);
    }
    if (faintEntry) {
      const line = faintEntry.toLowerCase();
      const faintedByMe = me?.party.some((pokemon) =>
        line.includes(`${pokemon.displayName.toLowerCase()} fainted`),
      );
      const faintedByFoe = foe?.party.some((pokemon) =>
        line.includes(`${pokemon.displayName.toLowerCase()} fainted`),
      );
      if (faintedByMe || faintedByFoe) {
        const side = faintedByMe ? "me" : "foe";
        setFaintSide(side);
        setFaintId((value) => value + 1);
        window.setTimeout(() => setFaintSide((current) => (current === side ? null : current)), 1450);
      }
    }
    if (attackEntry && /super effective!/i.test(attackEntry)) {
      setSuperEffectiveId((value) => value + 1);
      setSuperEffectiveActive(true);
      window.setTimeout(() => setSuperEffectiveActive(false), 900);
    }
  }, [activeFoe?.displayName, activeMe?.displayName, foe, me, room.combatLog, room.combatLog.length]);
  const winnerName =
    room.winnerId === room.challenger.id
      ? room.challenger.name
      : room.winnerId === room.opponent?.id
        ? room.opponent.name
        : null;
  const statusText =
    room.status === "finished"
      ? winnerName
        ? `${winnerName} has won the battle!`
        : "Battle complete"
      : room.status === "waiting"
        ? room.opponent
          ? "Both trainers loaded"
          : "Waiting for opponent"
        : forcedSwitch
          ? "Choose a replacement Pokémon"
          : myTurn
            ? "Your turn"
            : isSpectator
              ? "Spectating live battle"
              : "Opponent’s turn";
  const canAct =
    !isSpectator && !mutationPending && room.status === "active" && (myTurn || forcedSwitch);
  const arenaStyle = {
    "--battle-map-bg": `url("${battleMapUrl(room.arenaId)}")`,
    ...(room.gym
      ? {
          "--gym-accent": room.gym.accent,
          "--gym-bg": `url("${battleMapUrl(room.arenaId)}")`,
        }
      : {}),
  } as CSSProperties;

  return (
    <section 
      className={`battle-arena hof-panel overflow-hidden ${room.gym ? `battle-gym-theme-${room.gym.theme}` : ""}`} 
      style={arenaStyle}
    >
      <div className="battle-arena-top flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          {room.status === "active" && <span className="battle-live-pill">LIVE</span>}
          <Swords className="size-4 text-cyan-200" />
          <span className="font-display text-lg font-bold">
            {room.challenger.name} <span className="text-cyan-300">vs</span>{" "}
            {room.opponent?.name ?? "Waiting"}
          </span>
        </div>
        <div className="battle-arena-meta">
          {room.status === "active" && <span className="battle-round-chip">ROUND {room.round}</span>}
          <span className="battle-turn-label" role="status">{statusText}</span>
          <span className="battle-spectator-count" aria-label={`${room.spectators} spectators`}>
            <Eye className="size-3.5" />
            <strong>{room.spectators}</strong>
            <span>watching</span>
          </span>
          {room.gym && (
            <span className="battle-gym-chip" style={{ "--gym-accent": room.gym.accent } as CSSProperties}>
              <span>{room.gym.type} arena</span>
              <strong>{room.gym.badge}</strong>
            </span>
          )}
        </div>
        {room.status === "active" && (
          <div className="battle-reaction-dock" aria-label="Send a battle reaction">
            <span className="battle-reaction-label">React</span>
            {["🔥", "👏", "💙", "⚡", "😮", "😂"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React ${emoji}`}
                disabled={reactionPending}
                onClick={() => onReaction(emoji)}
                className="battle-reaction-button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="battle-room-action-buttons">
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard && shareUrl)
                void navigator.clipboard.writeText(shareUrl).catch(() => undefined);
            }}
            className="battle-room-action-button"
            aria-label="Share battle room"
          >
            <Share2 aria-hidden="true" />
            <span>Share</span>
          </button>
          {isSpectator || room.status !== "active" ? (
            <a href="/battle" className="battle-room-action-button">
              <DoorOpen aria-hidden="true" />
              <span>Leave</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onAction({ type: "forfeit" })}
              disabled={mutationPending}
              className="battle-room-action-button"
              aria-label="Leave battle and forfeit"
            >
              <DoorOpen aria-hidden="true" />
              <span>Leave</span>
            </button>
          )}
        </div>

      </div>
      <div className="battle-message-strip font-bold" role="status" aria-live="polite">
        <span className="battle-latest-label">Latest turn · {room.round}</span>
        <span className="battle-message-dot" />
        {room.combatLog[room.combatLog.length - 1] ?? "The Pokémon match is ready."}
      </div>
      <div
        className={`battle-field ${room.gym ? `battle-gym-field battle-gym-field-${room.gym.theme}` : `battle-field-map-${room.arenaId ?? "meadow"}`} ${room.weather ? `battle-field-weather-${room.weather.id}` : ""} ${transitionId > 0 ? "battle-field-pulse" : ""} ${superEffectiveActive ? "battle-field-super-effective" : ""} ${myTurn ? "battle-field-my-turn" : ""} ${room.status === "finished" ? "battle-field-finished" : ""}`}
        style={arenaStyle}
      >
        {room.weather && (
          <div
            className={`battle-weather-layer battle-weather-layer-${room.weather.id}`}
            aria-hidden="true"
          />
        )}
        {room.status === "active" && (
          <div className="battle-reaction-floats" aria-live="polite" aria-label="Live battle reactions">
            {(room.reactions ?? [])
              .filter((reaction) => Date.now() - reaction.createdAt < 4_000)
              .slice(-7)
              .map((reaction) => (
                <span
                  key={`${reaction.userId}-${reaction.createdAt}`}
                  className="battle-reaction-float"
                  aria-label={`Battle reaction ${reaction.emoji}`}
                >
                  {reaction.emoji}
                </span>
              ))}
          </div>
        )}
        <div className="battle-field-caption" aria-hidden="true">
          <span>{room.gym ? `${room.gym.name} · ${room.gym.type} arena` : "AIDORU battle field"}</span>
          <span>{room.status === "active" ? `ROUND ${room.round}` : room.status === "finished" ? "RESULT" : "ARENA READY"}</span>
        </div>
        {room.weather && (
          <div className={`battle-weather-banner battle-weather-${room.weather.id}`} role="status" aria-label={`Weather: ${room.weather.name}. ${room.weather.description}`}>
            <span className="battle-weather-icon" aria-hidden="true">{room.weather.icon}</span>
            <span><strong>{room.weather.name}</strong><small>{room.weather.description}</small></span>
          </div>
        )}
        {mutationPending && (
          <div className="battle-action-loading" role="status" aria-live="polite">
            <span className="battle-loading-ball" aria-hidden="true" />
            Resolving turn
          </div>
        )}
        {superEffectiveActive && <SuperEffectiveBurst key={superEffectiveId} />}
        {activeFoe && activeFoe.hp > 0 && (
          <BattlePokemonSprite
            key={`foe-${activeFoe.id}`}
            pokemon={activeFoe}
            side="foe"
            defeated={false}
            hit={damageSide === "foe"}
            sendOut={sendOutSide === "foe"}
          />
        )}
        {activeMe && activeMe.hp > 0 && (
          <BattlePokemonSprite
            key={`me-${activeMe.id}`}
            pokemon={activeMe}
            side="me"
            defeated={false}
            hit={damageSide === "me"}
            sendOut={sendOutSide === "me"}
          />
        )}
        {recallSide && (
          <div
            className={`battle-pokeball-recall battle-pokeball-recall-${recallSide}`}
            aria-hidden="true"
          >
            <span />
          </div>
        )}
        {damageSide && <BattleDamageBurst key={damageId} side={damageSide} amount={damageAmount} />}
        {faintSide && (
          <div
            key={faintId}
            className={`battle-faint-stamp battle-faint-stamp-${faintSide}`}
            role="status"
            aria-live="polite"
          >
            <span>FAINTED</span>
          </div>
        )}
        {sendOutSide && (
          <div
            className={`battle-pokeball-sendout battle-pokeball-sendout-${sendOutSide}`}
            aria-hidden="true"
          >
            <span />
          </div>
        )}
        <BattleHud pokemon={activeFoe} trainer={foe} side="foe" />
        <BattleHud pokemon={activeMe} trainer={me} side="me" />
        {transitionId > 0 && <BattleParticleTransition key={transitionId} />}
      </div>

      {!isSpectator && <div className="battle-controls border-t border-white/10 bg-black/25 p-4 sm:p-6">
        {!isSpectator && <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="hof-kicker">{room.gym ? `${room.gym.name} · Leader ${room.gym.leader}` : "Command console"}</p>
            <p className="mt-1 text-sm text-slate-300">
              {forcedSwitch
                ? "Your active Pokémon fainted. Send out a healthy teammate."
                : "Select a move or switch your active Pokémon."}
            </p>
          </div>
        </div>}
        {!isSpectator && room.status === "waiting" && (
          <div className="battle-spectator-note">
            <Radio className="size-4 text-cyan-200" />
            {room.opponent
              ? "Both trainers need to open this room. The match then starts automatically."
              : "This Pokémon arena is open. Share the room link with the opposing trainer to load their party."}
          </div>
        )}
        {!isSpectator && room.status === "active" && (
          <div className="battle-command-row mb-4">
            <div className="battle-command-tabs" role="group" aria-label="Battle commands">
              <TabButton
                active={tab === "moves"}
                onClick={() => setTab("moves")}
                icon={<Flame className="size-4" />}
              >
                Fight
              </TabButton>
              <TabButton
                active={tab === "items"}
                onClick={() => setTab("items")}
                icon={<Package className="size-4" />}
              >
                Bag
              </TabButton>
              <TabButton
                active={tab === "switch"}
                onClick={() => setTab("switch")}
                icon={<RotateCcw className="size-4" />}
              >
                Pokémon
              </TabButton>
              <button
                type="button"
                onClick={() => onAction({ type: "forfeit" })}
                disabled={mutationPending}
                className="battle-run-button battle-command-run"
                aria-label="Forfeit this battle"
              >
                <DoorOpen className="size-4" />
                Run
              </button>
            </div>
          </div>
        )}
        {!isSpectator && tab === "moves" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {activeMe?.moves.map((move, index) => (
              <button
                key={`${move.name}-${index}`}
                type="button"
                onClick={() => onAction({ type: "move", moveIndex: index })}
                disabled={!canAct || forcedSwitch}
                aria-label={`${move.name}, ${move.type} type, power ${move.power || "status"}${move.pp === undefined ? "" : `, ${move.pp} PP`}`}
                className={`battle-move-button battle-type-${move.type.toLowerCase().replace(/[^a-z0-9-]/g, "")}`}
              >
                <span className="font-display text-base font-bold">{move.name}</span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.15em] text-cyan-200/70">
                  {move.type} · {move.power || "status"}{move.pp === undefined ? "" : ` · ${move.pp} PP`}
                </span>
              </button>
            ))}
          </div>
        )}
        {!isSpectator && tab === "items" && (
          <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-5 text-center">
            <p className="font-display text-base font-bold text-amber-100">Healing items are disabled during battles</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">Switch to another healthy Pokémon during combat. Use healing items only after the battle ends.</p>
          </div>
        )}
        {!isSpectator && tab === "switch" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {me?.party.map((pokemon, index) => (
              <SwitchButton
                key={pokemon.id}
                pokemon={pokemon}
                active={index === me.activeIndex}
                disabled={!canAct || pokemon.hp <= 0 || (!forcedSwitch && index === me.activeIndex)}
                onClick={() => onAction({ type: "switch", pokemonIndex: index })}
              />
            ))}
          </div>
        )}
      </div>}

      {!isSpectator && room.status === "finished" && (
        <div className="battle-winner-banner" role="status" aria-live="polite">
          <Swords className="size-5" />
          <div>
            <span>Battle complete</span>
            <strong>{winnerName ? `${winnerName} has won the battle!` : "The match has ended."}</strong>
          </div>
          <Swords className="size-5" />
        </div>
      )}
      <div className={`battle-arena-lower ${isSpectator ? "battle-arena-lower-spectator" : ""}`}>
        <details className="battle-feed-details" open={room.status === "finished" ? true : undefined}>
          <summary>
            <strong>Battle feed</strong>
            <span>Latest first</span>
            <span className="battle-feed-count">{room.combatLog.length}</span>
          </summary>
          <div className="battle-log mt-2">
            {room.combatLog.length > 0 ? room.combatLog
              .slice()
              .reverse()
              .map((line, index) => (
                <p key={`${line}-${index}`} className={index === 0 ? "text-cyan-100" : ""}>
                  {line}
                </p>
              )) : <p className="battle-log-empty">Combat events will appear here once the match begins.</p>}
          </div>
        </details>
        {!isSpectator && <div>
          <p className="hof-kicker">Party status</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <PartyDot
                key={me?.party[index]?.id ?? `empty-${index}`}
                pokemon={me?.party[index] ?? null}
                active={index === me?.activeIndex}
              />
            ))}
          </div>
        </div>}
      </div>
    </section>
  );
}

function SuperEffectiveBurst() {
  return (
    <div className="battle-super-effective-burst" aria-hidden="true">
      <strong>SUPER EFFECTIVE!</strong>
      {Array.from({ length: 28 }, (_, index) => (
        <i key={index} style={{ ["--super-index" as string]: index } as CSSProperties} />
      ))}
    </div>
  );
}

function BattleParticleTransition() {
  return (
    <div className="battle-particle-transition" aria-hidden="true">
      <span className="battle-transition-ring" />
      <span className="battle-transition-ring" />
      {Array.from({ length: 12 }, (_, index) => (
        <i key={index} style={{ ["--burst-index" as string]: index } as CSSProperties} />
      ))}
    </div>
  );
}

function BattlePokemonSprite({
  pokemon,
  side,
  defeated,
  hit,
  sendOut,
}: {
  pokemon: BattlePokemon;
  side: "me" | "foe";
  defeated: boolean;
  hit: boolean;
  sendOut: boolean;
}) {
  const sources = animatedPokemonUrls(pokemon, side);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(
    () => setSourceIndex(0),
    [pokemon.id, pokemon.pokedexId, pokemon.name, pokemon.shiny, side],
  );
  const source =
    sources[Math.min(sourceIndex, sources.length - 1)] ??
    pokemon[side === "me" ? "backSpriteUrl" : "frontSpriteUrl"];
  const scaleClass = battlePokemonScaleClass(pokemon);
  
  // Logic to determine if we should flip the sprite
  // Most front sprites face left. If on foe side (right), they should face left (towards player).
  // If on player side (left), they should face right (towards foe).
  // Most back sprites face right. If on player side (left), they should face right (towards foe).
  const isBackSprite = source.includes('/back/');
  const shouldFlip = side === 'me' ? !isBackSprite : isBackSprite;

  return (
    <div
      className={`battle-pokemon battle-pokemon-${side} ${scaleClass} ${defeated ? "battle-pokemon-fainted" : ""} ${hit ? "battle-pokemon-hit" : ""} ${sendOut ? "battle-pokemon-sendout" : ""}`}
    >
      <img
        src={source}
        alt={pokemon.displayName}
        loading="eager"
        decoding="async"
        style={{ transform: shouldFlip ? 'scaleX(-1)' : 'scaleX(1)' }}
        fetchPriority={sourceIndex === 0 ? "high" : "auto"}
        onLoad={(event) => {
          event.currentTarget.style.visibility = "visible";
        }}
        onError={(event) => {
          if (sourceIndex < sources.length - 1) setSourceIndex(sourceIndex + 1);
          else event.currentTarget.style.visibility = "hidden";
        }}
      />
      <span className="battle-pokemon-shadow" />
    </div>
  );
}

function battleMapUrl(arenaId?: string) {
  if (arenaId === "forest" || arenaId === "cave") return "/battle-maps/forest-pixel.jpg";
  if (arenaId === "coast" || arenaId === "snowfield")
    return "/battle-maps/masters-ex-forest.jpg";
  return "/battle-maps/meadow-3d.jpg";
}

function battlePokemonScaleClass(pokemon: BattlePokemon) {
  const id = Number(pokemon.pokedexId);
  const name = `${pokemon.name} ${pokemon.displayName}`.toLowerCase();
  if (
    [382, 383, 384, 493, 483, 484, 487, 643, 644, 646, 717, 718, 791, 792, 800, 888, 889, 890].includes(
      id,
    ) ||
    /arceus|rayquaza|groudon|kyogre|lugia|ho[- ]oh|giratina|eternatus|zygarde|xerneas|yveltal|solgaleo|lunala|necrozma|zacian|zamazenta|reshiram|zekrom/i.test(
      name,
    )
  ) {
    return /rayquaza|eternatus|zygarde|kyogre|groudon/i.test(name) ||
      [382, 383, 384, 890].includes(id)
      ? "battle-pokemon-huge-wide"
      : "battle-pokemon-huge";
  }
  if (
    [6, 149, 248, 373, 376, 445, 635, 706].includes(id) ||
    /charizard|dragonite|tyranitar|salamence|metagross|garchomp|hydreigon|goodra/i.test(name)
  ) {
    return "battle-pokemon-large";
  }
  if (
    [7, 25, 133, 152, 155, 447, 656, 810, 813, 816].includes(id) ||
    /sobble|froakie|pikachu|eevee|scorbunny|grookey|rowlet|rattata/i.test(name)
  ) {
    return "battle-pokemon-small";
  }
  return "battle-pokemon-standard";
}

function animatedPokemonUrls(pokemon: BattlePokemon, side: "me" | "foe" = "foe") {
  const id = Math.max(1, Math.floor(Number(pokemon.pokedexId) || 1));
  const baseName = String(pokemon.name || pokemon.displayName || "pokemon")
    .trim()
    .replace(/[- ]+(gigantamax|gmax)$/i, "")
    .replace(/_+(gigantamax|gmax)$/i, "");
  const titleCase = baseName
    ? `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}`
    : "Pokemon";
  const shinySuffix = pokemon.shiny ? "_Shiny" : "";
  const generationEightNames = Array.from(
    new Set([
      `${pokemon.name}${shinySuffix}`,
      `${titleCase}${shinySuffix}`,
      `${titleCase}_Gigantamax${shinySuffix}`,
      `${titleCase}_Gmax${shinySuffix}`,
    ]),
  );
  const generationEight = generationEightNames.map(
    (name) =>
      `https://raw.githubusercontent.com/kelin132/gmax-gifs/master/Generation%208/${encodeURIComponent(name)}.gif`,
  );
  const local = id <= 500 ? `/pokemon-gifs/${id}.gif` : "";
  const repositoryFront = `https://raw.githubusercontent.com/kelin132/animated-pokemon-gifs/master/${id}.gif`;
  const repositoryBack = `https://raw.githubusercontent.com/kelin132/animated-pokemon-gifs/master/back/${id}.gif`;
  const showdownFront = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
  const showdownBack = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${id}.gif`;
  const animatedBwFront = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
  const animatedBwBack = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/${id}.gif`;
  const preferredSideSprite = side === "me" ? pokemon.backSpriteUrl : pokemon.frontSpriteUrl;
  const animatedStoredSprite = /^https?:\/\/.*\.gif(?:\?.*)?$/i.test(preferredSideSprite)
    ? preferredSideSprite
    : "";
  const officialArtwork = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const staticFront = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const staticBack = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`;
  const staticFallbacks =
    side === "me"
      ? [pokemon.backSpriteUrl, pokemon.imageUrl, pokemon.frontSpriteUrl, staticBack, officialArtwork, staticFront]
      : [pokemon.frontSpriteUrl, pokemon.imageUrl, pokemon.backSpriteUrl, officialArtwork, staticFront, staticBack];
  const animatedCandidates =
    side === "me"
      ? [
          local,
          repositoryBack,
          showdownBack,
          animatedBwBack,
          animatedStoredSprite,
          repositoryFront,
          showdownFront,
          animatedBwFront,
          ...staticFallbacks,
        ]
      : [
          ...(pokemon.pokedexId >= 810 && pokemon.pokedexId <= 905 ? generationEight : []),
          local,
          repositoryFront,
          showdownFront,
          animatedBwFront,
          animatedStoredSprite,
          ...staticFallbacks,
        ];
  return [...new Set(animatedCandidates.filter(Boolean))];
}

function BattleDamageBurst({ side, amount }: { side: "me" | "foe"; amount: number | null }) {
  return (
    <div className={`battle-impact battle-impact-${side}`} aria-hidden="true">
      <span className="battle-impact-core" />
      <strong className="battle-damage-label">-{amount ?? ""}</strong>
      {Array.from({ length: 10 }, (_, index) => (
        <i key={index} style={{ ["--impact-index" as string]: index } as CSSProperties} />
      ))}
    </div>
  );
}

function BattleHud({
  pokemon,
  trainer,
  side,
}: {
  pokemon: BattlePokemon | null;
  trainer: BattleTrainer | null;
  side: "me" | "foe";
}) {
  if (!pokemon) return null;
  const hp = Math.max(0, Math.min(100, pokemon.maxHp ? (pokemon.hp / pokemon.maxHp) * 100 : 0));
  const xp = Math.max(0, pokemon.xp ?? 0);
  const xpNeeded = Math.max(1, pokemon.xpNeeded ?? 100);
  const levelProgress = Math.min(100, Math.round((xp / xpNeeded) * 100));
  return (
    <div className={`battle-hud battle-hud-${side}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-display text-lg font-bold">{pokemon.displayName}</span>
        <span className="battle-level-label">Lv. {pokemon.level}</span>
      </div>
      <div
        className="battle-level-track"
        role="progressbar"
        aria-label={`${pokemon.displayName} experience to next level`}
        aria-valuemin={0}
        aria-valuemax={xpNeeded}
        aria-valuenow={Math.min(xp, xpNeeded)}
        title={`${xp}/${xpNeeded} XP`}
      >
        <span style={{ width: `${levelProgress}%` }} />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50">
        <div
          className={`battle-hp-fill h-full rounded-full ${hp < 25 ? "bg-rose-400" : hp < 55 ? "bg-amber-300" : "bg-emerald-300"}`}
          style={{ width: `${hp}%` }}
          role="progressbar"
          aria-label={`${pokemon.displayName} HP`}
          aria-valuemin={0}
          aria-valuemax={pokemon.maxHp}
          aria-valuenow={Math.max(0, pokemon.hp)}
        />
      </div>
      <div className="mt-1 flex items-center justify-between font-mono-ui text-[10px] text-slate-300">
        <span>{trainer?.name}</span>
        <span>
          {pokemon.hp}/{pokemon.maxHp} HP
        </span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`battle-tab ${active ? "battle-tab-active" : ""}`}
      aria-pressed={active}
    >
      {icon}
      {children}
    </button>
  );
}

function BattleThumbnail({
  pokemon,
  side = "foe",
  className = "",
  alt = "",
}: {
  pokemon: BattlePokemon;
  side?: "me" | "foe";
  className?: string;
  alt?: string;
}) {
  const sources = animatedPokemonUrls(pokemon, side);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(
    () => setSourceIndex(0),
    [pokemon.id, pokemon.pokedexId, pokemon.name, pokemon.shiny, side],
  );
  const source = sources[Math.min(sourceIndex, sources.length - 1)] ?? "";
  return (
    <img
      className={className}
      src={source}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={(event) => {
        event.currentTarget.style.visibility = "visible";
      }}
      onError={(event) => {
        if (sourceIndex < sources.length - 1) setSourceIndex(sourceIndex + 1);
        else event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

function SwitchButton({
  pokemon,
  active,
  disabled,
  onClick,
}: {
  pokemon: BattlePokemon;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`battle-switch-button ${active ? "battle-switch-active" : ""} ${pokemon.hp <= 0 ? "battle-switch-fainted" : ""}`}
    >
      <BattleThumbnail pokemon={pokemon} className="battle-switch-sprite" alt="" />
      <span className="min-w-0 text-left">
        <span className="block truncate font-display text-sm font-bold">{pokemon.displayName}</span>
        <span className="font-mono-ui text-[9px] text-slate-400">
          {pokemon.hp > 0 ? `${pokemon.hp}/${pokemon.maxHp} HP` : "FAINTED"}
        </span>
      </span>
    </button>
  );
}

function PartyDot({ pokemon, active }: { pokemon: BattlePokemon | null; active: boolean }) {
  if (!pokemon)
    return (
      <div className="battle-party-dot battle-party-empty" aria-label="Empty party slot">
        <span>＋</span>
      </div>
    );
  return (
    <div
      className={`battle-party-dot ${active ? "battle-party-active" : ""} ${pokemon.hp <= 0 ? "battle-party-fainted" : ""}`}
      title={`${pokemon.displayName}: ${pokemon.hp}/${pokemon.maxHp} HP`}
    >
      <BattleThumbnail
        pokemon={pokemon}
        className="battle-party-sprite"
        alt={pokemon.displayName}
      />
    </div>
  );
}

function RoomState({ icon, text }: { icon: ReactNode; text: string }) {
  const loading = text.startsWith("Loading battle room");
  return (
    <section className={`hof-panel battle-empty ${loading ? "battle-entry-loading" : ""}`}>
      {loading ? (
        <div className="battle-anime-loading" role="status" aria-live="polite">
          <img src="/pokemon-gifs/25.gif" alt="" fetchPriority="high" />
          <div>
            <p className="hof-kicker">AIDORU arena</p>
            <h2>Entering the battle</h2>
            <p>Loading both teams and the arena…</p>
            <span className="battle-entry-progress"><i /></span>
          </div>
        </div>
      ) : (
        <>
          {icon}
          <p className="max-w-md text-sm text-slate-300">{text}</p>
        </>
      )}
    </section>
  );
}

function UsersIcon() {
  return (
    <div className="grid size-9 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10">
      <UserRound className="size-4 text-cyan-200" />
    </div>
  );
}
