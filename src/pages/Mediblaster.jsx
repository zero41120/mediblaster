import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  Clock,
  Crosshair,
  Info,
  RotateCcw,
  Settings,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function MediblasterPage() {
  // Default parameters
  const [params, setParams] = useState({
    bulletValue: 7.5,
    weaponPower: 100,
    attackSpeed: 100,
    enemyHp: 750,
    clipMods: { m20: false, m25: false, m40: false },
    withReload: true,
    tommygunEnabled: false,
    tommygunMode: "window",
  });

  const [zoomLevel, setZoomLevel] = useState(1);
  const [visualizerOpen, setVisualizerOpen] = useState(true);

  // Drag-to-scroll state
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const BASE_CLIP = 180;
  const TPS = 60;
  const isDamageMode = params.bulletValue === 7.5;
  const isTommygunActive = isDamageMode && params.tommygunEnabled;

  // Calculate current clip size based on modifiers
  const currentClipSize = useMemo(() => {
    let multiplier = 1.0;
    if (params.clipMods.m20) multiplier += 0.2;
    if (params.clipMods.m25) multiplier += 0.25;
    if (params.clipMods.m40) multiplier += 0.4;
    return Math.floor(BASE_CLIP * multiplier);
  }, [params.clipMods]);

  // Core calculation logic extracted for reuse
  const calculateCycle = (config) => {
    const {
      bulletValue,
      weaponPower,
      attackSpeed,
      clipSize,
      withReload,
      tommygunEnabled,
      tommygunMode,
    } = config;

    const VOLLEY_SIZE = 12;
    const INTRA_BURST_INTERVAL_FRAMES = 0.03 * TPS; // 1.8 frames
    const RELOAD_FRAMES = withReload ? 1.5 * TPS : 0;
    const COCKING_FRAMES = 0.3 * TPS;
    const RECOVERY_FRAMES = 0.45 * TPS;
    const TOMMYGUN_WINDOW_FRAMES = 3 * TPS;
    const TOMMYGUN_PROC_FRAMES = 0.25 * TPS;

    const effectiveAttackSpeed =
      attackSpeed + (tommygunEnabled ? 10 : 0);
    const attackSpeedPercent = effectiveAttackSpeed / 100;
    const weaponPowerPercent = weaponPower / 100;

    // ceil() logic from original code
    const cockingFrames = Math.ceil(COCKING_FRAMES / attackSpeedPercent);
    const singleRecoveryFrame = Math.ceil(RECOVERY_FRAMES / attackSpeedPercent);

    let currentTime = 0;
    const timeline = [];
    let firstFireTime = null;
    let lastProcTime = null;
    let tommygunProcs = 0;
    let volleyProcCount = 0;

    // 1. Reload Phase
    if (withReload) {
      timeline.push({
        type: "reload",
        start: currentTime,
        duration: RELOAD_FRAMES,
        label: "Reload",
      });
      currentTime += RELOAD_FRAMES;
    }

    // 2. Cocking Phase
    timeline.push({
      type: "cocking",
      start: currentTime,
      duration: cockingFrames,
      label: "Cock",
    });
    currentTime += cockingFrames;

    // 3. Firing Loop
    let damageAccumulated = 0;
    const damagePerShot = bulletValue * weaponPowerPercent;

    for (let i = 1; i <= clipSize; i++) {
      const isFirstBulletOfVolley = (i - 1) % VOLLEY_SIZE === 0;
      if (isFirstBulletOfVolley) {
        volleyProcCount = 0;
      }

      // Intra-burst interval
      if (!isFirstBulletOfVolley) {
        timeline.push({
          type: "interval",
          start: currentTime,
          duration: INTRA_BURST_INTERVAL_FRAMES,
          label: "",
        });
        currentTime += INTRA_BURST_INTERVAL_FRAMES;
      }

      // Fire Event
      damageAccumulated += damagePerShot;
      if (firstFireTime === null) firstFireTime = currentTime;
      const withinTommyWindow =
        tommygunEnabled &&
        firstFireTime !== null &&
        (tommygunMode === "always" ||
          currentTime - firstFireTime <= TOMMYGUN_WINDOW_FRAMES + 1e-9);
      const canProc =
        withinTommyWindow &&
        volleyProcCount < 2 &&
        (lastProcTime === null ||
          currentTime - lastProcTime >= TOMMYGUN_PROC_FRAMES - 1e-9);
      if (canProc) {
        lastProcTime = currentTime;
        tommygunProcs += 1;
        volleyProcCount += 1;
      }
      timeline.push({
        type: "fire",
        start: currentTime,
        duration: 0,
        damage: damageAccumulated,
        bulletIndex: i,
        tommygunProc: canProc,
        tommygunProcIndex: canProc ? tommygunProcs : null,
      });

      // Recovery Phase
      const isEndOfVolley = i % VOLLEY_SIZE === 0;
      const hasAmmoLeft = i < clipSize;

      if (isEndOfVolley && hasAmmoLeft) {
        timeline.push({
          type: "recovery",
          start: currentTime,
          duration: singleRecoveryFrame,
          label: "Rec",
        });
        currentTime += singleRecoveryFrame;
      }
    }

    const totalTimeSeconds = currentTime / TPS;
    const totalDamage = clipSize * bulletValue * weaponPowerPercent;
    const dps = totalDamage * (TPS / currentTime);

    return {
      timeline,
      totalTimeSeconds,
      totalFrames: currentTime,
      totalDamage,
      dps,
      tommygunProcs,
    };
  };

  // Generate stats for Base Profile (Reference)
  // NOW DEPENDENT on params.bulletValue so it updates when mode changes
  const baseStats = useMemo(
    () =>
      calculateCycle({
        bulletValue: params.bulletValue,
        weaponPower: 100,
        attackSpeed: 100,
        clipSize: BASE_CLIP,
        withReload: true,
        tommygunEnabled: isTommygunActive,
        tommygunMode: params.tommygunMode,
      }),
    [params.bulletValue, isTommygunActive, params.tommygunMode],
  );

  // Generate stats for Current Profile (User Config)
  const currentStats = useMemo(
    () =>
      calculateCycle({
        bulletValue: params.bulletValue,
        weaponPower: params.weaponPower,
        attackSpeed: params.attackSpeed,
        clipSize: currentClipSize,
        withReload: params.withReload,
        tommygunEnabled: isTommygunActive,
        tommygunMode: params.tommygunMode,
      }),
    [params, currentClipSize, isTommygunActive],
  );

  // Determine the maximum time scale for the comparison view
  const maxDuration = Math.max(
    baseStats.totalTimeSeconds,
    currentStats.totalTimeSeconds,
  );

  const currentTommygunBonusDamage =
    isTommygunActive ? currentStats.tommygunProcs * 0.01 * params.enemyHp : 0;
  const currentEffectiveTotalDamage =
    currentStats.totalDamage + currentTommygunBonusDamage;
  const baseEffectiveTotalDamage = baseStats.totalDamage;
  const currentEffectiveDps =
    currentStats.totalTimeSeconds > 0
      ? currentEffectiveTotalDamage / currentStats.totalTimeSeconds
      : 0;
  const baseEffectiveDps = baseStats.dps;
  const tommygunBonusDamage = currentTommygunBonusDamage;
  const tommygunImpactPct =
    params.enemyHp > 0 ? (tommygunBonusDamage / params.enemyHp) * 100 : 0;
  const baseDamageAt100 =
    params.weaponPower > 0
      ? currentStats.totalDamage / (params.weaponPower / 100)
      : 0;
  const tommygunEqPowerPct =
    baseDamageAt100 > 0 ? (tommygunBonusDamage / baseDamageAt100) * 100 : 0;
  const tommygunEqWeaponPower = 100 + tommygunEqPowerPct;

  const tommygunBreakpoints = useMemo(() => {
    if (!isTommygunActive || params.tommygunMode !== "window") return [];
    const points = [];
    let lastProcs = null;

    for (let speed = 100; speed <= 200; speed += 5) {
      const stats = calculateCycle({
        bulletValue: params.bulletValue,
        weaponPower: params.weaponPower,
        attackSpeed: speed,
        clipSize: currentClipSize,
        withReload: params.withReload,
        tommygunEnabled: true,
        tommygunMode: "window",
      });

      if (lastProcs === null || stats.tommygunProcs !== lastProcs) {
        points.push({ value: speed, procs: stats.tommygunProcs });
        lastProcs = stats.tommygunProcs;
      }
    }

    return points;
  }, [
    isTommygunActive,
    params.bulletValue,
    params.weaponPower,
    params.withReload,
    currentClipSize,
    params.tommygunMode,
  ]);

  const hasTommygunBreakpoints =
    isTommygunActive && tommygunBreakpoints.length > 0;

  const handleParamChange = (key, value) => {
    setParams((prev) => ({
      ...prev,
      [key]:
        key === "withReload" || key === "tommygunEnabled" || key === "tommygunMode"
          ? value
          : Number(value),
    }));
  };

  const handleTommygunToggle = () => {
    setParams((prev) => {
      const nextEnabled = !prev.tommygunEnabled;

      return {
        ...prev,
        tommygunEnabled: nextEnabled,
        attackSpeed:
          nextEnabled && prev.attackSpeed < 110 ? 110 : prev.attackSpeed,
      };
    });
  };

  const toggleClipMod = (mod) => {
    setParams((prev) => ({
      ...prev,
      clipMods: { ...prev.clipMods, [mod]: !prev.clipMods[mod] },
    }));
  };

  // --- Interaction Handlers ---

  const handleWheel = (e) => {
    // Only zoom if scrolling vertically
    if (e.deltaY !== 0) {
      // Prevent default only if we are consuming the event for zoom
      // Note: In React passive events are default, so preventDefault might warn,
      // but for zoom it's often needed to stop page scroll.
      // For this implementation we'll just update state and let CSS overflow handling do the rest

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
    const walk = (x - startX) * 2; // Scroll-fast multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 font-sans flex flex-col overflow-hidden relative">
      {/* Background Image - Right Side Watermark (Stylized) */}
      <div className="absolute top-0 right-0 h-full w-full md:w-2/3 lg:w-1/2 pointer-events-none overflow-hidden z-0">
        {/* Gradients for smooth fade */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10"></div>

        {/* Image with filters to hide low-res artifacts */}
        <img
          src="https://static.wikia.nocookie.net/overwatch_gamepedia/images/c/cc/Juno_Stadium.png"
          alt=""
          className="w-full h-full object-cover object-top opacity-20 blur-[2px] grayscale mix-blend-luminosity"
        />
      </div>

      {/* Upper Section: Controls and Data (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-700">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8 text-emerald-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Juno - Mediblaster
                </h1>
                <p className="text-slate-400 text-sm">
                  Visualizing weapon cycle mechanics and DPS output
                </p>
              </div>
            </div>
            <a
              href="#/"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to landing
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls Panel */}
            <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 space-y-6 h-fit">
              <div className="flex items-center space-x-2 text-lg font-semibold text-emerald-400">
                <Settings className="w-5 h-5" />
                <h2>Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Bullet Value Toggle */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <label className="text-slate-300 font-medium">Mode</label>
                  </div>
                  <div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600">
                    <button
                      onClick={() => handleParamChange("bulletValue", 6)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        params.bulletValue === 6
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Healing (6.0)
                    </button>
                    <button
                      onClick={() => handleParamChange("bulletValue", 7.5)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        params.bulletValue === 7.5
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Damage (7.5)
                    </button>
                  </div>
                </div>

                {/* Weapon Power */}
                <div>
                  <div className="flex justify-between mb-1 items-end">
                    <div>
                      <label className="text-xs font-medium block text-slate-400 uppercase">
                        Weapon Power
                      </label>
                      <span className="text-xs text-emerald-400 font-bold">
                        {params.weaponPower}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white font-mono font-bold text-lg">
                        {params.weaponPower}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        percent
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="200"
                    step="5"
                    value={params.weaponPower}
                    onChange={(e) =>
                      handleParamChange("weaponPower", e.target.value)
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-emerald-500"
                  />
                </div>

                {/* Attack Speed */}
                <div>
                  <div className="flex justify-between mb-10 items-end">
                    <div>
                      <label className="text-xs font-medium block text-slate-400 uppercase">
                        Attack Speed
                      </label>
                      <span className="text-xs text-emerald-400 font-bold">
                        {params.attackSpeed}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white font-mono font-bold text-lg">
                        {params.attackSpeed}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        percent
                      </span>
                    </div>
                  </div>

                  <div className="relative group mb-6">
                    <div className="absolute bottom-full left-[12px] right-[12px] h-8 pointer-events-none">
                      {isTommygunActive &&
                        tommygunBreakpoints.map((point) => (
                          <div
                            key={point.value}
                            className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-pointer"
                            style={{
                              left: `${((point.value - 100) / 100) * 100}%`,
                            }}
                            onClick={() =>
                              handleParamChange("attackSpeed", point.value)
                            }
                            role="button"
                            tabIndex={0}
                          >
                            <span className="text-[9px] font-mono text-fuchsia-300 font-semibold mb-0.5 whitespace-nowrap">
                              {point.procs} ({point.value}%)
                            </span>
                            <div className="text-slate-500 text-[8px] leading-none transform scale-x-75">
                              ▼
                            </div>
                          </div>
                        ))}
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="200"
                      step="5"
                      value={params.attackSpeed}
                      onChange={(e) =>
                        handleParamChange("attackSpeed", e.target.value)
                      }
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-emerald-500 cursor-pointer relative z-10"
                    />
                  </div>
                </div>

                {/* New Clip Size Controls */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end text-sm">
                    <label className="text-slate-300 font-medium pb-0.5">
                      Clip Size Modifiers
                    </label>
                    <div className="text-right leading-none">
                      <span className="text-emerald-400 font-mono font-bold text-base">
                        {currentClipSize}
                      </span>
                      <span className="text-slate-500 text-[10px] ml-1.5 uppercase font-medium">
                        / {BASE_CLIP} Base
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <ClipToggle
                      label="+20%"
                      active={params.clipMods.m20}
                      onClick={() => toggleClipMod("m20")}
                    />
                    <ClipToggle
                      label="+25%"
                      active={params.clipMods.m25}
                      onClick={() => toggleClipMod("m25")}
                    />
                    <ClipToggle
                      label="+40%"
                      active={params.clipMods.m40}
                      onClick={() => toggleClipMod("m40")}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-300">
                    With Reload Cycle
                  </span>
                  <button
                    onClick={() =>
                      handleParamChange("withReload", !params.withReload)
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${params.withReload ? "bg-emerald-500" : "bg-slate-600"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${params.withReload ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {isDamageMode && (
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">
                          Three Tap Tommygun
                        </span>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          After ability, adds +10% attack speed and +1% max HP
                          every 0.25s.
                        </span>
                      </div>
                      <button
                        onClick={handleTommygunToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${params.tommygunEnabled ? "bg-fuchsia-500" : "bg-slate-600"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${params.tommygunEnabled ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                    <div className="flex bg-slate-800/60 rounded-lg p-1 border border-slate-700">
                      <button
                        type="button"
                        onClick={() =>
                          handleParamChange("tommygunMode", "window")
                        }
                        className={`flex-1 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md transition-all ${
                          params.tommygunMode === "window"
                            ? "bg-fuchsia-500 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        First 3s
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleParamChange("tommygunMode", "always")
                        }
                        className={`flex-1 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md transition-all ${
                          params.tommygunMode === "always"
                            ? "bg-fuchsia-500 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Always Active
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {params.tommygunMode === "window"
                        ? "Max 12 procs (12% max HP) in a 3s window."
                        : "Active for the entire cycle."}
                    </div>
                    <div className="pt-1">
                      <div className="flex justify-between mb-1 items-end">
                        <div>
                          <label className="text-[10px] font-semibold block text-slate-500 uppercase">
                            Enemy Max HP
                          </label>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {params.enemyHp} HP
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-white font-mono font-bold text-sm">
                            {params.enemyHp}
                          </span>
                          <span className="text-[9px] uppercase tracking-wide text-slate-500">
                            health
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="225"
                        max="1225"
                        step="25"
                        value={params.enemyHp}
                        onChange={(e) =>
                          handleParamChange("enemyHp", e.target.value)
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none accent-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats & Mechanics */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                  icon={<Zap className="w-5 h-5 text-yellow-400" />}
                  label="Output HPS/DPS"
                  value={currentEffectiveDps.toFixed(2)}
                  subtext={`Base: ${baseEffectiveDps.toFixed(2)}`}
                  trend={currentEffectiveDps - baseEffectiveDps}
                  baseValue={baseEffectiveDps}
                />
                <StatCard
                  icon={<Crosshair className="w-5 h-5 text-red-400" />}
                  label="Total Output"
                  value={Math.round(currentEffectiveTotalDamage).toLocaleString()}
                  subtext={`Base: ${Math.round(baseEffectiveTotalDamage).toLocaleString()}`}
                  trend={currentEffectiveTotalDamage - baseEffectiveTotalDamage}
                  baseValue={baseEffectiveTotalDamage}
                />
                <StatCard
                  icon={<Clock className="w-5 h-5 text-blue-400" />}
                  label="Cycle Time"
                  value={`${currentStats.totalTimeSeconds.toFixed(2)}s`}
                  subtext={`Base: ${baseStats.totalTimeSeconds.toFixed(2)}s`}
                  trend={
                    currentStats.totalTimeSeconds - baseStats.totalTimeSeconds
                  }
                  inverseTrend
                  baseValue={baseStats.totalTimeSeconds}
                />
              </div>

              {isDamageMode && (
                <div className="overflow-hidden rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 via-slate-800/90 to-slate-800 shadow-lg shadow-fuchsia-950/20">
                  <div className="flex flex-col gap-4 p-5 md:flex-row md:items-stretch md:justify-between">
                    <div className="min-w-0 md:max-w-sm">
                      <div className="flex items-center gap-2 text-fuchsia-200">
                        <Zap className="h-5 w-5" />
                        <h3 className="text-sm font-bold uppercase tracking-[0.18em]">
                          Tommygun Impact
                        </h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        {params.tommygunMode === "always"
                          ? "Tracking every eligible proc across the full firing cycle."
                          : "Tracking eligible procs inside the first 3 seconds after activation."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-200">
                          {params.tommygunEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <span className="rounded-full border border-slate-600 bg-slate-900/40 px-3 py-1">
                          {params.tommygunMode === "always"
                            ? "Always active"
                            : "First 3s window"}
                        </span>
                        <span className="rounded-full border border-slate-600 bg-slate-900/40 px-3 py-1">
                          {params.enemyHp} enemy HP
                        </span>
                      </div>
                    </div>

                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                      <TommygunMetric
                        label={
                          params.tommygunMode === "always"
                            ? "Cycle Procs"
                            : "Window Procs"
                        }
                        value={currentStats.tommygunProcs}
                        subtext={`Base ${baseStats.tommygunProcs}`}
                      />
                      <TommygunMetric
                        label="Bonus Damage"
                        value={`+${Math.round(tommygunBonusDamage)}`}
                        subtext={`${tommygunImpactPct.toFixed(1)}% max HP`}
                      />
                      <TommygunMetric
                        label="Eq Weapon Power"
                        value={`+${tommygunEqPowerPct.toFixed(1)}%`}
                        subtext={`100% -> ${tommygunEqWeaponPower.toFixed(1)}%`}
                      />
                    </div>
                  </div>

                  <div className="min-h-[108px] border-t border-fuchsia-300/10 bg-slate-950/30 px-5 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <span>Attack speed breakpoints</span>
                      <span className="font-mono text-fuchsia-200">
                        {hasTommygunBreakpoints
                          ? "click markers above the slider"
                          : "reserved to prevent layout shift"}
                      </span>
                    </div>
                    {hasTommygunBreakpoints ? (
                      <div className="flex flex-wrap gap-2">
                        {tommygunBreakpoints.map((point) => (
                          <button
                            key={point.value}
                            type="button"
                            onClick={() =>
                              handleParamChange("attackSpeed", point.value)
                            }
                            className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-mono text-fuchsia-100 transition hover:border-fuchsia-300/50 hover:bg-fuchsia-400/20"
                          >
                            {point.value}% AS: {point.procs} procs
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[56px] items-center rounded-lg border border-dashed border-fuchsia-300/15 bg-slate-900/20 px-3 text-xs text-slate-400">
                        Enable Tommygun in damage mode to populate breakpoint
                        shortcuts here.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mechanics Breakdown */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider border-b border-slate-700 pb-2">
                  Cycle Mechanics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <MechanicBox label="Bullets/Volley" value={12} />
                  <MechanicBox
                    label="Intra-Burst"
                    value="1.8 frames"
                    sub={`${(1.8 / TPS).toFixed(3)}s (Fixed)`}
                  />
                  <MechanicBox
                    label="Recovery"
                    value={`${Math.ceil((0.45 * TPS) / (params.attackSpeed / 100))} frames`}
                    sub={`${(Math.ceil((0.45 * TPS) / (params.attackSpeed / 100)) / TPS).toFixed(3)}s • Base: ${Math.ceil(0.45 * TPS)}f / ${(Math.ceil(0.45 * TPS) / TPS).toFixed(3)}s`}
                  />
                  <MechanicBox
                    label="Cocking"
                    value={`${Math.ceil((0.3 * TPS) / (params.attackSpeed / 100))} frames`}
                    sub={`${(Math.ceil((0.3 * TPS) / (params.attackSpeed / 100)) / TPS).toFixed(3)}s • Base: ${Math.ceil(0.3 * TPS)}f / ${(Math.ceil(0.3 * TPS) / TPS).toFixed(3)}s`}
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-sm text-slate-400">
                <div className="flex items-center gap-2 mb-1 text-slate-300 font-semibold">
                  <Info className="w-4 h-4" /> Technical Source
                </div>
                <a
                  href="https://www.reddit.com/r/JunoMains/comments/1q3o8lw/technical_analysis_juno_mediblaster/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                >
                  View original analysis thread on r/JunoMains
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Timeline (Comparative Video Editor Style) */}
      <div
        className={`bg-slate-800 border-t-4 border-slate-950 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 relative ${visualizerOpen ? "h-[35vh] min-h-[250px]" : "h-auto"}`}
      >
        {/* Timeline Toolbar */}
        <button
          type="button"
          className="px-6 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0"
          onClick={() => setVisualizerOpen((prev) => !prev)}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-400" />
            Cycle Comparison
          </h3>

          <div
            className="flex items-center space-x-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hidden md:flex space-x-4 text-xs font-normal bg-slate-800 p-2 rounded-lg border border-slate-700">
              <LegendItem color="bg-red-500" label="Reload" />
              <LegendItem color="bg-orange-500" label="Cock" />
              <LegendItem color="bg-emerald-500" label="Fire" />
              <LegendItem color="bg-blue-500" label="Recover" />
              <LegendItem color="bg-fuchsia-400" label="Tommygun Proc" />
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
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${visualizerOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Timeline Track Area with Horizontal Scroll & Zoom Logic */}
        <div
          className={`flex-1 bg-slate-900 w-full relative overflow-x-auto custom-scrollbar select-none transition-all ${visualizerOpen ? "max-h-[999px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
            {/* Common Time Axis */}
            <div className="absolute top-0 inset-x-0 h-full w-full pointer-events-none z-0">
              {/* Grid lines - Increase density based on zoom */}
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

            {/* Track 1: Base Profile (Static) */}
            <div className="relative w-full h-1/3 min-h-[60px] max-h-[100px] z-10 flex flex-col justify-center group mb-4">
              <div className="flex justify-between items-end mb-1 sticky left-0 px-1 w-full z-20 pointer-events-none">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider bg-slate-900/50 px-2 rounded backdrop-blur-sm shadow-sm">
                  Base Profile (Static)
                </span>
              </div>

              {/* Floating time label - Sticky to right edge of viewport */}
              <div className="absolute top-0 right-0 h-full w-full pointer-events-none z-30">
                <span className="sticky left-[95%] text-xs font-mono text-slate-400 bg-slate-900/80 px-2 rounded border border-slate-700/50 whitespace-nowrap">
                  {baseStats.totalTimeSeconds.toFixed(2)}s
                </span>
              </div>

              <div className="w-full flex-1 bg-slate-900/80 rounded border border-slate-700 relative overflow-hidden group-hover:brightness-110 transition-all">
                <TimelineTrack stats={baseStats} maxTime={maxDuration} />
              </div>
            </div>

            {/* Track 2: Custom Profile (Dynamic) */}
            <div className="relative w-full h-1/3 min-h-[60px] max-h-[100px] z-10 flex flex-col justify-center">
              {/* Sticky label header */}
              <div className="flex justify-between items-end mb-1 sticky left-0 px-1 w-full z-20 pointer-events-none">
                <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider bg-slate-900/50 px-2 rounded backdrop-blur-sm shadow-sm">
                  Custom Configuration
                </span>
              </div>

              {/* Floating time label - Sticky to right edge of viewport */}
              <div className="absolute top-0 right-0 h-full w-full pointer-events-none z-30">
                <span className="sticky left-[95%] text-xs font-mono text-emerald-400 bg-slate-900/80 px-2 rounded border border-emerald-500/30 whitespace-nowrap">
                  {currentStats.totalTimeSeconds.toFixed(2)}s
                </span>
              </div>

              <div className="w-full flex-1 bg-slate-900 rounded border border-emerald-500/30 relative overflow-hidden shadow-lg shadow-emerald-900/10">
                <TimelineTrack stats={currentStats} maxTime={maxDuration} />
              </div>
            </div>

            {/* Bottom Time Labels */}
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

// --- Sub-components ---

// Separated Timeline Logic for Reusability
function TimelineTrack({ stats, maxTime }) {
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

  const TPS = 60;
  const typeLabels = {
    reload: "Reload",
    cocking: "Cocking",
    recovery: "Recovery",
    interval: "Interval",
    fire: "Fire",
  };

  return (
    <>
      <div
        className="absolute inset-0 w-full h-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {stats.timeline.map((event, idx) => {
          const leftPos = (event.start / (maxTime * TPS)) * 100;
          const width = (event.duration / (maxTime * TPS)) * 100;

          if (event.type === "fire") {
            const isHovered = tooltip?.idx === idx;
            return (
              <div
                key={idx}
                className="absolute top-0 h-full flex justify-center z-10 hover:z-20"
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
                    event.tommygunProc
                      ? "bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.7)]"
                      : "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                  } ${
                    isHovered
                      ? "w-[3px] brightness-125"
                      : "w-[2px]"
                  }`}
                />
              </div>
            );
          }
          if (event.type === "interval") {
            return null;
          }

          let colorClass = "bg-gray-700";
          if (event.type === "reload") colorClass = "bg-red-500 border-red-400";
          if (event.type === "cocking")
            colorClass = "bg-orange-500 border-orange-400";
          if (event.type === "recovery")
            colorClass = "bg-blue-500 border-blue-400";

          return (
            <div
              key={idx}
              className={`absolute top-0 h-full border-l border-r border-white/5 ${colorClass} flex items-center justify-center overflow-hidden transition-all`}
              style={{
                left: `${leftPos}%`,
                width: `${width}%`,
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
              {width > 0.5 && (
                <span className="text-[9px] font-bold uppercase truncate px-1 select-none text-white drop-shadow-md">
                  {event.label}
                </span>
              )}
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
          const isFire = tooltip.data.type === "fire";
          const title = isFire
            ? `Bullet #${tooltip.data.bulletIndex}`
            : typeLabels[tooltip.data.type] || "Event";

          return createPortal(
            <div
              className="fixed z-[9999] pointer-events-none pb-2"
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <div
                ref={tooltipRef}
                className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl whitespace-nowrap min-w-[110px] relative"
              >
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 border-b border-slate-700 pb-1">
                  {title}
                </div>
                {isFire ? (
                  <>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Total
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {tooltip.data.damage.toFixed(1)}
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
                    {tooltip.data.tommygunProc && (
                      <div className="mt-1 text-[9px] font-semibold uppercase text-fuchsia-300">
                        Tommygun proc #{tooltip.data.tommygunProcIndex}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Duration
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {(tooltip.data.duration / TPS).toFixed(3)}s
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-[9px] text-slate-500 uppercase">
                        Start
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {(tooltip.data.start / TPS).toFixed(3)}s
                      </span>
                    </div>
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

function ClipToggle({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
        active
          ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-900/20"
          : "bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  trend,
  inverseTrend,
  baseValue,
}) {
  const isNeutral = trend === 0;

  // Logic for coloring the trend indicator
  let trendColor = "text-slate-500";
  if (!isNeutral) {
    if (inverseTrend) {
      // trend < 0 (Negative) -> Good (Green)
      trendColor = trend < 0 ? "text-emerald-400" : "text-red-400";
    } else {
      // trend > 0 (Positive) -> Good (Green)
      trendColor = trend > 0 ? "text-emerald-400" : "text-red-400";
    }
  }

  const percent = baseValue && baseValue !== 0 ? (trend / baseValue) * 100 : 0;
  // Format percentage: +10.5% or -5.2%
  const percentStr = (percent > 0 ? "+" : "") + percent.toFixed(1) + "%";

  // Format raw trend: +100 or -100
  // toLocaleString handles the negative sign automatically. We just need to add '+' for positive.
  // We use maxFractionDigits to keep it clean.
  const rawTrendStr =
    (trend > 0 ? "+" : "") +
    trend.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-start shadow-md hover:border-slate-600 transition-colors h-full">
      {/* Row 1: Icon + Title */}
      <div className="flex items-center space-x-2 mb-3">
        <div className="p-2 bg-slate-700/50 rounded-lg">{icon}</div>
        <div className="text-sm text-slate-400 font-medium">{label}</div>
      </div>

      {/* Row 2: Current Value */}
      <div className="text-2xl font-bold text-white mb-1">{value}</div>

      {/* Row 3: Base Value */}
      <div className="text-xs text-slate-500 mb-2">{subtext}</div>

      {/* Row 4: Gain (raw), Gain (%) */}
      {!isNeutral ? (
        <div
          className={`text-xs font-medium ${trendColor} flex items-center space-x-1`}
        >
          <span>{rawTrendStr}</span>
          <span className="opacity-80">({percentStr})</span>
        </div>
      ) : (
        <div className="text-xs text-slate-600">-</div>
      )}
    </div>
  );
}

function TommygunMetric({ label, value, subtext }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4 shadow-inner shadow-black/20">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/80">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs font-mono text-slate-400">{subtext}</div>
    </div>
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

function MechanicBox({ label, value, sub }) {
  return (
    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}
