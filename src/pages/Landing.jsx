import { Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.20),_transparent_55%)]"></div>
      <div className="absolute -top-40 right-10 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl"></div>
      <div className="absolute -bottom-48 -left-24 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl"></div>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 px-6 py-14 lg:py-20">
        <header className="flex flex-col gap-6">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200 animate-[float_8s_ease-in-out_infinite]">
              <Sparkles className="h-4 w-4" />
              zero41120's Combat Lab
            </div>
            <h1
              className="text-4xl font-black leading-tight text-white md:text-5xl"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Overwatch Stadium Combat Models
            </h1>
            <p className="text-lg text-slate-300">Pick a model and dive in.</p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2 lg:justify-start">
          <a
            href="#/juno-mediblaster"
            className="group relative flex items-stretch overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-[0_16px_40px_rgba(16,185,129,0.12)] transition hover:-translate-y-1"
          >
            <div className="relative h-[200px] w-[147px] shrink-0">
              <img
                src="https://static.wikia.nocookie.net/overwatch_gamepedia/images/c/cc/Juno_Stadium.png"
                alt="Juno Stadium"
                width="294"
                height="400"
                className="block h-[200px] w-[147px]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"></div>
            </div>
            <div className="relative z-10 flex flex-1 flex-col justify-center gap-2 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200">
                Juno
              </div>
              <h2 className="text-lg font-semibold text-white">
                Mediblaster damage model
              </h2>
              <p className="text-xs text-slate-300">Volley timing + output.</p>
              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-300">
                Open model
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </div>
          </a>

          <a
            href="#/soldier-76-pulse-rifle"
            className="group relative flex items-stretch overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-900 shadow-[0_16px_40px_rgba(34,211,238,0.12)] transition hover:-translate-y-1"
          >
            <div className="relative h-[200px] w-[147px] shrink-0">
              <img
                src="https://static.wikia.nocookie.net/overwatch_gamepedia/images/9/92/S76_Stadium.png"
                alt="Soldier 76 Stadium"
                width="294"
                height="400"
                className="block h-[200px] w-[147px]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"></div>
            </div>
            <div className="relative z-10 flex flex-1 flex-col justify-center gap-2 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200">
                Soldier 76
              </div>
              <h2 className="text-lg font-semibold text-white">
                Heavy Pulse Rifle
              </h2>
              <p className="text-xs text-slate-300">
                Ammo mods + burst windows.
              </p>
              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-200">
                Open model
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </div>
          </a>
        </section>
      </main>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
