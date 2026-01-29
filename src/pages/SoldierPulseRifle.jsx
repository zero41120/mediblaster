import { ArrowLeft, Rocket, RotateCcw, Target, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SUPER_VISOR_ICON = 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/8/88/Super_Visor.png';
const CHAINGUN_ICON = 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/5/52/Chaingun.png';
const MAN_ON_RUN_ICON = 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/5/5d/Man_On_The_Run.png';
const CRATERED_ICON = 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/d/d1/Cratered.png';
const DOUBLE_HELIX_ICON = 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/1d/Double_Helix.png';

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

const AMMO_OPTIONS = [
  { label: '+20%', value: 0.2 },
  { label: '+25%', value: 0.25 },
  { label: '+40%', value: 0.4 }
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

  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const totalAmmoBonus = useMemo(
    () => activeAmmoMods.reduce((sum, value) => sum + value, 0),
    [activeAmmoMods]
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
    abilityPct
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
    timeline.push({ type: 'reload', start: currentTime, duration: reloadFrames, label: 'Reload' });
    currentTime += reloadFrames;

    // Helix Rocket
    let finalRocketDmg = 0;
    if (rocketOn) {
      const rocketFrames = ROCKET_CAST * TPS;
      timeline.push({ type: 'rocket', start: currentTime, duration: rocketFrames, label: 'Helix' });
      
      let baseRocketDmg = 120;
      if (miniRocket && explosionDmg) baseRocketDmg = 187.2;
      else if (miniRocket) baseRocketDmg = 171.6;
      else if (explosionDmg) baseRocketDmg = 144;
      
      finalRocketDmg = baseRocketDmg * (1 + abilityPct * 0.05);
      currentTime += rocketFrames;
    }

    // Firing Sequence
    const magazines = superSerumActive ? 2 : 1;
    let totalBulletDamage = 0;
    
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
          phaseRate = baseRate * SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE;
          phaseDamageMult = SUPER_SERUM_DAMAGE_MULTIPLIER;
        }
      }

      const intervalFrames = TPS / phaseRate;

      // Special Event: Serum Refill between mags
      if (mag > 0) {
        timeline.push({ 
          type: 'reload', 
          start: currentTime, 
          duration: 0.1 * TPS, // Small visual duration 
          label: 'Serum',
          isSerum: true 
        });
        currentTime += 0.1 * TPS;
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

        timeline.push({
          type: 'fire',
          start: currentTime,
          duration: 0,
          bulletIndex: (mag * ammo) + i + 1,
          damage: bulletDmg,
          cumulative: cumulativeDamage,
          showLabel: ((mag * ammo) + i + 1) % 5 === 0 || (mag === magazines - 1 && i === ammo - 1)
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
      
      // Post-mag recovery or transition logic could go here
    }

    const totalTime = currentTime / TPS;
    const sustainedDps = (totalBulletDamage + (rocketOn ? finalRocketDmg : 0)) / totalTime;

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
    
    const burstBulletDmg = totalDamageForBullets(baseDamage * burstDmgMult, autoAimBullets, chaingunOn);
    const totalBurst = finalRocketDmg + burstBulletDmg;
    
    // Effective Rate for display (Max active rate)
    const effectiveRate = superSerumActive ? (baseRate * SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE) : baseRate;
    const effectiveDamagePerShot = baseDamage * (superSerumActive ? SUPER_SERUM_DAMAGE_MULTIPLIER : 1);

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
      magSize: ammo
    };
  };

  // Base Stats (Standard Soldier, No Serum)
  const baseStats = useMemo(() => simulateCycle({
    baseDamage: BASE_DAMAGE,
    baseRate: BASE_RATE,
    ammo: BASE_AMMO,
    reloadTime: RELOAD,
    rocketOn: true,
    chaingunOn: false,
    superSerumActive: false,
    abilityPct: 0
  }), []);

  // Current Stats
  const currentStats = useMemo(() => {
    // Pre-calculate base modifiers for the simulation input
    // Note: We do NOT apply Serum multipliers here, the simulation handles phases.
    const inputBaseDamage = BASE_DAMAGE * (1 + damagePct * 0.05);
    const inputBaseRate = BASE_RATE * (1 + fireRatePct * 0.05);
    const ammoSize = Math.floor(BASE_AMMO * (1 + totalAmmoBonus) * (1 + manOnRunPct / 100));
    
    return simulateCycle({
      baseDamage: inputBaseDamage,
      baseRate: inputBaseRate,
      ammo: ammoSize,
      reloadTime: RELOAD,
      rocketOn: rocketEnabled,
      chaingunOn: chaingunEnabled,
      superSerumActive: superSerumActive,
      abilityPct: abilityPct
    });
  }, [
    damagePct, fireRatePct, abilityPct, totalAmmoBonus, manOnRunPct,
    chaingunEnabled, superSerumActive, rocketEnabled, miniRocket, explosionDmg
  ]);

  const maxDuration = Math.max(baseStats.totalTimeSeconds, currentStats.totalTimeSeconds);

  // Derived computed values for UI binding
  const computed = {
    totalBurst: currentStats.totalBurst,
    combinedSustainedDps: currentStats.sustainedDps,
    damage: currentStats.displayDamage, // Display effective damage (penalized if serum active)
    rate: currentStats.displayRate,     // Display effective rate (boosted if serum active)
    finalRocketDmg: currentStats.finalRocketDmg,
    bulletsHitInHalfSec: currentStats.displayRate * 0.5,
    autoAimBullets: currentStats.autoAimBullets,
    nextBulletRate: (currentStats.autoAimBullets / 0.5), // Approx
    rateToNextBullet: 0, // Simplified out for now
    maxRate: BASE_RATE * (1 + FIRE_RATE_MAX * 0.05) * (superSerumActive ? (SUPER_SERUM_BASE_RATE * SUPER_SERUM_ACTIVE_RATE) : 1),
    bulletBurstDmg: currentStats.bulletBurstDmg,
    ammo: currentStats.magSize // Show Mag Size (not total fired) in summary
  };

  const handleWheel = (e) => {
    if (e.deltaY !== 0) {
      const zoomDelta = e.deltaY * -0.001;
      setZoomLevel(prev => Math.min(Math.max(prev + zoomDelta, 1), 5));
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
    setActiveAmmoMods(prev =>
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  };

  const clearAmmo = () => setActiveAmmoMods([]);
  const baseAmmoActive = activeAmmoMods.length === 0;

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
        <div className="absolute top-6 left-6">
          <a
            href="#/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing
          </a>
        </div>

        <div className="flex items-center justify-center">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-[0.3em]">
                  <Target className="h-4 w-4" />
                  Soldier 76
                </div>
                <h1 className="text-2xl font-bold text-blue-400">Heavy Pulse Rifle Model</h1>
              </div>
              <Rocket className="h-8 w-8 text-orange-400" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900 p-4 rounded-lg text-center border border-slate-700 col-span-2 sm:col-span-1">
                <p className="text-xs uppercase text-slate-400 font-semibold mb-1">1s Burst Damage</p>
                <p className="text-4xl font-black text-orange-400">{Math.round(computed.totalBurst)}</p>
                <p className="text-[9px] text-slate-500 mt-1">Rocket + 0.5s Bullet Stream</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg text-center border border-slate-700 col-span-2 sm:col-span-1">
                <p className="text-xs uppercase text-slate-400 font-semibold mb-1">Sustained DPS</p>
                <p className="text-4xl font-black text-green-400">{Math.round(computed.combinedSustainedDps)}</p>
                <p className="text-[9px] text-slate-500 mt-1">Cycle (Fire + Reload)</p>
              </div>
            </div>

            <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-1 items-end">
              <div>
                <label className="text-xs font-medium block text-slate-400 uppercase">Weapon Damage (per bullet)</label>
                <span className="text-xs text-blue-400 font-bold">+{damagePct * 5}%</span>
              </div>
              <span className="text-white font-mono font-bold text-lg">{computed.damage.toFixed(2)}</span>
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

          <div>
            <div className="flex justify-between mb-1 items-end">
              <div>
                <label className="text-xs font-medium block text-slate-400 uppercase">Fire Rate (per second)</label>
                <span className="text-xs text-blue-400 font-bold">+{fireRatePct * 5}%</span>
              </div>
              <div className="text-right">
                <span className="text-white font-mono font-bold text-lg">{computed.rate.toFixed(2)}</span>
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-2">
                  <img
                    src={SUPER_VISOR_ICON}
                    alt="Super Visor"
                    className="h-4 w-4 rounded-full border border-slate-700 bg-slate-900/70 p-[1px]"
                    loading="lazy"
                  />
                  <span>Super Visor: {computed.autoAimBullets} Bullet (0.5s)</span>
                </div>
              </div>
            </div>
            <div className="relative pt-4">
              <div className="absolute top-0 h-3" style={{ left: SLIDER_INSET_PX, right: SLIDER_INSET_PX }}>
                {fireRateBreakpoints.map((point) => (
                  <div
                    key={point.bullets}
                    className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${(point.pct / FIRE_RATE_MAX) * 100}%` }}
                  >
                    <div className="text-[9px] text-slate-400 font-mono whitespace-nowrap leading-none mb-1">
                      {point.bullets} ({point.percentLabel}%)
                    </div>
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-slate-400"></div>
                  </div>
                ))}
              </div>
              <input
                type="range"
                min="0"
                max={FIRE_RATE_MAX}
                value={fireRatePct}
                onChange={(e) => setFireRatePct(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1 items-end">
              <div>
                <label className="text-xs font-medium block text-slate-400 uppercase">Ability Power (per direct hit)</label>
                <span className="text-xs text-orange-400 font-bold">+{abilityPct * 5}%</span>
              </div>
              <span className="text-white font-mono font-bold text-lg">{computed.finalRocketDmg.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={abilityPct}
              onChange={(e) => setAbilityPct(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-orange-500"
            />
          </div>

          <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
            <label className="block text-[10px] font-bold mb-2 text-slate-500 uppercase">Ammo Upgrades (Multi-Select)</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={clearAmmo}
                className={`ammo-btn p-2 rounded text-xs border transition-all ${
                  baseAmmoActive
                    ? 'bg-blue-600 border-transparent'
                    : 'bg-slate-700 border-transparent hover:border-blue-500'
                }`}
              >
                Base
              </button>
              {AMMO_OPTIONS.map(option => {
                const active = activeAmmoMods.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleAmmo(option.value)}
                    className={`ammo-btn p-2 rounded text-xs border transition-all ${
                      active
                        ? 'bg-blue-600 border-blue-400'
                        : 'bg-slate-700 border-transparent hover:border-blue-500'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-300">Super Serum (Active)</label>
                <span className="text-[9px] text-slate-500">+87.5% fire rate, -15% weapon damage</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={superSerumActive}
                  onChange={(e) => setSuperSerumActive(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              Includes passive +25% and active +50% rate multiplier.
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <img
                    src={CHAINGUN_ICON}
                    alt="Chaingun"
                    className="h-5 w-5 rounded-md border border-slate-700 bg-slate-900/70 p-[2px]"
                    loading="lazy"
                  />
                  Chaingun
                </label>
                <span className="text-[9px] text-slate-500">0.4% per shot, up to 100 stacks</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={chaingunEnabled}
                  onChange={(e) => setChaingunEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              Stacks build per bullet while firing; reset on stop/reload.
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
            <div className="flex justify-between mb-1 items-end">
              <div>
                <label className="text-xs font-medium block text-slate-400 uppercase flex items-center gap-2">
                  <img
                    src={MAN_ON_RUN_ICON}
                    alt="Man on the Run"
                    className="h-5 w-5 rounded-md border border-slate-700 bg-slate-900/70 p-[2px]"
                    loading="lazy"
                  />
                  Man on the Run (Max Ammo)
                </label>
                <span className="text-xs text-blue-400 font-bold">+{manOnRunPct}%</span>
              </div>
              <span className="text-white font-mono font-bold text-lg">
                {Math.round(BASE_AMMO * (1 + totalAmmoBonus) * (1 + manOnRunPct / 100))}
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

          <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-orange-400">Helix Rocket</span>
                <span className="text-[10px] text-slate-500 tracking-tight">6s Interval / 0.5s Cast</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={rocketEnabled}
                  onChange={(e) => setRocketEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            <div className={`p-3 space-y-3 transition-all ${rocketEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex items-center justify-between group">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <img
                      src={DOUBLE_HELIX_ICON}
                      alt="Double Helix"
                      className="h-4 w-4 rounded border border-slate-700 bg-slate-900/70 p-[1px]"
                      loading="lazy"
                    />
                    Double Helix Power
                  </label>
                  <span className="text-[9px] text-slate-500">30% mini-rocket</span>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
                  checked={miniRocket}
                  onChange={(e) => setMiniRocket(e.target.checked)}
                />
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <img
                      src={CRATERED_ICON}
                      alt="Cratered"
                      className="h-4 w-4 rounded border border-slate-700 bg-slate-900/70 p-[1px]"
                      loading="lazy"
                    />
                    Cratered Power
                  </label>
                  <span className="text-[9px] text-slate-500">+15% Explosion damage</span>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
                  checked={explosionDmg}
                  onChange={(e) => setExplosionDmg(e.target.checked)}
                />
              </div>
            </div>
          </div>
        </div>

            <div className="mt-6 pt-4 border-t border-slate-700 space-y-1.5 text-[11px] font-mono text-slate-400">
              <div className="flex justify-between"><span>Helix Rocket Hit:</span><span className="text-orange-400">{computed.finalRocketDmg.toFixed(1)}</span></div>
              <div className="flex justify-between"><span>0.5s Bullet Window (raw):</span><span className="text-slate-200">{computed.bulletsHitInHalfSec.toFixed(2)}</span></div>
              <div className="flex justify-between">
                <span>Auto-Aim Bullets (0.5s):</span>
                <span className="text-slate-200">{computed.autoAimBullets}</span>
              </div>
              <div className="flex justify-between">
                <span>Next Bullet Breakpoint:</span>
                <span className="text-slate-200">
                  {computed.nextBulletRate.toFixed(2)} rate
                  {computed.nextBulletRate > computed.maxRate
                    ? ' (capped)'
                    : computed.rateToNextBullet > 0
                      ? ` (+${computed.rateToNextBullet.toFixed(2)})`
                      : ' (at breakpoint)'}
                </span>
              </div>
              <div className="flex justify-between"><span>Bullet Burst Dmg:</span><span className="text-slate-200">{computed.bulletBurstDmg.toFixed(1)}</span></div>
              <div className="flex justify-between"><span>Mag Capacity:</span><span className="text-slate-200">{computed.ammo}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[35vh] min-h-[240px] bg-slate-800 border-t-4 border-slate-950 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 relative">
        <div className="px-6 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
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
              <span className="text-xs font-mono text-emerald-400 w-8 text-right">{zoomLevel.toFixed(1)}x</span>
            </div>
            <div className="text-xs text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700 font-mono hidden md:block">
              Scale: {maxDuration.toFixed(2)}s
            </div>
          </div>
        </div>

        <div
          className={`flex-1 bg-slate-900 w-full relative overflow-x-auto custom-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        >
          <div
            className="h-full p-4 md:p-6 flex flex-col gap-2 justify-center relative min-w-full"
            style={{ width: `${zoomLevel * 100}%` }}
          >
            <div className="absolute top-0 inset-x-0 h-full w-full pointer-events-none z-0">
              {Array.from({ length: Math.ceil(maxDuration * (zoomLevel >= 3 ? 2 : 1)) + 1 }).map((_, i) => {
                const sec = i / (zoomLevel >= 3 ? 2 : 1);
                if (sec > maxDuration) return null;

                let step = maxDuration > 20 ? 5 : (maxDuration > 10 ? 2 : 1);
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
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider bg-slate-900/50 px-2 rounded backdrop-blur-sm shadow-sm">Base Profile</span>
              </div>
              <div className="absolute top-0 right-0 h-full w-full pointer-events-none z-30">
                <span className="sticky left-[95%] text-xs font-mono text-slate-400 bg-slate-900/80 px-2 rounded border border-slate-700/50 whitespace-nowrap">
                  {baseStats.totalTimeSeconds.toFixed(2)}s
                </span>
              </div>
              <div className="w-full flex-1 bg-slate-900/80 rounded border border-slate-700 relative overflow-hidden group-hover:brightness-110 transition-all">
                <TimelineTrack
                  stats={baseStats}
                  maxTime={maxDuration}
                  fireClass="bg-slate-300/80"
                />
              </div>
            </div>

            <div className="relative w-full h-1/3 min-h-[60px] max-h-[100px] z-10 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-1 sticky left-0 px-1 w-full z-20 pointer-events-none">
                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider bg-slate-900/50 px-2 rounded backdrop-blur-sm shadow-sm">Current Configuration</span>
              </div>
              <div className="absolute top-0 right-0 h-full w-full pointer-events-none z-30">
                <span className="sticky left-[95%] text-xs font-mono text-emerald-400 bg-slate-900/80 px-2 rounded border border-emerald-500/30 whitespace-nowrap">
                  {currentStats.totalTimeSeconds.toFixed(2)}s
                </span>
              </div>
              <div className="w-full flex-1 bg-slate-900 rounded border border-emerald-500/30 relative overflow-hidden shadow-lg shadow-emerald-900/10">
                <TimelineTrack
                  stats={currentStats}
                  maxTime={maxDuration}
                  fireClass="bg-emerald-400"
                  glowClass={true}
                />
              </div>
            </div>

            <div className="h-6 w-full relative mt-1 select-none pointer-events-none">
              {Array.from({ length: Math.ceil(maxDuration * (zoomLevel >= 3 ? 2 : 1)) + 1 }).map((_, i) => {
                const sec = i / (zoomLevel >= 3 ? 2 : 1);
                if (sec > maxDuration) return null;

                let step = maxDuration > 20 ? 5 : (maxDuration > 10 ? 2 : 1);
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

  if (!stats) return null;

  return (
    <>
      <div className="absolute inset-0 w-full h-full" onMouseLeave={() => setTooltip(null)}>
        {stats.timeline.map((event, idx) => {
          const leftPos = maxTime > 0 ? (event.start / (maxTime * TPS)) * 100 : 0;
          const width = maxTime > 0 ? (event.duration / (maxTime * TPS)) * 100 : 0;

                  if (event.type === 'fire') {
                    const isAlternated = (event.bulletIndex / 5) % 2 === 0;
                    const isHovered = tooltip?.idx === idx;
                    return (
                      <div 
                        key={idx}
                        className="absolute top-0 h-full flex justify-center z-10 hover:z-30 group"
                        style={{ left: `${leftPos}%`, width: '12px', transform: 'translateX(-50%)' }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            idx,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                            data: event
                          });
                        }}
                      >
                        <div
                          className={`h-full w-[2px] transition-all ${fireClass} ${glowClass ? `shadow-[0_0_8px_rgba(52,211,153,0.5)]` : ''} ${isHovered ? 'scale-y-110 w-[3px] brightness-125' : ''}`}
                        />
                        
                        {event.showLabel && (
                          <div
                            className={`absolute ${isAlternated ? 'bottom-1' : 'top-1'} left-1/2 -translate-x-1/2 z-20 text-[9px] font-mono text-slate-100 font-medium pointer-events-none bg-slate-900/90 border border-slate-700/80 rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm`}
                          >
                            <span className="text-slate-400">#</span>{event.bulletIndex} · <span className={glowClass ? 'text-emerald-400' : 'text-slate-300'}>{event.cumulative.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
          if (event.type === 'reload' || event.type === 'rocket') {
            const isRocket = event.type === 'rocket';
            const isSerum = event.isSerum;
            
            let bgClass = 'bg-gradient-to-b from-red-500 to-red-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]';
            if (isRocket) bgClass = 'bg-gradient-to-b from-orange-500 to-orange-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]';
            if (isSerum) bgClass = 'bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(34,211,238,0.5)] border-cyan-300';

            return (
              <div
                key={idx}
                className={`absolute top-0 h-full border-x border-white/10 flex items-center justify-center overflow-hidden transition-all ${bgClass}`}
                style={{
                  left: `${leftPos}%`,
                  width: `${width}%`
                }}
              >
                {!isSerum && <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)]"></div>}
                {(width > 0.5 || isSerum) && (
                  <span className={`relative text-[10px] font-black uppercase truncate px-2 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] tracking-wider ${isSerum ? 'text-white text-[8px]' : 'text-white'}`}>
                    {event.label}
                  </span>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>

      {tooltip && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl whitespace-nowrap min-w-[100px]">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 border-b border-slate-700 pb-1">
              Bullet #{tooltip.data.bulletIndex}
            </div>
            <div className="flex justify-between gap-4 items-center">
              <span className="text-[9px] text-slate-500 uppercase">Damage</span>
              <span className="text-xs font-mono font-bold text-white">{tooltip.data.damage.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4 items-center">
              <span className="text-[9px] text-slate-500 uppercase">Total</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{tooltip.data.cumulative.toFixed(1)}</span>
            </div>
            <div className="flex justify-between gap-4 items-center">
              <span className="text-[9px] text-slate-500 uppercase">Time</span>
              <span className="text-xs font-mono text-slate-300">{(tooltip.data.start / TPS).toFixed(3)}s</span>
            </div>
          </div>
          <div className="w-2 h-2 bg-slate-800 border-r border-b border-slate-600 rotate-45 mx-auto -mt-1"></div>
        </div>,
        document.body
      )}
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
