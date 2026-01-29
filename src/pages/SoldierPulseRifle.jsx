import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  Clock,
  Crosshair,
  Info,
  Rocket,
  RotateCcw,
  Settings,
  Target,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SUPER_VISOR_ICON =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/8/88/Super_Visor.png";
const SUPER_SERUM_ICON =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/2/21/Super_Serum.png";
const CHAINGUN_ICON =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/5/52/Chaingun.png";
const MAN_ON_RUN_ICON =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/5/5d/Man_On_The_Run.png";
const CRATERED_ICON =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/d/d1/Cratered.png";
const DOUBLE_HELIX_ICON =
  "https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/1d/Double_Helix.png";

const BASE_DAMAGE = 19;
const BASE_RATE = 9;
const BASE_AMMO = 30;
const RELOAD = 1.5;
const ROCKET_INTERVAL = 6;
const ROCKET_CAST = 0.5;
const FIRE_RATE_MAX = 20;
const HALF_SECOND = 0.5;
const SLIDER_INSET_PX = 12;
const CHAINGUN_STACK_PER_SHOT = 0.004;
const CHAINGUN_MAX_STACKS = 100;
const SUPER_SERUM_BASE_RATE = 1.25;
const SUPER_SERUM_ACTIVE_RATE = 1.5;
const SUPER_SERUM_DAMAGE_MULTIPLIER = 0.85;
const TPS = 60;
const SERUM_RELOAD_TIME = 0;

const AMMO_OPTIONS = [
  { label: "+20%", value: 0.2 },
  { label: "+25%", value: 0.25 },
  { label: "+40%", value: 0.4 },
];

const totalChaingunBonus = (bullets) => {
  if (bullets <= 1) return 0;
  const cappedBullets = Math.min(bullets - 1, CHAINGUN_MAX_STACKS);
  const fullRampSum = (cappedBullets * (cappedBullets + 1)) / 2;
  if (bullets - 1 <= CHAINGUN_MAX_STACKS) return fullRampSum;
  const extraBullets = bullets - 1 - CHAINGUN_MAX_STACKS;
  return fullRampSum + extraBullets * CHAINGUN_MAX_STACKS;
};

const totalDamageForBullets = (baseDamage, bullets, chaingunEnabled) => {
  if (bullets <= 0) return 0;
  if (!chaingunEnabled) return baseDamage * bullets;
  const bonusStacks = totalChaingunBonus(bullets);
  const bonusMultiplier = 1 + (CHAINGUN_STACK_PER_SHOT * bonusStacks) / bullets;
  return baseDamage * bullets * bonusMultiplier;
};

export default function SoldierPulseRifle() {
  const [damagePct, setDamagePct] = useState(0);
  const [fireRatePct, setFireRatePct] = useState(0);
  const [abilityPct, setAbilityPct] = useState(0);
  const [activeAmmoMods, setActiveAmmoMods] = useState([]);
  const [chaingunEnabled, setChaingunEnabled] = useState(false);
  const [superSerumActive, setSuperSerumActive] = useState(false);
  const [manOnRunPct, setManOnRunPct] = useState(0);
  const [rocketEnabled, setRocketEnabled] = useState(true);
  const [miniRocket, setMiniRocket] = useState(false);
  const [explosionDmg, setExplosionDmg] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [ammoAccordionOpen, setAmmoAccordionOpen] = useState(true);
  const [rocketAccordionOpen, setRocketAccordionOpen] = useState(true);
  const [superVisorOpen, setSuperVisorOpen] = useState(false);
  const [visualizerOpen, setVisualizerOpen] = useState(true);

  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const totalAmmoBonus = useMemo(
    () => activeAmmoMods.reduce((sum, value) => sum + value, 0),
    [activeAmmoMods],
  );

  const fireRateBreakpoints = useMemo(() => {
    const minRate = BASE_RATE;
    const maxRate = BASE_RATE * (1 + FIRE_RATE_MAX * 0.05);
    const minBullets = Math.floor(minRate * HALF_SECOND) + 1;
    const maxBullets = Math.floor(maxRate * HALF_SECOND) + 1;
    const points = [];

    for (let bullets = minBullets + 1; bullets <= maxBullets; bullets += 1) {
      const requiredRate = (bullets - 1) / HALF_SECOND;
      const pct = (requiredRate / BASE_RATE - 1) / 0.05;
      const percentLabel = Math.round(pct * 5);
      if (pct >= 0 && pct <= FIRE_RATE_MAX) {
        points.push({ bullets, pct, percentLabel });
      }
    }

    return points;
  }, []);

  const simulateCycle = ({
    baseDamage,
    baseRate,
    ammo,
    reloadTime,
    rocketOn,
    chaingunOn,
    superSerumActive,
    abilityPct,
  }) => {
    // Determine phases
    // If Serum Active:
    //   Phase 1: Mag 1, Passive Rate (1.25x), Normal Dmg
    //   Event: Serum Reload (Instant)
    //   Phase 2: Mag 2, Active Rate (1.25 * 1.5x), Dmg Penalty (0.85x)
    // If Serum Inactive:
    //   Phase 1: Mag 1, Normal Rate, Normal Dmg

    const timeline = [];
    let currentTime = 0;
    let cumulativeDamage = 0;
    let currentChaingunStacks = 0;

    // Initial Reload (Start of cycle visualization)
    const reloadFrames = reloadTime * TPS;
    timeline.push({
      type: "reload",
      start: currentTime,
      duration: reloadFrames,
      label: "Reload",
    });
    currentTime += reloadFrames;

    // Helix Rocket
    let finalRocketDmg = 0;
    if (rocketOn) {
      const rocketFrames = ROCKET_CAST * TPS;

      let baseRocketDmg = 120;
      if (miniRocket && explosionDmg) baseRocketDmg = 187.2;
      else if (miniRocket) baseRocketDmg = 171.6;
      else if (explosionDmg) baseRocketDmg = 144;

      finalRocketDmg = baseRocketDmg * (1 + abilityPct * 0.05);

      timeline.push({
        type: "rocket",
        start: currentTime,
        duration: rocketFrames,
        label: "Helix",
        damage: finalRocketDmg,
        baseDamage: baseRocketDmg,
        mods: {
          miniRocket,
          explosionDmg,
          abilityPct,
        },
      });

      currentTime += rocketFrames;
    }

    // Firing Sequence
    const magazines = superSerumActive ? 2 : 1;
    let totalBulletDamage = 0;
    let totalFireTimeSeconds = 0;
    let totalReloadTimeSeconds = 0;

    // For Burst Calculation (High Water Mark)
    let bestBurstWindowDmg = 0;

    for (let mag = 0; mag < magazines; mag++) {
      // Phase Stats
      let phaseRate = baseRate;
      let phaseDamageMult = 1.0;

      if (superSerumActive) {
        if (mag === 0) {
          // Phase 1: Passive Rate only (+25%)
          phaseRate = baseRate * SUPER_SERUM_BASE_RATE;
        } else {
          // Phase 2: Passive + Active Rate, Damage Penalty
          phaseRate =
            baseRate * SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE;
          phaseDamageMult = SUPER_SERUM_DAMAGE_MULTIPLIER;
        }
      }

      const intervalFrames = TPS / phaseRate;

      // Special Event: Serum Refill between mags
      if (mag > 0) {
        currentTime += SERUM_RELOAD_TIME * TPS;
      }

      for (let i = 0; i < ammo; i++) {
        // Chaingun Stacking
        let effectiveStack = 0;
        if (chaingunOn) {
          effectiveStack = Math.min(currentChaingunStacks, CHAINGUN_MAX_STACKS);
          currentChaingunStacks++;
        }

        const chaingunMult = 1 + effectiveStack * CHAINGUN_STACK_PER_SHOT;
        const bulletDmg = baseDamage * phaseDamageMult * chaingunMult;

        cumulativeDamage += bulletDmg;
        totalBulletDamage += bulletDmg;

        const serumTrigger = superSerumActive && mag === 0 && i === ammo - 1;
        const serumActiveBullet = superSerumActive && mag === 1;
        timeline.push({
          type: "fire",
          start: currentTime,
          duration: 0,
          bulletIndex: mag * ammo + i + 1,
          damage: bulletDmg,
          cumulative: cumulativeDamage,
          showLabel:
            (mag * ammo + i + 1) % 10 === 0 ||
            (mag === magazines - 1 && i === ammo - 1) ||
            serumTrigger,
          serumTrigger,
          serumActiveBullet,
        });

        // Track Burst (0.5s window approx)
        // Simple heuristic: Rate * 0.5s * current Avg Dmg
        const bulletsInHalfSec = phaseRate * 0.5;
        // Accurate burst: sum of next N bullets.
        // For simplicity/perf in this loop, we calculate "Instant Burst DPS" potential
        // But the requirements ask for specific 1s Burst (Rocket + 0.5s stream).
        // We will calculate that derived from the 'Best Phase' stats.

        if (i < ammo - 1) currentTime += intervalFrames;
      }

      totalFireTimeSeconds += ammo / phaseRate;
      if (mag < magazines - 1) {
        totalReloadTimeSeconds += superSerumActive
          ? SERUM_RELOAD_TIME
          : reloadTime;
      }
    }

    totalReloadTimeSeconds += reloadTime;
    const totalTime = currentTime / TPS;
    const sustainedDps =
      totalBulletDamage / (totalFireTimeSeconds + totalReloadTimeSeconds);

    // Burst Calculation: Use the stats from the "Strongest" phase (Active if Serum is on)
    let burstRate = baseRate;
    let burstDmgMult = 1.0;

    if (superSerumActive) {
      burstRate = baseRate * SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE;
      burstDmgMult = SUPER_SERUM_DAMAGE_MULTIPLIER;
    }

    // Auto-aim bullets in 0.5s
    const bulletsInWindow = burstRate * 0.5;
    const autoAimBullets = Math.floor(bulletsInWindow + 1e-9) + 1;

    // Calculate damage for these specific bullets assuming max chaingun ramp if applicable?
    // Usually burst implies "Best Case". If Chaingun is on, user likely pre-ramps or we calculate from 0.
    // The previous code calculated from 0 stacks. We will stick to that or use the simulation?
    // Previous code: totalDamageForBullets(baseDamage, autoAimBullets, chaingunEnabled)
    // We should apply the burstDmgMult to the base damage.

    const burstBulletDmg = totalDamageForBullets(
      baseDamage * burstDmgMult,
      autoAimBullets,
      chaingunOn,
    );
    const totalBurst = finalRocketDmg + burstBulletDmg;

    // Effective Rate for display (Max active rate)
    const effectiveRate = superSerumActive
      ? baseRate * SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE
      : baseRate;
    const effectiveDamagePerShot =
      baseDamage * (superSerumActive ? SUPER_SERUM_DAMAGE_MULTIPLIER : 1);

    return {
      timeline,
      totalTimeSeconds: totalTime,
      sustainedDps,
      totalBurst,
      finalRocketDmg,
      autoAimBullets,
      bulletBurstDmg: burstBulletDmg,

      // Display stats
      displayRate: effectiveRate,
      displayDamage: effectiveDamagePerShot,
      totalAmmo: ammo * magazines, // Total rounds fired in sequence
      magSize: ammo,
    };
  };

  // Base Stats (Standard Soldier, No Serum)
  const baseStats = useMemo(
    () =>
      simulateCycle({
        baseDamage: BASE_DAMAGE,
        baseRate: BASE_RATE,
        ammo: BASE_AMMO,
        reloadTime: RELOAD,
        rocketOn: true,
        chaingunOn: false,
        superSerumActive: false,
        abilityPct: 0,
      }),
    [],
  );

  // Current Stats
  const currentStats = useMemo(() => {
    // Pre-calculate base modifiers for the simulation input
    // Note: We do NOT apply Serum multipliers here, the simulation handles phases.
    const inputBaseDamage = BASE_DAMAGE * (1 + damagePct * 0.05);
    const inputBaseRate = BASE_RATE * (1 + fireRatePct * 0.05);
    const ammoSize = Math.floor(
      BASE_AMMO * (1 + totalAmmoBonus) * (1 + manOnRunPct / 100),
    );

    return simulateCycle({
      baseDamage: inputBaseDamage,
      baseRate: inputBaseRate,
      ammo: ammoSize,
      reloadTime: RELOAD,
      rocketOn: rocketEnabled,
      chaingunOn: chaingunEnabled,
      superSerumActive: superSerumActive,
      abilityPct: abilityPct,
    });
  }, [
    damagePct,
    fireRatePct,
    abilityPct,
    totalAmmoBonus,
    manOnRunPct,
    chaingunEnabled,
    superSerumActive,
    rocketEnabled,
    miniRocket,
    explosionDmg,
  ]);

  const maxDuration = Math.max(
    baseStats.totalTimeSeconds,
    currentStats.totalTimeSeconds,
  );

  // Derived computed values for UI binding
  const computed = {
    totalBurst: currentStats.totalBurst,
    combinedSustainedDps: currentStats.sustainedDps,
    damage: currentStats.displayDamage, // Display effective damage (penalized if serum active)
    rate: currentStats.displayRate, // Display effective rate (boosted if serum active)
    finalRocketDmg: currentStats.finalRocketDmg,
    bulletsHitInHalfSec: currentStats.displayRate * 0.5,
    autoAimBullets: currentStats.autoAimBullets,
    nextBulletRate: currentStats.autoAimBullets / 0.5, // Approx
    rateToNextBullet: 0, // Simplified out for now
    maxRate:
      BASE_RATE *
      (1 + FIRE_RATE_MAX * 0.05) *
      (superSerumActive ? SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE : 1),
    bulletBurstDmg: currentStats.bulletBurstDmg,
    ammo: currentStats.magSize, // Show Mag Size (not total fired) in summary
  };

  const handleWheel = (e) => {
    if (e.deltaY !== 0) {
      const zoomDelta = e.deltaY * -0.001;
      setZoomLevel((prev) => Math.min(Math.max(prev + zoomDelta, 1), 5));
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const toggleAmmo = (value) => {
    setActiveAmmoMods((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const clearAmmo = () => setActiveAmmoMods([]);
  const baseAmmoActive = activeAmmoMods.length === 0;

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-700">
            <div className="flex items-center space-x-3">
              <Rocket className="w-8 h-8 text-orange-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Soldier: 76 - Heavy Pulse Rifle
                </h1>
                <p className="text-slate-400 text-sm">
                  Visualizing weapon cycle mechanics and damage output
                </p>
              </div>
            </div>
            <a
              href="#/"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to landing
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Controls Panel */}
            <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 space-y-6 h-fit">
              <div className="flex items-center space-x-2 text-lg font-semibold text-blue-400">
                <Settings className="w-5 h-5" />
                <h2>Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Damage Slider */}
                <div>
                  <div className="flex justify-between mb-1 items-end">
                    <div>
                      <label className="text-xs font-medium block text-slate-400 uppercase">
                        Weapon Power
                      </label>
                      <span className="text-xs text-blue-400 font-bold">
                        +{damagePct * 5}%
                      </span>
                    </div>
                    <span className="flex items-baseline gap-2">
                      <span className="text-white font-mono font-bold text-lg">
                        {computed.damage.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        dmg
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={damagePct}
                    onChange={(e) => setDamagePct(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500"
                  />
                </div>

                {/* Attack Speed Slider */}
                <div>
                  <div className="flex justify-between mb-3 items-end">
                    <div>
                      <label className="text-xs font-medium block text-slate-400 uppercase">
                        Attack Speed
                      </label>
                      <span className="text-xs text-blue-400 font-bold">
                        +{fireRatePct * 5}%
                      </span>
                    </div>
                    <span className="flex items-baseline gap-2">
                      <span className="text-white font-mono font-bold text-lg">
                        {computed.rate.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        s/s
                      </span>
                    </span>
                  </div>

                  <div className="relative mb-8 group">
                    <input
                      type="range"
                      min="0"
                      max={FIRE_RATE_MAX}
                      value={fireRatePct}
                      onChange={(e) => setFireRatePct(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500 cursor-pointer relative z-10"
                    />
                    {/* Breakpoints Visualization */}
                    <div className="absolute top-3 left-[12px] right-[12px] h-4 pointer-events-none">
                      {fireRateBreakpoints.map((point) => (
                        <div
                          key={point.bullets}
                          className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                          style={{
                            left: `${(point.pct / FIRE_RATE_MAX) * 100}%`,
                          }}
                        >
                          <div className="w-px h-2 bg-slate-600 mb-1"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Super Visor Toggle */}
                <div className="bg-slate-900/30 rounded border border-slate-700/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSuperVisorOpen((prev) => !prev)}
                    className="w-full p-2 flex items-start gap-3 text-left"
                  >
                    <img
                      src={SUPER_VISOR_ICON}
                      alt="Super Visor"
                      className="h-5 w-5 rounded-full border border-slate-700 bg-slate-900/70 p-[1px] shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                          Super Visor
                        </span>
                        <span className="text-[10px] text-blue-300 font-mono">
                          {computed.autoAimBullets} bullets
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-3 w-3 text-slate-500 transition-transform ${superVisorOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`px-2 pb-2 text-[10px] text-slate-400 leading-relaxed transition-[max-height,opacity] duration-500 overflow-hidden ${
                      superVisorOpen
                        ? "max-h-24 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    At {fireRatePct * 5}% attack speed, you fire{" "}
                    {computed.autoAimBullets} bullets during the 0.5s auto-aim
                    window.
                  </div>
                </div>

                {/* Ammo Accordion */}
                <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAmmoAccordionOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-blue-300">
                        Ammo & Special
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${ammoAccordionOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`px-3 pb-3 space-y-3 transition-all overflow-hidden ${
                      ammoAccordionOpen
                        ? "max-h-[1200px] opacity-100"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    {/* Ammo Options */}
                    <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
                      <label className="block text-[10px] font-bold mb-2 text-slate-500 uppercase">
                        Ammo Mods
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={clearAmmo}
                          className={`ammo-btn p-2 rounded text-xs border transition-all ${
                            baseAmmoActive
                              ? "bg-blue-600 border-transparent"
                              : "bg-slate-700 border-transparent hover:border-blue-500"
                          }`}
                        >
                          Base
                        </button>
                        {AMMO_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleAmmo(option.value)}
                            className={`ammo-btn p-2 rounded text-xs border transition-all ${
                              activeAmmoMods.includes(option.value)
                                ? "bg-blue-600 border-blue-400"
                                : "bg-slate-700 border-transparent hover:border-blue-500"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Serum */}
                    <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                        <img
                          src={SUPER_SERUM_ICON}
                          alt="Super Serum"
                          className="h-4 w-4 rounded-full border border-slate-700 bg-slate-900/70 p-[1px]"
                        />
                        Super Serum
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={superSerumActive}
                          onChange={(e) =>
                            setSuperSerumActive(e.target.checked)
                          }
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {/* Chaingun */}
                    <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                        <img
                          src={CHAINGUN_ICON}
                          alt="Chaingun"
                          className="h-5 w-5 rounded-md border border-slate-700 bg-slate-900/70 p-[2px]"
                        />
                        Chaingun
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={chaingunEnabled}
                          onChange={(e) => setChaingunEnabled(e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>

                    {/* Man on Run */}
                    <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
                      <div className="flex justify-between mb-1 items-end">
                        <label className="text-xs font-medium block text-slate-400 uppercase flex items-center gap-2">
                          <img
                            src={MAN_ON_RUN_ICON}
                            alt="Man on the Run"
                            className="h-4 w-4 rounded-md border border-slate-700 bg-slate-900/70 p-[2px]"
                          />
                          Run ({manOnRunPct}%)
                        </label>
                        <span className="text-white font-mono font-bold text-xs">
                          {Math.round(
                            BASE_AMMO *
                              (1 + totalAmmoBonus) *
                              (1 + manOnRunPct / 100),
                          )}{" "}
                          ammo
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={manOnRunPct}
                        onChange={(e) => setManOnRunPct(Number(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Rocket Accordion */}
                <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setRocketAccordionOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-orange-400">
                        Helix Rocket
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${rocketAccordionOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  <div
                    className={`px-3 pb-3 space-y-3 transition-all overflow-hidden ${
                      rocketAccordionOpen
                        ? "max-h-[800px] opacity-100"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300">
                          Enable
                        </label>
                        <label
                          className="relative inline-flex items-center cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={rocketEnabled}
                            onChange={(e) => setRocketEnabled(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 items-end">
                          <label className="text-xs font-medium block text-slate-400 uppercase">
                            Power (+{abilityPct * 5}%)
                          </label>
                          <span className="text-white font-mono font-bold text-xs">
                            {computed.finalRocketDmg.toFixed(1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={abilityPct}
                          onChange={(e) =>
                            setAbilityPct(Number(e.target.value))
                          }
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-orange-500"
                        />
                      </div>
                    </div>
                    {/* Rocket Mods */}
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-900/40 rounded-xl border border-slate-700 p-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-800/60" onClick={() => setMiniRocket(!miniRocket)}>
                         <img src={DOUBLE_HELIX_ICON} className="h-5 w-5" />
                         <span className={`text-[9px] font-bold ${miniRocket ? "text-orange-400" : "text-slate-500"}`}>Double</span>
                      </div>
                      <div className="flex-1 bg-slate-900/40 rounded-xl border border-slate-700 p-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-800/60" onClick={() => setExplosionDmg(!explosionDmg)}>
                         <img src={CRATERED_ICON} className="h-5 w-5" />
                         <span className={`text-[9px] font-bold ${explosionDmg ? "text-orange-400" : "text-slate-500"}`}>Radius</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Burst Card */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Zap className="w-24 h-24 text-orange-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                        1s Burst Damage
                      </span>
                    </div>
                    <div className="text-5xl font-black text-white tracking-tight">
                      {Math.round(computed.totalBurst)}
                    </div>
                    <div className="text-xs text-orange-400/80 font-mono mt-1">
                      (Helix + {computed.autoAimBullets} Bullets)
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-4 text-xs text-slate-500">
                     <div>
                       <span className="block text-slate-400 font-bold">Ref:</span>
                       Rocket + 0.5s Stream
                     </div>
                  </div>
                </div>

                {/* Sustained Card */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Crosshair className="w-24 h-24 text-green-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                        <Crosshair className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                        Sustained DPS
                      </span>
                    </div>
                    <div className="text-5xl font-black text-white tracking-tight">
                      {Math.round(computed.combinedSustainedDps)}
                    </div>
                    <div className="text-xs text-green-400/80 font-mono mt-1">
                      (Over full cycle)
                    </div>
                  </div>
                   <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-4 text-xs text-slate-500">
                     <div>
                       <span className="block text-slate-400 font-bold">Ref:</span>
                       Continuous Fire + Reload
                     </div>
                  </div>
                </div>
              </div>

              {/* Mechanics Breakdown (New) */}
               <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-700">
                   <Info className="w-4 h-4 text-slate-400" />
                   <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Mechanics Breakdown</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Mag Size</div>
                    <div className="text-lg font-bold text-white">{computed.ammo}</div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Rocket CD</div>
                     <div className="text-lg font-bold text-white">{ROCKET_INTERVAL}s</div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Reload</div>
                     <div className="text-lg font-bold text-white">{RELOAD}s</div>
                  </div>
                   <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Time</div>
                     <div className="text-lg font-bold text-white">{currentStats.totalTimeSeconds.toFixed(1)}s</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`bg-slate-800 border-t-4 border-slate-950 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 relative ${visualizerOpen ? "h-[35vh] min-h-[240px]" : "h-auto"}`}
      >
        <button
          type="button"
          onClick={() => setVisualizerOpen((prev) => !prev)}
          className="px-6 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0 text-left"
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-400" />
            Cycle Visualizer
          </h3>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex space-x-4 text-xs font-normal bg-slate-800 p-2 rounded-lg border border-slate-700">
              <LegendItem color="bg-red-500" label="Reload" />
              <LegendItem color="bg-orange-500" label="Helix" />
              <LegendItem color="bg-emerald-400" label="Fire" />
            </div>

            <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
              <ZoomOut className="w-3 h-3 text-slate-400" />
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <ZoomIn className="w-3 h-3 text-slate-400" />
              <span className="text-xs font-mono text-emerald-400 w-8 text-right">
                {zoomLevel.toFixed(1)}x
              </span>
            </div>
            <div className="text-xs text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700 font-mono hidden md:block">
              Scale: {maxDuration.toFixed(2)}s
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${visualizerOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        <div
          className={`flex-1 bg-slate-900 w-full relative overflow-x-auto custom-scrollbar select-none transition-all ${
            visualizerOpen
              ? "max-h-[999px] opacity-100"
              : "max-h-0 opacity-0 pointer-events-none"
          } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        >
          <div
            className="h-full p-4 pr-10 md:p-6 md:pr-12 flex flex-col gap-2 justify-center relative min-w-full"
            style={{ width: `${zoomLevel * 100}%` }}
          >
            <div className="absolute top-0 inset-x-0 h-full w-full pointer-events-none z-0">
              {Array.from({
                length: Math.ceil(maxDuration * (zoomLevel >= 3 ? 2 : 1)) + 1,
              }).map((_, i) => {
                const sec = i / (zoomLevel >= 3 ? 2 : 1);
                if (sec > maxDuration) return null;

                let step = maxDuration > 20 ? 5 : maxDuration > 10 ? 2 : 1;
                if (zoomLevel > 2) step = step / 2;
                if (zoomLevel > 4) step = step / 2;

                if (Math.abs(sec % step) > 0.001) return null;

                return (
                  <div
                    key={sec}
                    className="absolute h-full border-l border-dashed border-slate-800/60"
                    style={{ left: `${(sec / maxDuration) * 100}%` }}
                  />
                );
              })}
            </div>

            <div className="relative w-full h-1/3 min-h-[60px] max-h-[100px] z-10 flex flex-col justify-center group mb-4">
              <div className="flex justify-between items-end mb-1 sticky left-0 px-1 w-full z-20 pointer-events-none">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider bg-slate-900/50 px-2 rounded backdrop-blur-sm shadow-sm">
                  Base Profile
                </span>
              </div>
              <div className="absolute top-0 right-0 h-full w-full pointer-events-none z-30">
                <span className="sticky left-[95%] text-xs font-mono text-slate-400 bg-slate-900/80 px-2 rounded border border-slate-700/50 whitespace-nowrap">
                  {baseStats.totalTimeSeconds.toFixed(2)}s
                </span>
              </div>
              <div className="w-full flex-1 bg-slate-900/80 rounded border border-slate-700 relative overflow-visible group-hover:brightness-110 transition-all">
                <TimelineTrack
                  stats={baseStats}
                  maxTime={maxDuration}
                  fireClass="bg-slate-300/80"
                />
              </div>
            </div>

            <div className="relative w-full h-1/3 min-h-[60px] max-h-[100px] z-10 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-1 sticky left-0 px-1 w-full z-20 pointer-events-none">
                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider bg-slate-900/50 px-2 rounded backdrop-blur-sm shadow-sm">
                  Current Configuration
                </span>
              </div>
              <div className="absolute top-0 right-0 h-full w-full pointer-events-none z-30">
                <span className="sticky left-[95%] text-xs font-mono text-emerald-400 bg-slate-900/80 px-2 rounded border border-emerald-500/30 whitespace-nowrap">
                  {currentStats.totalTimeSeconds.toFixed(2)}s
                </span>
              </div>
              <div className="w-full flex-1 bg-slate-900 rounded border border-emerald-500/30 relative overflow-visible shadow-lg shadow-emerald-900/10">
                <TimelineTrack
                  stats={currentStats}
                  maxTime={maxDuration}
                  fireClass="bg-emerald-400"
                  glowClass={true}
                />
              </div>
            </div>

            <div className="h-6 w-full relative mt-1 select-none pointer-events-none">
              {Array.from({
                length: Math.ceil(maxDuration * (zoomLevel >= 3 ? 2 : 1)) + 1,
              }).map((_, i) => {
                const sec = i / (zoomLevel >= 3 ? 2 : 1);
                if (sec > maxDuration) return null;

                let step = maxDuration > 20 ? 5 : maxDuration > 10 ? 2 : 1;
                if (zoomLevel > 2) step = step / 2;
                if (zoomLevel > 4) step = step / 2;

                if (Math.abs(sec % step) > 0.001) return null;

                return (
                  <div
                    key={sec}
                    className="absolute text-[10px] text-slate-500 -translate-x-1/2 font-mono"
                    style={{ left: `${(sec / maxDuration) * 100}%` }}
                  >
                    {sec}s
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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

function TimelineTrack({ stats, maxTime, fireClass, glowClass }) {
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
        className="absolute inset-0 w-full h-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {stats.timeline.map((event, idx) => {
          const leftPos =
            maxTime > 0 ? (event.start / (maxTime * TPS)) * 100 : 0;
          const width =
            maxTime > 0 ? (event.duration / (maxTime * TPS)) * 100 : 0;

          if (event.type === "fire") {
            const isAlternated = (event.bulletIndex / 10) % 2 === 0;
            const isHovered = tooltip?.idx === idx;
            const isSerumTrigger = event.serumTrigger;
            const isSerumActive = event.serumActiveBullet;
            return (
              <div
                key={idx}
                className={`absolute top-0 h-full flex justify-center ${event.showLabel ? "z-20" : "z-10"} hover:z-30 group`}
                style={{
                  left: `${leftPos}%`,
                  width: "12px",
                  transform: "translateX(-50%)",
                }}
                onMouseEnter={(e) => {
                  setTooltip({
                    idx,
                    x: e.clientX,
                    y: e.clientY,
                    data: event,
                  });
                }}
                onMouseMove={(e) => {
                  setTooltip({
                    idx,
                    x: e.clientX,
                    y: e.clientY,
                    data: event,
                  });
                }}
              >
                <div
                  className={`h-full transition-all ${
                    isSerumTrigger
                      ? "w-[3px] bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.95)]"
                      : isSerumActive
                        ? `w-[2px] bg-violet-300/90 shadow-[0_0_6px_rgba(167,139,250,0.55)]`
                        : `w-[2px] ${fireClass}`
                  } ${glowClass && !isSerumTrigger && !isSerumActive ? `shadow-[0_0_8px_rgba(52,211,153,0.5)]` : ""} ${isHovered ? "scale-y-110 w-[3px] brightness-125" : ""}`}
                />

                {event.showLabel && (
                  <div
                    className={`absolute ${isAlternated ? "bottom-1" : "top-1"} left-1/2 -translate-x-1/2 z-30 text-[9px] font-mono text-slate-100 font-medium pointer-events-none bg-slate-900/90 border border-slate-700/80 rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm`}
                  >
                    <span className="text-slate-400">#</span>
                    {event.bulletIndex} ·{" "}
                    <span
                      className={
                        glowClass ? "text-emerald-400" : "text-slate-300"
                      }
                    >
                      {event.cumulative.toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
            );
          }
          if (event.type === "reload" || event.type === "rocket") {
            const isRocket = event.type === "rocket";
            const isSerum = event.isSerum;

            let bgClass =
              "bg-gradient-to-b from-red-500 to-red-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]";
            if (isRocket)
              bgClass =
                "bg-gradient-to-b from-orange-500 to-orange-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]";
            if (isSerum)
              bgClass =
                "bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(34,211,238,0.5)] border-cyan-300";

            return (
              <div
                key={idx}
                className={`absolute top-0 h-full border-x border-white/10 flex items-center justify-center overflow-hidden transition-all ${bgClass}`}
                style={{
                  left: `${leftPos}%`,
                  width: `${width}%`,
                }}
                onMouseEnter={
                  isRocket
                    ? (e) => {
                        setTooltip({
                          idx,
                          x: e.clientX,
                          y: e.clientY,
                          data: event,
                        });
                      }
                    : undefined
                }
                onMouseMove={
                  isRocket
                    ? (e) => {
                        setTooltip({
                          idx,
                          x: e.clientX,
                          y: e.clientY,
                          data: event,
                        });
                      }
                    : undefined
                }
              >
                {!isSerum && (
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)]"></div>
                )}
                {(width > 0.5 || isSerum) && (
                  <span
                    className={`relative text-[10px] font-black uppercase truncate px-2 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] tracking-wider ${isSerum ? "text-white text-[8px]" : "text-white"}`}
                  >
                    {event.label}
                  </span>
                )}
              </div>
            );
          }

          return null;
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
          const isRocket = tooltip.data.type === "rocket";
          const rocketMods = tooltip.data.mods || {};
          const rocketModLabels = [
            rocketMods.miniRocket ? "Double Helix" : null,
            rocketMods.explosionDmg ? "+40% Radius" : null,
          ].filter(Boolean);
          return createPortal(
            <div
              className="fixed z-[9999] pointer-events-none pb-2"
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <div
                ref={tooltipRef}
                className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl whitespace-nowrap min-w-[100px] relative"
              >
                {isRocket ? (
                  <>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 border-b border-slate-700 pb-1">
                      Helix Rocket
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Damage
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {tooltip.data.damage.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Cast
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {(tooltip.data.duration / TPS).toFixed(3)}s
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Time
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {(tooltip.data.start / TPS).toFixed(3)}s
                      </span>
                    </div>
                    {rocketModLabels.length > 0 && (
                      <div className="mt-1 text-[9px] font-semibold uppercase text-orange-300">
                        {rocketModLabels.join(" · ")}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 border-b border-slate-700 pb-1">
                      Bullet #{tooltip.data.bulletIndex}
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Damage
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {tooltip.data.damage.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Total
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {tooltip.data.cumulative.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Time
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {(tooltip.data.start / TPS).toFixed(3)}s
                      </span>
                    </div>
                    {tooltip.data.serumTrigger && (
                      <div className="mt-1 text-[9px] font-semibold uppercase text-violet-300">
                        Optimal time to activate Serum
                      </div>
                    )}
                    {!tooltip.data.serumTrigger &&
                      tooltip.data.serumActiveBullet && (
                        <div className="mt-1 text-[9px] font-semibold uppercase text-violet-300">
                          Serum active
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>,
            document.body,
          );
        })()}
    </>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center space-x-1.5">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
