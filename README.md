# Overwatch Stadium Combat Models

Interactive visualizer suite for Overwatch Stadium weapon cycles. Tune weapon power, attack speed, ammo modifiers, and reload behavior to compare DPS/HPS changes and inspect detailed timing breakdowns.

## Features

- Multi-model landing page with quick navigation
- Side-by-side base vs custom cycle comparison
- Live DPS/HPS, total output, and cycle time stats
- Timeline view with zoom, drag-to-scroll, and labeled phases
- Weapon-specific configuration for ammo, reloads, and special modes
- Mechanics breakdown derived from community analysis

## Models

- **Juno – Mediblaster damage model**: Volley timing, healing vs damage output, and clip mods.
- **Soldier: 76 – Heavy Pulse Rifle**: Ammo mods, Helix burst windows, Super Serum phase, and Chaingun ramping.

## Tech Stack

- React 19
- Vite 7
- Tailwind CSS
- lucide-react icons

## Getting Started

```bash
npm install
npm run dev
```

## Deployment

`npm run deploy` runs the build and publishes `dist` using `gh-pages`.
Visit: https://zero41120.github.io/mediblaster/

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a human-readable summary of recent updates.

## Technical Source

Based on my own technical analysis post in r/JunoMains for the Juno Mediblaster model.

- [View in Reddit](https://www.reddit.com/r/JunoMains/comments/1q3o8lw/technical_analysis_juno_mediblaster/)
- [View in this Repo](https://github.com/zero41120/mediblaster/blob/main/original_analysis.md)
