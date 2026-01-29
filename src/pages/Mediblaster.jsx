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
import { useMemo, useRef, useState } from "react";

export default function MediblasterPage() {
  // Default parameters
  const [params, setParams] = useState({
    bulletValue: 7.5,
    weaponPower: 100,
    attackSpeed: 100,
    clipMods: { m20: false, m25: false, m40: false },
    withReload: true,
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
    const { bulletValue, weaponPower, attackSpeed, clipSize, withReload } =
      config;

    const VOLLEY_SIZE = 12;
    const INTRA_BURST_INTERVAL_FRAMES = 0.03 * TPS; // 1.8 frames
    const RELOAD_FRAMES = withReload ? 1.5 * TPS : 0;
    const COCKING_FRAMES = 0.3 * TPS;
    const RECOVERY_FRAMES = 0.45 * TPS;

    const attackSpeedPercent = attackSpeed / 100;
    const weaponPowerPercent = weaponPower / 100;

    // ceil() logic from original code
    const cockingFrames = Math.ceil(COCKING_FRAMES / attackSpeedPercent);
    const singleRecoveryFrame = Math.ceil(RECOVERY_FRAMES / attackSpeedPercent);

    let currentTime = 0;
    const timeline = [];

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
      timeline.push({
        type: "fire",
        start: currentTime,
        duration: 0,
        damage: damageAccumulated,
        bulletIndex: i,
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
      }),
    [params.bulletValue],
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
      }),
    [params, currentClipSize],
  );

  // Determine the maximum time scale for the comparison view
  const maxDuration = Math.max(
    baseStats.totalTimeSeconds,
    currentStats.totalTimeSeconds,
  );

  const handleParamChange = (key, value) => {
    setParams((prev) => ({
      ...prev,
      [key]: key === "withReload" ? value : Number(value),
    }));
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
    <div className="h-screen bg-slate-900 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Upper Section: Controls and Data (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
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

                {/* Updated Ranges: 100% to 200% */}
                <ControlInput
                  label="Weapon Power"
                  value={params.weaponPower}
                  onChange={(v) => handleParamChange("weaponPower", v)}
                  min={100}
                  max={200}
                  step={5}
                  unit="%"
                  tickStep={10}
                />
                <ControlInput
                  label="Attack Speed"
                  value={params.attackSpeed}
                  onChange={(v) => handleParamChange("attackSpeed", v)}
                  min={100}
                  max={200}
                  step={5}
                  unit="%"
                  tickStep={10}
                />

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
              </div>
            </div>

            {/* Stats & Mechanics */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<Zap className="w-5 h-5 text-yellow-400" />}
                  label="Output HPS/DPS"
                  value={currentStats.dps.toFixed(2)}
                  subtext={`Base: ${baseStats.dps.toFixed(2)}`}
                  trend={currentStats.dps - baseStats.dps}
                  baseValue={baseStats.dps}
                />
                <StatCard
                  icon={<Crosshair className="w-5 h-5 text-red-400" />}
                  label="Total Output"
                  value={Math.round(currentStats.totalDamage).toLocaleString()}
                  subtext={`Base: ${Math.round(baseStats.totalDamage).toLocaleString()}`}
                  trend={currentStats.totalDamage - baseStats.totalDamage}
                  baseValue={baseStats.totalDamage}
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
                    sub="(Fixed)"
                  />
                  <MechanicBox
                    label="Recovery"
                    value={`${Math.ceil((0.45 * TPS) / (params.attackSpeed / 100))} frames`}
                    sub={`Base: ${Math.ceil(0.45 * TPS)}`}
                  />
                  <MechanicBox
                    label="Cocking"
                    value={`${Math.ceil((0.3 * TPS) / (params.attackSpeed / 100))} frames`}
                    sub={`Base: ${Math.ceil(0.3 * TPS)}`}
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
  if (!stats) return null;

  return (
    <div className="absolute inset-0 w-full h-full">
      {stats.timeline.map((event, idx) => {
        const leftPos = (event.start / (maxTime * 60)) * 100; // 60 is TPS
        const width = (event.duration / (maxTime * 60)) * 100;

        if (event.type === "fire") {
          // Fire events are instant lines
          return (
            <div
              key={idx}
              className="absolute top-0 h-full w-[1px] md:w-[2px] z-10 transition-colors bg-emerald-400"
              style={{ left: `${leftPos}%` }}
            />
          );
        } else if (event.type === "interval") {
          // Empty space mostly, just visual spacing
          return null;
        } else {
          // Major Blocks - Uniform colors for both tracks
          let colorClass = "bg-gray-700";
          if (event.type === "reload") colorClass = "bg-red-500 border-red-400";
          if (event.type === "cocking")
            colorClass = "bg-orange-500 border-orange-400";
          if (event.type === "recovery")
            colorClass = "bg-blue-500 border-blue-400";

          return (
            <div
              key={idx}
              className={`absolute top-0 h-full border-l border-r border-white/5 ${colorClass} flex items-center justify-center overflow-hidden`}
              style={{
                left: `${leftPos}%`,
                width: `${width}%`,
              }}
            >
              {/* Only show label if wide enough relative to current view */}
              {width > 0.5 && (
                <span className="text-[9px] font-bold uppercase truncate px-1 select-none text-white drop-shadow-md">
                  {event.label}
                </span>
              )}
            </div>
          );
        }
      })}
    </div>
  );
}

function ControlInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  tickStep,
}) {
  const ticks = useMemo(() => {
    if (!tickStep) return [];
    const t = [];
    // Start from first tick after min, or min if it aligns
    const firstTick = Math.ceil(min / tickStep) * tickStep;
    for (let i = firstTick; i <= max; i += tickStep) {
      t.push(i);
    }
    return t;
  }, [min, max, tickStep]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <label className="text-slate-300 font-medium">{label}</label>
        <span className="text-emerald-400 font-mono">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative w-full h-6 flex items-center">
        {/* Custom Track Background with Ticks */}
        <div className="absolute inset-x-0 h-2 bg-slate-700 rounded-lg overflow-hidden pointer-events-none">
          {ticks.map((tickVal) => {
            const percent = ((tickVal - min) / (max - min)) * 100;
            return (
              <div
                key={tickVal}
                className="absolute top-0 bottom-0 w-0.5 bg-slate-600/50"
                style={{ left: `${percent}%` }}
              />
            );
          })}
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="relative z-10 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>
    </div>
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
