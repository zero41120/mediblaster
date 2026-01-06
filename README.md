# Mediblaster Visualizer

Interactive visualizer for Juno's Mediblaster weapon cycle. Tune weapon power, attack speed, clip modifiers, and reload behavior to see DPS/HPS changes and a detailed timing breakdown.

## Features

- Side-by-side base vs custom cycle comparison
- Live DPS/HPS, total output, and cycle time stats
- Timeline view with zoom, drag-to-scroll, and labeled phases
- Clip size modifier toggles and mode switch (healing vs damage)
- Mechanics breakdown derived from community analysis

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

## Technical Source

Based on my own technical analysis post in r/JunoMains

- [View in Reddit](https://www.reddit.com/r/JunoMains/comments/1q3o8lw/technical_analysis_juno_mediblaster/)
- [View in this Repo](https://github.com/zero41120/mediblaster/blob/main/original_analysis.md)
