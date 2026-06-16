import {
  ArrowLeft,
  Bomb,
  ChevronDown,
  Crosshair,
  HeartPulse,
  RotateCcw,
  Settings,
  Sparkles,
  Swords,
  Target,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TRACER_STADIUM =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/8/8b/Tracer_Stadium.png";

const BASE_BULLET_DAMAGE = 5.75;
const BASE_AMMO = 40;
const BASE_RELOAD = 1;
const BASE_VOLLEY_INTERVAL = 0.05;
const BULLETS_PER_VOLLEY = 2;
const TPS = 60;
const SUPER_SERUM_ACTIVE_RATE_BONUS = 0.5;
const SUPER_SERUM_DAMAGE_MULTIPLIER = 0.85;
const SUPER_SERUM_ACTIVE_DURATION = 5;
const QUICK_MELEE_DAMAGE = 40;
const FLASH_FIST_BONUS = 10;
const QUICK_MELEE_RECOVERY = 0.55;
const RELOAD_CANCEL_MELEE_MIN_RELOAD = 0.75;
const PULSE_BOMB_STICK = 5;
const PULSE_BOMB_EXPLOSION = 350;
const PULSE_BOMB_MIN_EXPLOSION = 70;
const PULSE_BOMB_SELF_MAX = 175;
const PULSE_BOMB_SELF_MIN = 35;
const IMPULSIVE_MULTIPLIER = 0.4;

const AMMO_OPTIONS = [
  { label: "+10%", value: 0.1 },
  { label: "+20%", value: 0.2 },
  { label: "+25%", value: 0.25 },
  { label: "+40%", value: 0.4 },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const frames = (seconds) => seconds * TPS;
const seconds = (frameCount) => frameCount / TPS;
function ToggleRow({ title, description, checked, onChange, tone = "amber" }) {
  const toneClass = checked
    ? tone === "cyan"
      ? "peer-checked:bg-cyan-500"
      : tone === "rose"
        ? "peer-checked:bg-rose-500"
        : tone === "emerald"
          ? "peer-checked:bg-emerald-500"
          : tone === "violet"
            ? "peer-checked:bg-violet-500"
            : "peer-checked:bg-amber-500"
    : "";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-200">
            {title}
          </div>
          {description && (
            <div className="mt-1 text-[10px] leading-snug text-slate-500">
              {description}
            </div>
          )}
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <div
            className={`h-5 w-9 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white ${toneClass}`}
          ></div>
        </label>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, tone = "text-white" }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className={`text-xl font-black ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function FoldableConfigGroup({
  title,
  subtitle,
  icon,
  children,
  tone = "amber",
  open,
  onToggle,
}) {
  const IconComponent = icon;
  const toneClasses = {
    amber: "border-amber-300/20 text-amber-200 bg-amber-400/10",
    cyan: "border-cyan-300/20 text-cyan-200 bg-cyan-400/10",
    rose: "border-rose-300/20 text-rose-200 bg-rose-400/10",
    emerald: "border-emerald-300/20 text-emerald-200 bg-emerald-400/10",
    violet: "border-violet-300/20 text-violet-200 bg-violet-400/10",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/35">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-slate-900/40"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`rounded-lg border p-1.5 ${toneClasses[tone] || toneClasses.amber}`}
          >
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-200">
              {title}
            </div>
            {subtitle && (
              <div className="mt-1 text-[10px] leading-snug text-slate-500">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`space-y-3 overflow-hidden px-3 transition-all ${
          open ? "max-h-[1200px] pb-3 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-3 rounded-full ${color}`}></div>
      <span className="text-slate-300">{label}</span>
    </div>
  );
}

export default function TracerPulsePistols() {
  const [damagePct, setDamagePct] = useState(0);
  const [attackSpeedPct, setAttackSpeedPct] = useState(0);
  const [abilityPct, setAbilityPct] = useState(0);
  const [activeAmmoMods, setActiveAmmoMods] = useState([]);
  const [threeCycles, setThreeCycles] = useState(true);
  const [visualizeFullSerum, setVisualizeFullSerum] = useState(false);
  const [includeMelee, setIncludeMelee] = useState(false);
  const [stickyBomb, setStickyBomb] = useState(true);
  const [bombFalloffPct, setBombFalloffPct] = useState(100);
  const [autoRecallRefresher, setAutoRecallRefresher] = useState(false);
  const [ammoOpen, setAmmoOpen] = useState(true);
  const [visualizerOpen, setVisualizerOpen] = useState(true);
  const [primaryFireOpen, setPrimaryFireOpen] = useState(true);
  const [meleeOpen, setMeleeOpen] = useState(false);
  const [superSerumOpen, setSuperSerumOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [perks, setPerks] = useState({
    flashFist: false,
    quantumClip: false,
    foresight: false,
    markKitsune: false,
    timelapse: true,
    impulsive: false,
    quickloader: false,
    plasmaConverter: false,
    technoleech: false,
    phantasmicFlux: false,
    superSerum: false,
    lumericoDrive: false,
    ironcladPorts: false,
    cybervenom: false,
    siphonGlove: false,
  });

  const scrollContainerRef = useRef(null);

  const setPerk = (key, checked) => {
    setPerks((current) => ({ ...current, [key]: checked }));
  };

  const totalAmmoBonus = useMemo(
    () => activeAmmoMods.reduce((sum, value) => sum + value, 0),
    [activeAmmoMods],
  );

  const statMods = useMemo(() => {
    const weaponBonus =
      (perks.quickloader ? 0.1 : 0) + (perks.phantasmicFlux ? 0.1 : 0);
    const abilityBonus =
      (perks.markKitsune ? 0.1 : 0) +
      (perks.phantasmicFlux ? 0.1 : 0) +
      (perks.lumericoDrive ? 0.15 : 0) +
      (perks.cybervenom ? 0.1 : 0);
    const attackSpeedBonus =
      (perks.quickloader ? 0.1 : 0) +
      (perks.technoleech ? 0.05 : 0) +
      (perks.superSerum ? 0.1 : 0);
    const ammoBonus = perks.quantumClip && threeCycles ? 0.25 : 0;
    const lifesteal =
      (perks.quantumClip && threeCycles ? 0.1 : 0) +
      (perks.plasmaConverter ? 0.1 : 0) +
      (perks.technoleech ? 0.1 : 0) +
      (perks.phantasmicFlux ? 0.15 : 0) +
      (perks.superSerum ? 0.1 : 0);
    const life = (perks.technoleech ? 25 : 0) + (perks.superSerum ? 25 : 0);

    return {
      weaponBonus,
      abilityBonus,
      attackSpeedBonus,
      ammoBonus,
      lifesteal,
      life,
    };
  }, [perks, threeCycles]);

  const weaponPowerMult = 1 + damagePct * 0.05 + statMods.weaponBonus;
  const abilityPowerMult = 1 + abilityPct * 0.05 + statMods.abilityBonus;
  const attackSpeedMult = 1 + attackSpeedPct * 0.05 + statMods.attackSpeedBonus;
  const baseAmmo = Math.floor(
    BASE_AMMO * (1 + totalAmmoBonus + statMods.ammoBonus),
  );
  const baseBulletDamage = BASE_BULLET_DAMAGE * weaponPowerMult;

  const simulate = useCallback(
    ({
      ammo,
      bulletDamage,
      attackSpeedMult,
      abilityPowerMult,
      cycles,
      enableBlink,
      activePerks,
      includeMelee,
      reloadTime,
      stopAfterSerumDuration = false,
      baseProfile = false,
    }) => {
      const timeline = [];
      let currentTime = 0;
      let totalWeaponDamage = 0;
      let totalMeleeDamage = 0;
      let totalMeleeHits = 0;
      let totalTimelapseDamage = 0;
      let totalMarkDamage = 0;
      let totalForesightDamage = 0;
      let totalBullets = 0;
      let totalVolleys = 0;
      let consecutiveHits = 0;
      let timelapseProcs = 0;
      let markReady = false;
      let markConsumed = false;
      let foresightShotsRemaining = 0;
      let quickloaderStacks = 0;
      let normalFireFrames = 0;
      let serumFireFrames = 0;
      let reloadFramesTotal = 0;
      let serumActiveUntil = null;
      let serumWasUsed = false;

      const fireAmmoSegment = (cycleIndex, bulletCount, options = {}) => {
        const { advanceAfterLast = true } = options;
        const volleyCount = Math.ceil(bulletCount / BULLETS_PER_VOLLEY);
        let lastVolleyStart = currentTime;

        for (let volley = 0; volley < volleyCount; volley += 1) {
          const serumActive =
            serumActiveUntil !== null && currentTime <= serumActiveUntil + 1e-9;
          const activeRateMult =
            attackSpeedMult + (serumActive ? SUPER_SERUM_ACTIVE_RATE_BONUS : 0);
          const activeDamageMult = serumActive
            ? SUPER_SERUM_DAMAGE_MULTIPLIER
            : 1;
          const volleyIntervalFrames = frames(
            BASE_VOLLEY_INTERVAL / activeRateMult,
          );
          const bulletsThisVolley = Math.min(
            BULLETS_PER_VOLLEY,
            bulletCount - volley * BULLETS_PER_VOLLEY,
          );
          let volleyDamage = 0;
          let volleyMarkDamage = 0;
          let volleyTimelapseDamage = 0;
          let volleyForesightDamage = 0;
          const bulletStart = totalBullets + 1;
          const bulletEnd = totalBullets + bulletsThisVolley;
          lastVolleyStart = currentTime;

          for (let bullet = 0; bullet < bulletsThisVolley; bullet += 1) {
            totalBullets += 1;
            consecutiveHits += 1;
            const shotDamage = bulletDamage * activeDamageMult;
            totalWeaponDamage += shotDamage;
            volleyDamage += shotDamage;

            if (foresightShotsRemaining > 0) {
              totalForesightDamage += shotDamage;
              volleyForesightDamage += shotDamage;
              foresightShotsRemaining -= 1;
            }

            if (activePerks.markKitsune && markReady && !markConsumed) {
              const markDamage = 25 * abilityPowerMult;
              totalMarkDamage += markDamage;
              volleyMarkDamage += markDamage;
              markReady = false;
              markConsumed = true;
            }

            if (
              activePerks.timelapse &&
              consecutiveHits >= 4 &&
              consecutiveHits % 2 === 0
            ) {
              const procDamage = 1 * weaponPowerMult;
              totalTimelapseDamage += procDamage;
              volleyTimelapseDamage += procDamage;
              timelapseProcs += 1;
            }

            if (activePerks.quickloader) {
              quickloaderStacks = Math.min(30, quickloaderStacks + 1);
            }
          }

          totalVolleys += 1;
          const event = {
            type: "fire",
            start: currentTime,
            duration: 0,
            label: "Fire",
            cycleIndex,
            volleyIndex: totalVolleys,
            bulletStart,
            bulletEnd,
            bullets: bulletsThisVolley,
            damage: volleyDamage,
            cumulative:
              totalWeaponDamage +
              totalTimelapseDamage +
              totalMarkDamage +
              totalMeleeDamage,
            serumActive,
            foresightDamage: volleyForesightDamage,
            foresightProc: volleyForesightDamage > 0,
            markDamage: volleyMarkDamage,
            markProc: volleyMarkDamage > 0,
            timelapseDamage: volleyTimelapseDamage,
            timelapseProc: volleyTimelapseDamage > 0,
            timelapseProcIndex:
              volleyTimelapseDamage > 0 ? timelapseProcs : null,
            quickloaderStacks,
            forceLabel: totalVolleys === 1 || volley === volleyCount - 1,
          };
          timeline.push(event);

          if (volley < volleyCount - 1 || advanceAfterLast) {
            currentTime += volleyIntervalFrames;
          }

          if (serumActive) serumFireFrames += volleyIntervalFrames;
          else normalFireFrames += volleyIntervalFrames;
        }

        return lastVolleyStart;
      };

      const fireMagazine = (cycleIndex) => {
        const lastNormalVolleyStart = fireAmmoSegment(cycleIndex, ammo, {
          advanceAfterLast:
            !activePerks.superSerum || serumWasUsed || baseProfile,
        });

        if (activePerks.superSerum && !serumWasUsed && !baseProfile) {
          serumWasUsed = true;
          serumActiveUntil =
            lastNormalVolleyStart + frames(SUPER_SERUM_ACTIVE_DURATION);
          timeline.push({
            type: "serum",
            start: lastNormalVolleyStart,
            duration: 0,
            label: "Serum",
          });
          currentTime =
            lastNormalVolleyStart +
            frames(
              BASE_VOLLEY_INTERVAL /
                (attackSpeedMult + SUPER_SERUM_ACTIVE_RATE_BONUS),
            );
          fireAmmoSegment(cycleIndex, ammo);
        }
      };

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        const reloadSpeed = activePerks.quickloader
          ? quickloaderStacks / 100
          : 0;
        const effectiveReload = reloadTime / (1 + reloadSpeed);
        const reloadStart = currentTime;
        const reloadDuration = frames(effectiveReload);
        let meleeExtraFrames = 0;

        if (enableBlink) {
          const blinkStart = reloadStart + reloadDuration / 2;
          timeline.push({
            type: "blink",
            start: blinkStart,
            duration: frames(0.05),
            label: "Blink",
            quantumClip: activePerks.quantumClip,
            foresight: activePerks.foresight,
            markKitsune: activePerks.markKitsune,
          });
          if (activePerks.foresight) {
            foresightShotsRemaining = 4;
          }
          if (activePerks.markKitsune) {
            markReady = true;
            markConsumed = false;
          }
        }

        if (includeMelee) {
          const flashFistActive = activePerks.flashFist && enableBlink;
          const meleeDamage = flashFistActive
            ? QUICK_MELEE_DAMAGE * weaponPowerMult * abilityPowerMult +
              FLASH_FIST_BONUS * abilityPowerMult
            : QUICK_MELEE_DAMAGE * weaponPowerMult;
          let meleeMarkDamage = 0;
          if (activePerks.markKitsune && markReady && !markConsumed) {
            meleeMarkDamage = 25 * abilityPowerMult;
            totalMarkDamage += meleeMarkDamage;
            markReady = false;
            markConsumed = true;
          }
          const meleeRecoveryFrames = frames(QUICK_MELEE_RECOVERY);
          const meleeStartOffset = Math.max(
            frames(RELOAD_CANCEL_MELEE_MIN_RELOAD),
            reloadDuration - meleeRecoveryFrames,
          );
          meleeExtraFrames = Math.max(
            0,
            meleeStartOffset + meleeRecoveryFrames - reloadDuration,
          );
          totalMeleeDamage += meleeDamage;
          totalMeleeHits += 1;
          timeline.push({
            type: "melee",
            start: reloadStart + meleeStartOffset,
            duration: meleeRecoveryFrames,
            label: "Melee",
            cycleIndex: cycle,
            damage: meleeDamage,
            markDamage: meleeMarkDamage,
            markProc: meleeMarkDamage > 0,
            flashFist: flashFistActive,
            reloadCancel: true,
            minReloadTime: frames(RELOAD_CANCEL_MELEE_MIN_RELOAD),
            extraDowntime: meleeExtraFrames,
          });
        }

        timeline.push({
          type: "reload",
          start: reloadStart,
          duration: reloadDuration + meleeExtraFrames,
          label: "Reload",
          quickloaderStacks,
          reloadSpeed,
          meleeExtra: meleeExtraFrames,
        });

        currentTime += reloadDuration + meleeExtraFrames;
        reloadFramesTotal += reloadDuration + meleeExtraFrames;
        quickloaderStacks = 0;

        fireMagazine(cycle);

        const serumDurationComplete =
          stopAfterSerumDuration &&
          serumWasUsed &&
          serumActiveUntil !== null &&
          currentTime > serumActiveUntil;
        if (serumDurationComplete) {
          break;
        }
      }

      const totalDamage =
        totalWeaponDamage +
        totalTimelapseDamage +
        totalMarkDamage +
        totalForesightDamage +
        totalMeleeDamage;
      const totalTimeSeconds = seconds(currentTime);
      const sustainedDps =
        totalTimeSeconds > 0 ? totalDamage / totalTimeSeconds : 0;

      return {
        timeline: timeline.sort((a, b) => a.start - b.start),
        totalTimeSeconds,
        totalDamage,
        totalWeaponDamage,
        totalMeleeDamage,
        totalMeleeHits,
        totalTimelapseDamage,
        totalMarkDamage,
        totalForesightDamage,
        sustainedDps,
        totalBullets,
        totalVolleys,
        magSize: ammo,
        timelapseProcs,
        normalFireSeconds: seconds(normalFireFrames),
        serumFireSeconds: seconds(serumFireFrames),
        reloadSeconds: seconds(reloadFramesTotal),
      };
    },
    [weaponPowerMult],
  );

  const baseCycleCount = threeCycles ? 3 : 1;
  const currentCycleCount =
    perks.superSerum && visualizeFullSerum ? 10 : baseCycleCount;

  const baseStats = useMemo(
    () =>
      simulate({
        ammo: BASE_AMMO,
        bulletDamage: BASE_BULLET_DAMAGE,
        attackSpeedMult: 1,
        abilityPowerMult: 1,
        cycles: baseCycleCount,
        enableBlink: threeCycles,
        activePerks: {
          flashFist: false,
          quantumClip: false,
          foresight: false,
          markKitsune: false,
          timelapse: false,
          quickloader: false,
          superSerum: false,
        },
        includeMelee: false,
        reloadTime: BASE_RELOAD,
        baseProfile: true,
      }),
    [baseCycleCount, simulate, threeCycles],
  );

  const currentStats = useMemo(
    () =>
      simulate({
        ammo: baseAmmo,
        bulletDamage: baseBulletDamage,
        attackSpeedMult,
        abilityPowerMult,
        cycles: currentCycleCount,
        enableBlink: threeCycles,
        activePerks: perks,
        includeMelee,
        reloadTime: BASE_RELOAD,
        stopAfterSerumDuration: perks.superSerum && visualizeFullSerum,
      }),
    [
      abilityPowerMult,
      attackSpeedMult,
      baseAmmo,
      baseBulletDamage,
      currentCycleCount,
      includeMelee,
      perks,
      simulate,
      threeCycles,
      visualizeFullSerum,
    ],
  );

  const burstStats = useMemo(() => {
    const fireEvents = currentStats.timeline.filter(
      (event) => event.type === "fire",
    );
    const damageEvents = currentStats.timeline.filter(
      (event) => event.type === "fire" || event.type === "melee",
    );
    const eventDamage = (event) =>
      event.damage + (event.timelapseDamage || 0) + (event.markDamage || 0);
    const firstDamage = damageEvents[0]?.start ?? 0;
    const damageForWindow = (windowSeconds) =>
      damageEvents.reduce(
        (result, event) => {
          const eventSeconds = seconds(event.start - firstDamage);
          if (eventSeconds >= 0 && eventSeconds < windowSeconds - 1e-9) {
            return {
              damage: result.damage + eventDamage(event),
              bullets: result.bullets + (event.bullets || 0),
            };
          }
          return result;
        },
        { damage: 0, bullets: 0 },
      );
    const damageForFirstMagazine = () => {
      let bullets = 0;
      let damage = 0;
      for (const event of fireEvents) {
        if (bullets >= baseAmmo) break;
        damage += event.damage + event.timelapseDamage + event.markDamage;
        bullets += event.bullets;
      }
      return { damage, bullets };
    };
    const halfSecond = damageForWindow(0.5);
    const fullMag = damageForFirstMagazine();
    const firstCycleProcDamage = damageEvents.reduce(
      (result, event) => {
        if (event.cycleIndex === 0) {
          return {
            foresight: result.foresight + (event.foresightDamage || 0),
            motk: result.motk + (event.markDamage || 0),
            melee: result.melee + (event.type === "melee" ? event.damage : 0),
          };
        }
        return result;
      },
      { foresight: 0, motk: 0, melee: 0 },
    );
    const foresightDamage = perks.foresight
      ? firstCycleProcDamage.foresight
      : 0;
    const motkDamage = perks.markKitsune ? firstCycleProcDamage.motk : 0;
    const meleeDamage = includeMelee ? firstCycleProcDamage.melee : 0;
    const guaranteedForesight = foresightDamage + motkDamage + meleeDamage;
    const guaranteedPctOfHalfSecond =
      halfSecond.damage > 0 ? (guaranteedForesight / halfSecond.damage) * 100 : 0;

    return {
      halfSecondBullets: halfSecond.bullets,
      fullMagBullets: fullMag.bullets,
      halfSecondDamage: halfSecond.damage,
      fullMagDamage: fullMag.damage,
      foresightDamage,
      motkDamage,
      meleeDamage,
      guaranteedForesight,
      guaranteedPctOfHalfSecond,
    };
  }, [
    baseAmmo,
    currentStats.timeline,
    includeMelee,
    perks.foresight,
    perks.markKitsune,
  ]);

  const pulseBomb = useMemo(() => {
    const falloff = clamp(bombFalloffPct / 100, 0, 1);
    const explosion = stickyBomb
      ? PULSE_BOMB_EXPLOSION
      : PULSE_BOMB_MIN_EXPLOSION +
        (PULSE_BOMB_EXPLOSION - PULSE_BOMB_MIN_EXPLOSION) * falloff;
    const selfDamage =
      PULSE_BOMB_SELF_MIN +
      (PULSE_BOMB_SELF_MAX - PULSE_BOMB_SELF_MIN) * falloff;
    const baseTargetDamage = (stickyBomb ? PULSE_BOMB_STICK : 0) + explosion;
    const finalDamage = baseTargetDamage * abilityPowerMult;
    const chronoDamage = finalDamage * IMPULSIVE_MULTIPLIER;

    return {
      finalDamage,
      chronoDamage,
      selfDamage,
      baseTargetDamage,
    };
  }, [abilityPowerMult, bombFalloffPct, stickyBomb]);

  const ehp = useMemo(() => {
    const lifestealHealing = currentStats.sustainedDps * statMods.lifesteal;
    const siphonHealing =
      perks.siphonGlove && currentStats.totalTimeSeconds > 0
        ? (currentStats.totalMeleeHits * 25) / currentStats.totalTimeSeconds
        : 0;
    const totalHealingBase = lifestealHealing + siphonHealing;
    const healingReduction = perks.cybervenom ? 0.7 : 1;
    const adjustedHealing = totalHealingBase * healingReduction;
    const lumerico = perks.lumericoDrive ? 50 / 3 : 0;
    const ironclad = perks.ironcladPorts ? 25 / 3 : 0;
    const fluxCap = perks.phantasmicFlux ? 50 : 0;

    return {
      lifestealHealing: totalHealingBase, // renamed functionally for UI
      adjustedLifesteal: adjustedHealing,
      lumerico,
      ironclad,
      total: adjustedHealing + lumerico + ironclad,
      fluxCap,
      siphonHealing,
    };
  }, [
    currentStats.sustainedDps,
    currentStats.totalMeleeHits,
    currentStats.totalTimeSeconds,
    perks.cybervenom,
    perks.ironcladPorts,
    perks.lumericoDrive,
    perks.phantasmicFlux,
    perks.siphonGlove,
    statMods.lifesteal,
  ]);

  const maxDuration = Math.max(
    baseStats.totalTimeSeconds,
    currentStats.totalTimeSeconds,
  );
  const baseAmmoActive = activeAmmoMods.length === 0;

  const toggleAmmo = (value) => {
    setActiveAmmoMods((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const handleWheel = (e) => {
    if (e.deltaY !== 0) {
      const zoomDelta = e.deltaY * -0.001;
      setZoomLevel((current) => clamp(current + zoomDelta, 1, 5));
    }
  };

  const handleMouseDown = (e) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-100">
      <div className="pointer-events-none absolute right-0 top-0 z-0 h-full w-full overflow-hidden md:w-2/3 lg:w-1/2">
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
        <img
          src={TRACER_STADIUM}
          alt=""
          className="h-full w-full object-cover object-top opacity-20 grayscale mix-blend-luminosity blur-[2px]"
        />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-3 border-b border-slate-700 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-amber-300" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Tracer - Pulse Pistols
                </h1>
                <p className="text-sm text-slate-400">
                  Volley timing, blink reload cycles, and Stadium perk output
                </p>
              </div>
            </div>
            <a
              href="#/"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-amber-300 hover:text-amber-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to landing
            </a>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <aside className="h-fit space-y-6 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
              <div className="flex items-center gap-2 text-lg font-semibold text-amber-300">
                <Settings className="h-5 w-5" />
                <h2>Configuration</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-1 flex items-end justify-between">
                    <div>
                      <label className="block text-xs font-medium uppercase text-slate-400">
                        Weapon Power
                      </label>
                      <span className="text-xs font-bold text-emerald-400">
                        +{damagePct * 5}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-lg font-bold text-white">
                        {baseBulletDamage.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        damage
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={damagePct}
                    onChange={(e) => setDamagePct(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-end justify-between">
                    <div>
                      <label className="block text-xs font-medium uppercase text-slate-400">
                        Attack Speed
                      </label>
                      <span className="text-xs font-bold text-emerald-400">
                        +{attackSpeedPct * 5}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-lg font-bold text-white">
                        {(40 * attackSpeedMult).toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        bullets/s
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={attackSpeedPct}
                    onChange={(e) => setAttackSpeedPct(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-end justify-between">
                    <label className="text-xs font-medium uppercase text-slate-400">
                      Ability Power
                    </label>
                    <span className="font-mono text-lg font-bold text-white">
                      {(abilityPowerMult * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={abilityPct}
                    onChange={(e) => setAbilityPct(Number(e.target.value))}
                    className="h-2 w-full appearance-none rounded-lg bg-slate-700 accent-cyan-400"
                  />
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900/50">
                  <button
                    type="button"
                    onClick={() => setAmmoOpen((current) => !current)}
                    className="flex w-full items-center justify-between p-3 text-left"
                  >
                    <span className="text-sm font-bold text-amber-200">
                      Ammunition
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${ammoOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`space-y-3 overflow-hidden px-3 pb-3 transition-all ${
                      ammoOpen
                        ? "max-h-[1200px] opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="grid grid-cols-5 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveAmmoMods([])}
                        className={`rounded border p-2 text-xs transition ${
                          baseAmmoActive
                            ? "border-transparent bg-amber-500 text-slate-950"
                            : "border-transparent bg-slate-700 hover:border-amber-400"
                        }`}
                      >
                        Base
                      </button>
                      {AMMO_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleAmmo(option.value)}
                          className={`rounded border p-2 text-xs transition ${
                            activeAmmoMods.includes(option.value)
                              ? "border-amber-300 bg-amber-500 text-slate-950"
                              : "border-transparent bg-slate-700 hover:border-amber-400"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <ToggleRow
                      title="Three Cycle Timeline"
                      description="Shows 3 magazine cycles with Blink during reload for Quantum Clip and Foresight setup."
                      checked={threeCycles}
                      onChange={setThreeCycles}
                    />
                    <ToggleRow
                      title="Quantum Clip"
                      description="Blink while reloading grants +25% Max Ammo and 10% Weapon Lifesteal."
                      checked={perks.quantumClip}
                      onChange={(checked) => setPerk("quantumClip", checked)}
                      tone="cyan"
                    />
                    <ToggleRow
                      title="Underworld Quickloader"
                      description="+10% Weapon Power, +10% Attack Speed. Hits grant reload speed, max 30 stacks."
                      checked={perks.quickloader}
                      onChange={(checked) => setPerk("quickloader", checked)}
                    />
                    <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-400">
                      Current magazine:{" "}
                      <span className="font-mono font-bold text-white">
                        {baseAmmo}
                      </span>
                    </div>
                  </div>
                </div>
                <FoldableConfigGroup
                  title="Primary Fire"
                  subtitle="Blink setup and sequential hit effects for Pulse Pistols."
                  icon={Target}
                  tone="cyan"
                  open={primaryFireOpen}
                  onToggle={() => setPrimaryFireOpen((current) => !current)}
                >
                  <ToggleRow
                    title="Foresight"
                    description="After Blink, next 4 bullets within 2s auto-aim."
                    checked={perks.foresight}
                    onChange={(checked) => setPerk("foresight", checked)}
                    tone="cyan"
                  />
                  <ToggleRow
                    title="Mark of the Kitsune"
                    description="After ability/gadget, next weapon hit adds 25 ability-scaled damage. Also +10% Ability Power."
                    checked={perks.markKitsune}
                    onChange={(checked) => setPerk("markKitsune", checked)}
                    tone="cyan"
                  />
                  <ToggleRow
                    title="Timelapse"
                    description="Sequential hits proc 1 weapon-scaled damage. Full baseline mag produces 19 procs."
                    checked={perks.timelapse}
                    onChange={(checked) => setPerk("timelapse", checked)}
                    tone="cyan"
                  />
                </FoldableConfigGroup>

                <FoldableConfigGroup
                  title="Melee Add-On"
                  subtitle="Optional reload-cancel Quick Melee during reload."
                  icon={Swords}
                  tone="rose"
                  open={meleeOpen}
                  onToggle={() => setMeleeOpen((current) => !current)}
                >
                  <ToggleRow
                    title="Flash Fist"
                    description="Blink-enhanced melee: 40 weapon-scaled damage plus 10 ability-scaled damage."
                    checked={perks.flashFist}
                    onChange={(checked) => setPerk("flashFist", checked)}
                    tone="rose"
                  />
                  <ToggleRow
                    title="Include Quick Melee"
                    description="Triggers during reload and is modeled with optimal overlap."
                    checked={includeMelee}
                    onChange={setIncludeMelee}
                    tone="rose"
                  />
                </FoldableConfigGroup>

                <FoldableConfigGroup
                  title="Super Serum"
                  subtitle="Models optimal activation on the final bullet, then the instant refill and active fire window."
                  icon={Sparkles}
                  tone="violet"
                  open={superSerumOpen}
                  onToggle={() => setSuperSerumOpen((current) => !current)}
                >
                  <ToggleRow
                    title="Enable Super Serum"
                    description="+25 Life, +10% Attack Speed, +10% Lifesteal. Optimally reloads at final bullet, then +50% attack speed and -15% weapon damage for 5s."
                    checked={perks.superSerum}
                    onChange={(checked) => setPerk("superSerum", checked)}
                    tone="emerald"
                  />
                  <ToggleRow
                    title="Visualize Full Serum Duration"
                    description="Extends the current timeline through the clip that contains the last Serum-active bullet."
                    checked={visualizeFullSerum}
                    onChange={setVisualizeFullSerum}
                    tone="violet"
                  />
                </FoldableConfigGroup>
              </div>
            </aside>

            <main className="space-y-6 lg:col-span-2">
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
                  <div className="absolute right-0 top-0 p-3 opacity-10">
                    <Zap className="h-24 w-24 text-amber-300" />
                  </div>
                  <div className="relative z-10">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="rounded-lg bg-amber-400/20 p-2 text-amber-300">
                        <Zap className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                        Burst Damage
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <StatTile
                        label="0.5 Second"
                        value={Math.round(burstStats.halfSecondDamage)}
                        sub={`${burstStats.halfSecondBullets} bullets`}
                        tone="text-amber-200"
                      />
                      <StatTile
                        label="Full Mag"
                        value={Math.round(burstStats.fullMagDamage)}
                        sub={`${burstStats.fullMagBullets} bullets`}
                        tone="text-amber-200"
                      />
                    </div>
                    <div className="mt-4 min-h-[36px] border-t border-slate-700/60 pt-3 text-xs font-mono text-slate-400">
                      <span className="text-slate-300">
                        Foresight{" "}
                        <span className="text-green-300">
                          ({Math.round(burstStats.foresightDamage)})
                        </span>{" "}
                        + MOTK{" "}
                        <span className="text-blue-400">
                          ({Math.round(burstStats.motkDamage)})
                        </span>{" "}
                        + Melee{" "}
                        <span className="text-rose-300">
                          ({Math.round(burstStats.meleeDamage)})
                        </span>{" "}
                        ={" "}
                        <span className="text-white">
                          {Math.round(burstStats.guaranteedForesight)}
                        </span>{" "}
                        ·{" "}
                        <span className="text-amber-200">
                          {burstStats.guaranteedPctOfHalfSecond.toFixed(1)}%
                        </span>{" "}
                        of 0.5s burst.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
                  <div className="absolute right-0 top-0 p-3 opacity-10">
                    <Crosshair className="h-24 w-24 text-emerald-400" />
                  </div>
                  <div className="relative z-10">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="rounded-lg bg-emerald-400/20 p-2 text-emerald-300">
                        <Crosshair className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                        Sustained DPS
                      </span>
                    </div>
                    <div className="text-5xl font-black tracking-tight text-white">
                      {Math.round(currentStats.sustainedDps)}
                    </div>
                    <div className="mt-1 text-xs font-mono text-emerald-300/80">
                      {perks.superSerum && visualizeFullSerum
                        ? "Through the clip containing the final Serum bullet"
                        : threeCycles
                          ? "Over 3 blink reload cycles, including Foresight"
                          : "Over 1 magazine"}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-700/60 pt-4 text-xs">
                      <div>
                        <span className="block font-bold text-slate-400">
                          Weapon Damage
                        </span>
                        {Math.round(currentStats.totalWeaponDamage)}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400">
                          Timelapse
                        </span>
                        {Math.round(currentStats.totalTimelapseDamage)} ·{" "}
                        {currentStats.timelapseProcs} procs{" "}
                        {currentStats.totalDamage > 0 && (
                          <span className="text-fuchsia-300 font-mono">
                            (
                            {(
                              (currentStats.totalTimelapseDamage /
                                currentStats.totalDamage) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400">
                          Normal Fire
                        </span>
                        {currentStats.normalFireSeconds.toFixed(2)}s
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400">
                          Serum Fire
                        </span>
                        {currentStats.serumFireSeconds > 0
                          ? `${currentStats.serumFireSeconds.toFixed(2)}s`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-rose-400/30 bg-gradient-to-br from-rose-500/15 via-slate-800/95 to-slate-800 p-6 shadow-lg shadow-rose-950/20">
                <div className="mb-4 flex flex-col gap-3 border-b border-slate-700/70 pb-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-rose-200">
                    <Bomb className="h-5 w-5" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.18em]">
                      Pulse Bomb
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoRecallRefresher}
                        onChange={(e) =>
                          setAutoRecallRefresher(e.target.checked)
                        }
                        className="accent-rose-400"
                      />
                      Auto-Recall Refresher
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Pulse Bomb"
                    value={Math.round(pulseBomb.finalDamage)}
                    sub={`Self Damage: ${Math.round(pulseBomb.selfDamage)}`}
                    tone="text-rose-100"
                  />
                  <StatTile
                    label="Chrono Bomb"
                    value={Math.round(pulseBomb.chronoDamage)}
                    sub={`Base Target: ${Math.round(pulseBomb.baseTargetDamage)}`}
                    tone="text-rose-100"
                  />
                  <StatTile
                    label="Stuck Sequence"
                    value={Math.round(pulseBomb.finalDamage)}
                    sub={
                      autoRecallRefresher
                        ? "Pulse → Chrono → Pulse → Chrono"
                        : "Pulse → Chrono"
                    }
                    tone="text-rose-100"
                  />
                </div>
              </section>

              <section className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-slate-800/95 to-slate-800 p-6 shadow-lg shadow-emerald-950/20">
                <div className="mb-4 flex flex-col gap-3 border-b border-slate-700/70 pb-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <HeartPulse className="h-5 w-5" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.18em]">
                      Effective HP Gain Per Second
                    </h3>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setPerk("quantumClip", !perks.quantumClip)}
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.quantumClip
                        ? "border-emerald-300 bg-emerald-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    Quantum Clip (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPerk("plasmaConverter", !perks.plasmaConverter)
                    }
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.plasmaConverter
                        ? "border-emerald-300 bg-emerald-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    Plasma Converter (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerk("technoleech", !perks.technoleech)}
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.technoleech
                        ? "border-emerald-300 bg-emerald-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    Technoleech (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPerk("phantasmicFlux", !perks.phantasmicFlux)
                    }
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.phantasmicFlux
                        ? "border-emerald-300 bg-emerald-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    Phantasmic Flux (15%)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPerk("lumericoDrive", !perks.lumericoDrive)
                    }
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.lumericoDrive
                        ? "border-cyan-300 bg-cyan-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-cyan-400"
                    }`}
                  >
                    Lumérico Drive
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPerk("ironcladPorts", !perks.ironcladPorts)
                    }
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.ironcladPorts
                        ? "border-cyan-300 bg-cyan-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-cyan-400"
                    }`}
                  >
                    Ironclad Ports
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerk("cybervenom", !perks.cybervenom)}
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.cybervenom
                        ? "border-rose-300 bg-rose-500 text-white"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-rose-400"
                    }`}
                  >
                    Enemy Cybervenom
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerk("siphonGlove", !perks.siphonGlove)}
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.siphonGlove
                        ? "border-emerald-300 bg-emerald-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    Siphon Glove
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerk("superSerum", !perks.superSerum)}
                    className={`rounded border px-2 py-2 text-left transition ${
                      perks.superSerum
                        ? "border-violet-300 bg-violet-500 text-slate-950"
                        : "border-transparent bg-slate-700 text-slate-300 hover:border-violet-400"
                    }`}
                  >
                    Super Serum (10%)
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <StatTile
                    label="Lifesteal"
                    value={Math.round(ehp.adjustedLifesteal)}
                    sub={
                      perks.cybervenom
                        ? `${Math.round(ehp.lifestealHealing)} before Cybervenom`
                        : `${Math.round(statMods.lifesteal * 100)}% Weapon Lifesteal`
                    }
                    tone="text-emerald-100"
                  />
                  <StatTile
                    label="Siphon Glove"
                    value={
                      ehp.siphonHealing ? ehp.siphonHealing.toFixed(1) : "0"
                    }
                    sub="Flat Melee Healing/s"
                    tone="text-emerald-100"
                  />
                  <StatTile
                    label="Lumérico"
                    value={ehp.lumerico ? ehp.lumerico.toFixed(1) : "0"}
                    sub="Armor/shields per second"
                    tone="text-cyan-100"
                  />
                  <StatTile
                    label="Ironclad"
                    value={ehp.ironclad ? ehp.ironclad.toFixed(1) : "0"}
                    sub="Overhealth per second"
                    tone="text-cyan-100"
                  />
                  <StatTile
                    label="Total eHP/s"
                    value={Math.round(ehp.total)}
                    sub={
                      ehp.fluxCap ? `Flux overhealth cap ${ehp.fluxCap}` : null
                    }
                    tone="text-emerald-100"
                  />
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>

      <section
        className={`relative z-10 flex flex-col border-t-4 border-slate-950 bg-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${visualizerOpen ? "h-[35vh] min-h-[240px]" : "h-auto"}`}
      >
        <button
          type="button"
          onClick={() => setVisualizerOpen((current) => !current)}
          className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-3 text-left"
        >
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <RotateCcw className="h-4 w-4 text-slate-400" />
            Cycle Visualizer
          </h3>
          <div className="flex items-center gap-4">
            <div
              className="hidden rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs font-normal md:flex md:gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <LegendItem color="bg-amber-300" label="Fire" />
              <LegendItem color="bg-red-500" label="Reload" />
              <LegendItem color="bg-cyan-400" label="Blink" />
              <LegendItem color="bg-violet-300" label="Serum" />
              <LegendItem color="bg-rose-500" label="Melee" />
              <LegendItem color="bg-fuchsia-400" label="Proc" />
            </div>
            <div
              className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ZoomOut className="h-3 w-3 text-slate-400" />
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="h-1 w-24 appearance-none rounded-lg bg-slate-700 accent-amber-400"
              />
              <ZoomIn className="h-3 w-3 text-slate-400" />
              <span className="w-8 text-right font-mono text-xs text-amber-300">
                {zoomLevel.toFixed(1)}x
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${visualizerOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        <div
          ref={scrollContainerRef}
          className={`custom-scrollbar relative w-full flex-1 select-none overflow-x-auto bg-slate-900 transition-all ${
            visualizerOpen
              ? "max-h-[999px] opacity-100"
              : "max-h-0 opacity-0 pointer-events-none"
          } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={() => setIsDragging(false)}
          onMouseUp={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        >
          <div
            className="relative flex h-full min-w-full flex-col justify-center gap-2 p-4 pr-10 md:p-6 md:pr-12"
            style={{ width: `${zoomLevel * 100}%` }}
          >
            <TimelineRuler maxDuration={maxDuration} zoomLevel={zoomLevel} />
            <TimelineRow
              label="Base Profile"
              stats={baseStats}
              maxTime={maxDuration}
              tone="text-slate-300"
              fireClass="bg-slate-300/85"
            />
            <TimelineRow
              label="Current Configuration"
              stats={currentStats}
              maxTime={maxDuration}
              tone="text-amber-300"
              fireClass="bg-amber-300"
              glow
            />
            <TimelineLabels maxDuration={maxDuration} zoomLevel={zoomLevel} />
          </div>
        </div>
      </section>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.8);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 1);
        }
      `}</style>
    </div>
  );
}

function TimelineRuler({ maxDuration, zoomLevel }) {
  const step =
    maxDuration > 20 ? 5 : maxDuration > 10 ? 2 : zoomLevel > 3 ? 0.5 : 1;
  const count = Math.ceil(maxDuration / step) + 1;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full">
      {Array.from({ length: count }).map((_, index) => {
        const sec = index * step;
        if (sec > maxDuration) return null;
        return (
          <div
            key={sec}
            className="absolute h-full border-l border-dashed border-slate-800/70"
            style={{ left: `${(sec / maxDuration) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

function TimelineLabels({ maxDuration, zoomLevel }) {
  const step =
    maxDuration > 20 ? 5 : maxDuration > 10 ? 2 : zoomLevel > 3 ? 0.5 : 1;
  const count = Math.ceil(maxDuration / step) + 1;

  return (
    <div className="relative mt-1 h-6 w-full select-none">
      {Array.from({ length: count }).map((_, index) => {
        const sec = index * step;
        if (sec > maxDuration) return null;
        return (
          <div
            key={sec}
            className="absolute -translate-x-1/2 font-mono text-[10px] text-slate-500"
            style={{ left: `${(sec / maxDuration) * 100}%` }}
          >
            {sec}s
          </div>
        );
      })}
    </div>
  );
}

function TimelineRow({ label, stats, maxTime, tone, fireClass, glow = false }) {
  return (
    <div className="relative z-10 mb-4 flex h-1/3 min-h-[60px] max-h-[100px] w-full flex-col justify-center">
      <div className="sticky left-0 z-20 mb-1 flex w-full items-end justify-between px-1 pointer-events-none">
        <span
          className={`rounded bg-slate-900/50 px-2 text-xs font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm ${tone}`}
        >
          {label}
        </span>
      </div>
      <div className="pointer-events-none absolute right-0 top-0 z-30 h-full w-full">
        <span
          className={`sticky left-[95%] whitespace-nowrap rounded border border-slate-700/50 bg-slate-900/80 px-2 font-mono text-xs ${tone}`}
        >
          {stats.totalTimeSeconds.toFixed(2)}s
        </span>
      </div>
      <div className="relative w-full flex-1 overflow-visible rounded border border-slate-700 bg-slate-900/80 transition-all hover:brightness-110">
        <TimelineTrack
          stats={stats}
          maxTime={maxTime}
          fireClass={fireClass}
          glow={glow}
        />
      </div>
    </div>
  );
}

function TimelineTrack({ stats, maxTime, fireClass, glow }) {
  const [tooltip, setTooltip] = useState(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
  const tooltipRef = useRef(null);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    if (rect.width || rect.height) {
      setTooltipSize({ width: rect.width, height: rect.height });
    }
  }, [tooltip]);

  if (!stats) return null;

  return (
    <>
      <div
        className="absolute inset-0 h-full w-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {stats.timeline.map((event, index) => {
          const left = maxTime > 0 ? (seconds(event.start) / maxTime) * 100 : 0;
          const width =
            maxTime > 0 ? (seconds(event.duration) / maxTime) * 100 : 0;

          if (event.type === "fire") {
            const isHovered = tooltip?.index === index;
            const fullHeightEffects = [
              event.serumActive
                ? { className: "bg-violet-300", color: "#c4b5fd" }
                : null,
              event.foresightProc
                ? { className: "bg-green-300", color: "#86efac" }
                : null,
              event.markProc
                ? { className: "bg-blue-600", color: "#2563eb" }
                : null,
            ].filter(Boolean);
            const bodyBackground =
              fullHeightEffects.length > 1
                ? `linear-gradient(to bottom, ${fullHeightEffects
                    .map((effect, effectIndex) => {
                      const start =
                        (effectIndex / fullHeightEffects.length) * 100;
                      const end =
                        ((effectIndex + 1) / fullHeightEffects.length) * 100;
                      return `${effect.color} ${start}% ${end}%`;
                    })
                    .join(", ")})`
                : null;
            const bodyClass =
              fullHeightEffects.length === 1
                ? fullHeightEffects[0].className
                : fullHeightEffects.length === 0
                  ? fireClass
                  : "";
            return (
              <div
                key={`${event.type}-${index}`}
                className="group absolute top-0 z-10 flex h-full justify-center hover:z-30"
                style={{
                  left: `${left}%`,
                  width: "14px",
                  transform: "translateX(-50%)",
                }}
                onMouseEnter={(e) =>
                  setTooltip({ index, x: e.clientX, y: e.clientY, data: event })
                }
                onMouseMove={(e) =>
                  setTooltip({ index, x: e.clientX, y: e.clientY, data: event })
                }
              >
                <div
                  className={`relative h-full transition-all ${
                    fullHeightEffects.length > 0 ? "w-[3px]" : "w-[2px]"
                  } ${bodyClass} ${
                    glow && fullHeightEffects.length === 0
                      ? "shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      : ""
                  } ${
                    fullHeightEffects.length > 0
                      ? "shadow-[0_0_10px_rgba(167,139,250,0.55)]"
                      : ""
                  } ${isHovered ? "w-[4px] scale-y-110 brightness-125" : ""}`}
                  style={
                    bodyBackground ? { background: bodyBackground } : undefined
                  }
                >
                  {event.timelapseProc && (
                    <div className="absolute inset-x-0 top-0 h-[5%] min-h-[2px] bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.9)]" />
                  )}
                </div>
                {event.forceLabel && (
                  <div className="pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-100 shadow-sm">
                    V{event.volleyIndex} ·{" "}
                    <span
                      className={glow ? "text-amber-300" : "text-slate-300"}
                    >
                      {event.cumulative.toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
            );
          }

          let bgClass = "bg-gradient-to-b from-red-500 to-red-600";
          if (event.type === "blink")
            bgClass = "bg-gradient-to-b from-cyan-300 to-cyan-500";
          if (event.type === "serum")
            bgClass = "bg-gradient-to-b from-violet-300 to-violet-500";
          if (event.type === "melee")
            bgClass = "bg-gradient-to-b from-rose-400 to-rose-600";

          const eventWidth =
            event.type === "blink" || event.type === "serum" ? 0.35 : width;
          return (
            <div
              key={`${event.type}-${index}`}
              className={`absolute top-0 flex h-full items-center justify-center overflow-hidden border-x border-white/10 ${bgClass}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(eventWidth, 0.25)}%`,
              }}
              onMouseEnter={(e) =>
                setTooltip({ index, x: e.clientX, y: e.clientY, data: event })
              }
              onMouseMove={(e) =>
                setTooltip({ index, x: e.clientX, y: e.clientY, data: event })
              }
            >
              <span className="relative truncate px-2 text-[10px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {event.label}
              </span>
            </div>
          );
        })}
      </div>

      {tooltip &&
        (() => {
          const tooltipLeft = Math.min(
            Math.max(tooltip.x + 12, 8),
            window.innerWidth - tooltipSize.width - 8,
          );
          const tooltipTop = Math.min(
            Math.max(tooltip.y - tooltipSize.height - 16, 8),
            window.innerHeight - tooltipSize.height - 8,
          );
          return createPortal(
            <div
              className="pointer-events-none fixed z-[9999] pb-2"
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <div
                ref={tooltipRef}
                className="min-w-[140px] whitespace-nowrap rounded-lg border border-slate-600 bg-slate-800 p-2 shadow-xl"
              >
                <TooltipBody event={tooltip.data} />
              </div>
            </div>,
            document.body,
          );
        })()}
    </>
  );
}

function TooltipBody({ event }) {
  if (event.type === "fire") {
    return (
      <>
        <div className="mb-1 border-b border-slate-700 pb-1 text-[10px] font-bold uppercase text-slate-400">
          Volley #{event.volleyIndex}
        </div>
        <TooltipLine
          label="Bullets"
          value={`${event.bulletStart}-${event.bulletEnd}`}
        />
        <TooltipLine label="Damage" value={event.damage.toFixed(2)} strong />
        <TooltipLine
          label="Time"
          value={`${seconds(event.start).toFixed(3)}s`}
        />
        <TooltipLine
          label="Quickloader"
          value={`${event.quickloaderStacks} stacks`}
        />
        {event.timelapseProc && (
          <div className="mt-1 text-[9px] font-semibold uppercase text-fuchsia-300">
            Timelapse #{event.timelapseProcIndex}: +
            {event.timelapseDamage.toFixed(2)}
          </div>
        )}
        {event.foresightProc && (
          <div className="mt-1 text-[9px] font-semibold uppercase text-green-300">
            Foresight auto-aim
          </div>
        )}
        {event.markProc && (
          <div className="mt-1 text-[9px] font-semibold uppercase text-cyan-200">
            Kitsune bonus: +{event.markDamage.toFixed(1)}
          </div>
        )}
        {event.serumActive && (
          <div className="mt-1 text-[9px] font-semibold uppercase text-violet-300">
            Super Serum active
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-1 border-b border-slate-700 pb-1 text-[10px] font-bold uppercase text-slate-400">
        {event.label}
      </div>
      <TooltipLine label="Time" value={`${seconds(event.start).toFixed(3)}s`} />
      {event.duration > 0 && (
        <TooltipLine
          label="Duration"
          value={`${seconds(event.duration).toFixed(3)}s`}
        />
      )}
      {event.type === "reload" && (
        <>
          <TooltipLine
            label="Quickloader"
            value={`${event.quickloaderStacks} stacks`}
          />
          <TooltipLine
            label="Reload Speed"
            value={`${Math.round(event.reloadSpeed * 100)}%`}
          />
          {event.meleeExtra > 0 && (
            <TooltipLine
              label="Melee Extra"
              value={`${seconds(event.meleeExtra).toFixed(2)}s`}
            />
          )}
        </>
      )}
      {event.type === "blink" && (
        <div className="mt-1 text-[9px] font-semibold uppercase text-cyan-300">
          {[
            event.quantumClip ? "Quantum Clip" : null,
            event.foresight ? "Foresight" : null,
            event.markKitsune ? "Kitsune armed" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Blink marker"}
        </div>
      )}
      {event.type === "melee" && (
        <>
          <TooltipLine
            label="Damage"
            value={`${event.damage.toFixed(1)}${event.flashFist ? " Flash Fist" : ""}`}
            strong
          />
          {event.markProc && (
            <TooltipLine
              label="MOTK"
              value={`+${event.markDamage.toFixed(1)}`}
            />
          )}
          {event.reloadCancel && (
            <>
              <TooltipLine label="Timing" value="Reload cancel" />
              <TooltipLine
                label="Recovery"
                value={`${seconds(event.duration).toFixed(2)}s`}
              />
              <TooltipLine
                label="Cancel At"
                value={`${seconds(event.minReloadTime).toFixed(2)}s+`}
              />
              {event.extraDowntime > 0 && (
                <TooltipLine
                  label="Extra Time"
                  value={`${seconds(event.extraDowntime).toFixed(2)}s`}
                />
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function TooltipLine({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[9px] uppercase text-slate-500">{label}</span>
      <span
        className={`font-mono text-xs ${strong ? "font-bold text-white" : "text-slate-300"}`}
      >
        {value}
      </span>
    </div>
  );
}
