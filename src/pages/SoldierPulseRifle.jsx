import { ArrowLeft, Rocket, Target } from 'lucide-react';
import { useMemo, useState } from 'react';

const BASE_DAMAGE = 19;
const BASE_RATE = 9;
const BASE_AMMO = 30;
const RELOAD = 1.5;
const ROCKET_INTERVAL = 6;
const ROCKET_CAST = 0.5;

const AMMO_OPTIONS = [
  { label: '+20%', value: 0.2 },
  { label: '+25%', value: 0.25 },
  { label: '+40%', value: 0.4 }
];

export default function SoldierPulseRifle() {
  const [damagePct, setDamagePct] = useState(0);
  const [fireRatePct, setFireRatePct] = useState(0);
  const [abilityPct, setAbilityPct] = useState(0);
  const [activeAmmoMods, setActiveAmmoMods] = useState([]);
  const [rocketEnabled, setRocketEnabled] = useState(true);
  const [miniRocket, setMiniRocket] = useState(false);
  const [explosionDmg, setExplosionDmg] = useState(false);

  const totalAmmoBonus = useMemo(
    () => activeAmmoMods.reduce((sum, value) => sum + value, 0),
    [activeAmmoMods]
  );

  const computed = useMemo(() => {
    const damage = BASE_DAMAGE * (1 + damagePct * 0.05);
    const rate = BASE_RATE * (1 + fireRatePct * 0.05);
    const ammo = Math.floor(BASE_AMMO * (1 + totalAmmoBonus));

    const fireTime = ammo / rate;
    const cycleTime = fireTime + RELOAD;
    const weaponSustainedDps = (damage * ammo) / cycleTime;

    let baseRocketDmg = 120;
    if (miniRocket && explosionDmg) baseRocketDmg = 187.2;
    else if (miniRocket) baseRocketDmg = 171.6;
    else if (explosionDmg) baseRocketDmg = 144;

    const finalRocketDmg = rocketEnabled ? baseRocketDmg * (1 + abilityPct * 0.05) : 0;
    const bulletsHitInHalfSec = rate * 0.5;
    const bulletBurstDmg = damage * bulletsHitInHalfSec;
    const totalBurst = finalRocketDmg + bulletBurstDmg;

    let combinedSustainedDps = weaponSustainedDps;
    if (rocketEnabled) {
      const activeWeaponTime = ROCKET_INTERVAL - ROCKET_CAST;
      const totalDmgInWindow = finalRocketDmg + (weaponSustainedDps * activeWeaponTime);
      combinedSustainedDps = totalDmgInWindow / ROCKET_INTERVAL;
    }

    return {
      damage,
      rate,
      ammo,
      finalRocketDmg,
      bulletsHitInHalfSec,
      bulletBurstDmg,
      totalBurst,
      combinedSustainedDps
    };
  }, [damagePct, fireRatePct, abilityPct, totalAmmoBonus, rocketEnabled, miniRocket, explosionDmg]);

  const toggleAmmo = (value) => {
    setActiveAmmoMods(prev =>
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  };

  const clearAmmo = () => setActiveAmmoMods([]);
  const baseAmmoActive = activeAmmoMods.length === 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="absolute top-6 left-6">
        <a
          href="#/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to landing
        </a>
      </div>

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
              <span className="text-white font-mono font-bold text-lg">{computed.rate.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={fireRatePct}
              onChange={(e) => setFireRatePct(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500"
            />
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

          <div>
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
                  <label className="text-xs font-semibold text-slate-300">Double Helix Power</label>
                  <span className="text-[9px] text-slate-500">Synergy Bonus</span>
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
                  <label className="text-xs font-semibold text-slate-300">Cratered Power</label>
                  <span className="text-[9px] text-slate-500">+20% Dmg Base</span>
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
          <div className="flex justify-between"><span>0.5s Bullets Hit:</span><span className="text-slate-200">{computed.bulletsHitInHalfSec.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Bullet Burst Dmg:</span><span className="text-slate-200">{computed.bulletBurstDmg.toFixed(1)}</span></div>
          <div className="flex justify-between"><span>Mag Capacity:</span><span className="text-slate-200">{computed.ammo}</span></div>
        </div>
      </div>
    </div>
  );
}
