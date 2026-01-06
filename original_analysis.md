This analysis focuses on how Mediblaster scales with Attack Speed in Overwatch 2 Stadium mode.

After watching some YouTube videos on Attack Speed builds for other heroes, I tried the same with Juno. The results were underwhelming, which made me suspect something else was going on. I spent about 2 days in my workshop collecting data and figuring out how Mediblaster actually works.

If you're interested in my other technical breakdowns, here are some links to past work:

- [Season 5 Defensive Item Guide](https://www.reddit.com/r/JunoMains/comments/1pn5ybh)
- [Reflex Coating/Divine Intervention deep dive](https://www.reddit.com/r/Overwatch/comments/1pj2x2o)
- [Three-Tap Tommy Gun deep dive](https://www.reddit.com/r/OverwatchUniversity/comments/1nmmu8u)
- [Armor mechanics deep dive](https://www.reddit.com/r/Overwatch/comments/1n4k71l)
- [Codebreaker (anti-armor) deep dive](https://www.reddit.com/r/JunoMains/comments/1kv2hoc)
- [Juno Ultimate deep dive](https://www.reddit.com/r/JunoMains/comments/1pw36b4)

### TLDR

After hours of workshop testing, this JavaScript function closely models Juno Mediblaster's actual DPS/HPS:

```javascript
const mediblasterOutput = (wp = 1, as = 1, bullet = 7.5) => {
  const k = 10800 * bullet * wp;
  const d = Math.ceil(18 / as) + 14 * Math.ceil(27 / as) + 387;
  return k / d;
};

mediblasterOutput(1, 1, 7.5); // ~103 DPS
mediblasterOutput(1, 1, 6); // ~82 HPS

mediblasterOutput(1.5, 1, 7.5); // ~155 DPS 50% WP
mediblasterOutput(1, 1.5, 7.5); // ~124 DPS 50% AS

mediblasterOutput(1.5, 1, 6); // ~124 HPS 50% WP
mediblasterOutput(1, 1.5, 6); // ~99 HPS 50% AS
```

With 50% stat investment in Stadium:

- 158.45 DPS with 50% Weapon Power, matching expected gain
- 127.72 DPS with 50% Attack Speed, only 20.9% gain

Attack speed is objectively less effective than weapon power for Juno Mediblaster in Stadium.

| Attack Speed | DPS    | DPS Gain (Value) | DPS Gain (%) | DPS % per 5% AS |
| ------------ | ------ | ---------------- | ------------ | --------------- |
| 100%         | 103.45 | +0.00            | +0.00%       | 0.000%          |
| 105%         | 105.33 | +1.88            | +1.82%       | 1.821%          |
| 110%         | 107.43 | +3.98            | +3.85%       | 1.923%          |
| 115%         | 109.61 | +6.16            | +5.95%       | 1.985%          |
| 120%         | 111.88 | +8.43            | +8.15%       | 2.037%          |
| 130%         | 116.55 | +13.10           | +12.66%      | 2.110%          |
| 140%         | 119.12 | +15.67           | +15.15%      | 1.893%          |
| 150%         | 124.42 | +20.98           | +20.28%      | 2.028%          |

---

Here is the nerd part.

### Intuition

If you gain 10% attack speed, you'd expect 10% more attacks and 10% more DPS and HPS. But that's not how it works for Juno's Mediblaster. In fact, it likely doesn't hold for many other heroes either. Heroes with beam or continuous damage (like Moira or Soldier 76) get full value from attack speed. Heroes with fix animation time per shot (like Pharah or Juno) benefit much less, especially Juno, since her weapon fires in burst intervals.

### Server tickrate

While there's no official documentation, testing and community sources suggest Overwatch 2 servers run at 60 ticks per second (TPS).

- Each frame is 1/60 second, or 16.67 milliseconds.
- Events only occur at 0.01667-second intervals.
- Time-based events like attack speed must cross these intervals to have any effect.
- Quantized events can still work even if they don't align exactly, causing timing variation but consistent average results.

### Mediblaster Overview

- Clip size: 180
- 12 bullets per volley
- 15 volleys per clip
- Damage per bullet: 7.5 - 2.25
- Damage per volley: 90 - 27
- Headshot multiplier: x1.5 (damage only, no effect on healing)
- Healing per bullet: 6 - 1.8
- Healing per volley: 72 - 21.6
- Reload time: 1.5 seconds (90 frames)
- Falloff range: 25 - 35 meters, linear
  - For more on falloff mechanics, see [Mablr's video](https://youtu.be/VL2VnkNJPpE?si=zrG8QOXeG-pcGVuW)

### Data Collection

![log screenshot](https://i.imgur.com/or2VAnn.jpeg)

Using my workshop (code `7x3py`), I set up a test system to log Juno's damage output:

- 5000 HP Roadhog used as the target for sustained damage tests
- Takes exactly 666 shots to eliminate (no headshots)
- First damage logs the start time
- Each hit after that logs time and calculates DPS
- Continuous fire until Roadhog is eliminated
- Tested with: no items, 50% weapon power (no secondary effects), and 50% attack speed (no secondary effects)
- Each scenario was repeated multiple times to get an average

**Core findings:**

- Sustained DPS to deal 5000 damage stays around 100–105
- With 50% weapon power, DPS rises linearly to 157–163, close to the expected 150%
- With 50% attack speed, DPS only reaches 126–130, well below expectation
- Overwatch Wiki lists Juno's DPS as 116.28 (98.3 with reload), but actual sustained testing shows closer to 103.

This supports the earlier observation, attack speed builds underperform for Juno. The next question is, why?

### Technical analysis

Now with the log data collected, I proceeded to analyze the data to understand what is going on under the hood.

#### Reload timing

![reload screenshot](https://i.imgur.com/9zbgXnQ.png)

Reload is officially listed as 1.5s, but there's more to it. The data shows:

- Reload time is exactly 1.5s
- There's an additional 0.3s (18 frames) delay after reload before Juno can fire again—referred to here as "cocking" time (despite mediblaster does not have a cocking animation).
- This delay scales with attack speed. At 50% attack speed, it drops to 0.2s (12 frames)

Relevant log

```txt
// No modifier
[00:00:29] Shot 179 | dt: 0.03 | Dmg 7.50 | Tot 1342.50 | DPS 119.52
[00:00:29] Shot 180 | dt: 0.05 | Dmg 7.50 | Tot 1350 | DPS 119.68
[00:00:31] Shot 181 | dt: 1.79 | Dmg 7.50 | Tot 1357.50 | DPS 103.98 // Delta time includes reload + cocking time

// 50% attack speed
[00:01:32] Shot 179 | dt: 0.05 | Dmg 7.50 | Tot 1342.50 | DPS 148.24
[00:01:32] Shot 180 | dt: 0.01 | Dmg 7.50 | Tot 1350 | DPS 148.83
[00:01:34] Shot 181 | dt: 1.70 | Dmg 7.50 | Tot 1357.50 | DPS 126.07 // Delta time reduced by 0.1s

// 100% attack speed with Gravitation Push (+25%) and Pluse Spike (+35%) active
// Shoot until 12 ammo left, then Glide + Torpedoes for 100% attack speed.
[00:03:17] Shot 1 | dt: 0 | Dmg 85 | Tot 85 | DPS 84999.99 // Torpedoes hit
[00:03:18] Shot 13 | dt: 0.05 | Dmg 8.63 | Tot 188.50 | DPS 267.38
[00:03:19] Shot 14 | dt: 1.65 | Dmg 8.63 | Tot 197.13 | DPS 83.78 // Delta time is reduced by 0.15s
[00:03:19] Shot 15 | dt: 0.01 | Dmg 8.63 | Tot 205.75 | DPS 86.89
```

We can express the cocking time scaling with attack speed as:

```javascript
const BASE_FRAME = 18;
const valueScaleWithAttackSpeed = (attackSpeedBonus) =>
  Math.ceil(BASE_FRAME / (1 + attackSpeedBonus));

valueScaleWithAttackSpeed(0); // 18 (0.3s)
valueScaleWithAttackSpeed(0.5); // 12 (0.2s)
valueScaleWithAttackSpeed(1); // 9 (0.15s)
```

### Volley timing

- Each bullet hit has a delay between 0 and 0.05s due to the server's 60 TPS tickrate. This quantization causes minor timing variation. Sometimes two hits register in the same tick, but the average stays around 0.03s per shot, likely the intended value.
- Measured average DPS is 105, higher than the wiki's 98.3. This is probably because the wiki lists a flat rate of fire (1.29 shots/s), which doesn't reflect Juno's volley-based firing and the weapon recovery time between volleys.
- A 12-shot volley takes 0.32s (19 frames) to complete.
- This volley timing does **NOT** scale with attack speed, which is the main reason attack speed is much less effective than weapon power for Juno.

Relevant log

```txt
// Test 1
[00:00:21] Shot 1 | dt: 0 | T: 0 | Dmg 7.50 | Tot 7.50 | DPS 7500.00
[00:00:21] Shot 2 | dt: 0.02 | T: 0.02 | Dmg 7.50 | Tot 15 | DPS 882.34
[00:00:22] Shot 3 | dt: 0.05 | T: 0.07 | Dmg 7.50 | Tot 22.50 | DPS 346.15
[00:00:22] Shot 4 | dt: 0.02 | T: 0.08 | Dmg 7.50 | Tot 30 | DPS 374.99
[00:00:22] Shot 5 | dt: 0.03 | T: 0.11 | Dmg 7.50 | Tot 37.50 | DPS 331.86
[00:00:22] Shot 6 | dt: 0.05 | T: 0.16 | Dmg 7.50 | Tot 45 | DPS 279.50
[00:00:22] Shot 7 | dt: 0.01 | T: 0.18 | Dmg 7.50 | Tot 52.50 | DPS 298.29
[00:00:22] Shot 8 | dt: 0.03 | T: 0.21 | Dmg 7.50 | Tot 60 | DPS 287.08
[00:00:22] Shot 9 | dt: 0.01 | T: 0.22 | Dmg 7.50 | Tot 67.50 | DPS 301.34
[00:00:22] Shot 10 | dt: 0.05 | T: 0.27 | Dmg 7.50 | Tot 75 | DPS 274.72
[00:00:22] Shot 11 | dt: 0.01 | T: 0.29 | Dmg 7.50 | Tot 82.50 | DPS 286.46
[00:00:22] Shot 12 | dt: 0.03 | T: 0.32 | Dmg 7.50 | Tot 90 | DPS 281.25 // Observe duration is 0.32s for 12 shots

// Test 2
[00:01:44] Shot 1 | dt: 0 | T: 0 | Dmg 7.50 | Tot 7.50 | DPS 7500.00
[00:01:44] Shot 2 | dt: 0.03 | T: 0.03 | Dmg 7.50 | Tot 15 | DPS 454.58
[00:01:44] Shot 3 | dt: 0.01 | T: 0.05 | Dmg 7.50 | Tot 22.50 | DPS 468.78
[00:01:44] Shot 4 | dt: 0.03 | T: 0.08 | Dmg 7.50 | Tot 30 | DPS 370.36
[00:01:44] Shot 5 | dt: 0.05 | T: 0.13 | Dmg 7.50 | Tot 37.50 | DPS 290.70
[00:01:44] Shot 6 | dt: 0.01 | T: 0.14 | Dmg 7.50 | Tot 45 | DPS 312.51
[00:01:44] Shot 7 | dt: 0.03 | T: 0.18 | Dmg 7.50 | Tot 52.50 | DPS 296.61
[00:01:44] Shot 8 | dt: 0.01 | T: 0.19 | Dmg 7.50 | Tot 60 | DPS 312.50
[00:01:44] Shot 9 | dt: 0.03 | T: 0.22 | Dmg 7.50 | Tot 67.50 | DPS 300.00
[00:01:44] Shot 10 | dt: 0.05 | T: 0.27 | Dmg 7.50 | Tot 75 | DPS 274.72
[00:01:45] Shot 11 | dt: 0.01 | T: 0.29 | Dmg 7.50 | Tot 82.50 | DPS 286.46
[00:01:45] Shot 12 | dt: 0.03 | T: 0.32 | Dmg 7.50 | Tot 90 | DPS 280.37 // 0.32s for 12 shots

// Test 3
[00:02:15] Shot 1 | dt: 0 | T: 0 | Dmg 7.50 | Tot 7.50 | DPS 7500.00
[00:02:15] Shot 2 | dt: 0.03 | T: 0.03 | Dmg 7.50 | Tot 15 | DPS 454.48
[00:02:15] Shot 3 | dt: 0.01 | T: 0.05 | Dmg 7.50 | Tot 22.50 | DPS 468.71
[00:02:15] Shot 4 | dt: 0.03 | T: 0.08 | Dmg 7.50 | Tot 30 | DPS 370.33
[00:02:15] Shot 5 | dt: 0.05 | T: 0.13 | Dmg 7.50 | Tot 37.50 | DPS 290.70
[00:02:15] Shot 6 | dt: 0.01 | T: 0.14 | Dmg 7.50 | Tot 45 | DPS 312.51
[00:02:15] Shot 7 | dt: 0.03 | T: 0.18 | Dmg 7.50 | Tot 52.50 | DPS 296.61
[00:02:15] Shot 8 | dt: 0.01 | T: 0.19 | Dmg 7.50 | Tot 60 | DPS 312.50
[00:02:15] Shot 9 | dt: 0.03 | T: 0.23 | Dmg 7.50 | Tot 67.50 | DPS 299.99
[00:02:15] Shot 10 | dt: 0.05 | T: 0.27 | Dmg 7.50 | Tot 75 | DPS 274.71
[00:02:15] Shot 11 | dt: 0.01 | T: 0.29 | Dmg 7.50 | Tot 82.50 | DPS 286.45
[00:02:15] Shot 12 | dt: 0.03 | T: 0.32 | Dmg 7.50 | Tot 90 | DPS 280.37 // 0.32s for 12 shots
```

### Weapon recovery time

After each volley, there's a delay before the next one begins. This is referred to as "weapon recovery time".

- Recovery time is 0.45s (about 27 frames), with a ±1 frame variance from server tickrate quantization.
- This delay **does scale** with attack speed. At 50% attack speed, it's reduced to 0.3s (18 frames).
- For heroes like Soldier 76, every bullet has a consistent recovery time between shots, so attack speed scales fully.
- For Juno, since volley timing doesn't scale, and attack speed only shortens recovery time, the overall benefit is much lower.

Relevant log

```txt
// No attack speed, the delta time between volley is 0.45
[00:00:18] Shot 13 | dt: 0.47 | Dmg 7.50 | Tot 97.50 | DPS 126.95
[00:00:19] Shot 25 | dt: 0.43 | Dmg 7.50 | Tot 187.50 | DPS 122.07
[00:00:20] Shot 37 | dt: 0.47 | Dmg 7.50 | Tot 277.50 | DPS 118.79
[00:00:21] Shot 49 | dt: 0.43 | Dmg 7.50 | Tot 367.50 | DPS 118.40
[00:00:21] Shot 61 | dt: 0.46 | Dmg 7.50 | Tot 457.50 | DPS 117.19
[00:00:22] Shot 73 | dt: 0.43 | Dmg 7.50 | Tot 547.50 | DPS 117.19

// 50% attack speed, the delta time is reduced
[00:01:24] Shot 13 | dt: 0.29 | Dmg 7.50 | Tot 97.50 | DPS 156.25
[00:01:24] Shot 25 | dt: 0.29 | Dmg 7.50 | Tot 187.50 | DPS 150.24
[00:01:25] Shot 37 | dt: 0.29 | Dmg 7.50 | Tot 277.50 | DPS 148.32
[00:01:25] Shot 49 | dt: 0.29 | Dmg 7.50 | Tot 367.50 | DPS 147.29
[00:01:26] Shot 61 | dt: 0.29 | Dmg 7.50 | Tot 457.50 | DPS 146.68
[00:01:27] Shot 73 | dt: 0.29 | Dmg 7.50 | Tot 547.50 | DPS 145.61
```

### Attack speed quantization

Weapon recovery time scales with attack speed, but that scaling is limited by server framerate.  
If the reduced value doesn't result in a full frame difference, there's no actual effect.

- Example: at 50% attack speed, Juno's recovery time is 18 frames. At 55%, the calculated value is 27 / 1.55 = 17.42 frames, which rounds up to 18. No change.
- Since attack speed increases in 5% steps, values like 55%, 75%, 85%, and 90% are effectively "wasted" for Juno.

Relevant log

```txt
// At 50% attack speed, never 0.26s recovery time (18 frame)
[00:26:59] Shot 13 | dt: 0.32 | T: 0.62 | Dmg 7.50 | Tot 97.50 | DPS 156.24
[00:26:59] Shot 25 | dt: 0.31 | T: 1.23 | Dmg 7.50 | Tot 187.50 | DPS 152.18
[00:27:00] Shot 37 | dt: 0.29 | T: 1.86 | Dmg 7.50 | Tot 277.50 | DPS 149.51
[00:27:01] Shot 49 | dt: 0.29 | T: 2.48 | Dmg 7.50 | Tot 367.50 | DPS 148.18

// At 55% attack speed, never 0.26s recovery time (18 frame instead of 17 frame)
[00:27:12] Shot 13 | dt: 0.29 | T: 0.62 | Dmg 7.50 | Tot 97.50 | DPS 156.24
[00:27:12] Shot 25 | dt: 0.29 | T: 1.23 | Dmg 7.50 | Tot 187.50 | DPS 152.18
[00:27:13] Shot 37 | dt: 0.29 | T: 1.86 | Dmg 7.50 | Tot 277.50 | DPS 149.51
[00:27:14] Shot 49 | dt: 0.31 | T: 2.48 | Dmg 7.50 | Tot 367.50 | DPS 148.25

// At 60% attack speed, 1 frame reduction (17 frame)
[00:32:59] Shot 13 | dt: 0.26 | T: 0.57 | Dmg 7.50 | Tot 97.50 | DPS 169.58
[00:33:00] Shot 25 | dt: 0.27 | T: 1.18 | Dmg 7.50 | Tot 187.50 | DPS 158.37
[00:33:00] Shot 37 | dt: 0.27 | T: 1.79 | Dmg 7.50 | Tot 277.50 | DPS 154.86
[00:33:01] Shot 49 | dt: 0.29 | T: 2.42 | Dmg 7.50 | Tot 367.50 | DPS 152.11
```

### Function expression

The TLDR section includes a simplified function for quick reference. For those interested in the full breakdown, here's the complete JavaScript function modeling Juno's Mediblaster DPS/HPS in Stadium.

The simplified version pre-calculates fixed elements: a 180-round clip includes 14 recovery pauses (between volleys) and 165 intra-burst delays. These, along with reload time, are summed into a constant `387`. This leaves only the animation-based delays (cocking and recovery) exposed to `Math.ceil` rounding, which is affected by attack speed.

```javascript
function mediblasterOutput(
  bulletValue = 7.5,
  weaponPower = 100,
  attackSpeed = 100,
  clipSize = 180,
  withReload = true
) {
  const TPS = 60;
  const RELOAD_FRAMES = withReload ? 1.5 * TPS : 0;
  const COCKING_FRAMES = 0.3 * TPS;
  const RECOVERY_FRAMES = 0.45 * TPS;
  const INTRA_BURST_INTERVAL_FRAMES = 0.03 * TPS;
  const VOLLEY_SIZE = 12;

  const attackSpeedPercent = attackSpeed / 100;
  const weaponPowerPercent = weaponPower / 100;
  const cockingFrames = Math.ceil(COCKING_FRAMES / attackSpeedPercent);

  let cycleFrames = RELOAD_FRAMES + cockingFrames;
  const singleRecoveryFrame = Math.ceil(RECOVERY_FRAMES / attackSpeedPercent);
  for (let i = 1; i <= clipSize; i++) {
    const isFirstBulletOfVolley = (i - 1) % VOLLEY_SIZE === 0;
    if (!isFirstBulletOfVolley) cycleFrames += INTRA_BURST_INTERVAL_FRAMES;
    const isEndOfVolley = i % VOLLEY_SIZE === 0;
    const hasAmmoLeft = i < clipSize;
    if (isEndOfVolley && hasAmmoLeft) cycleFrames += singleRecoveryFrame;
  }

  const totalDamage = clipSize * bulletValue * weaponPowerPercent;

  return totalDamage * (TPS / cycleFrames);
}
```

We can write the full firing cycle in frames as a closed form.

Total cycle frames:

```txt
C(AS) = F_fixed + F_scaled(AS)

// Fixed frames, never affected by attack speed:
F_fixed = RELOAD_FRAMES + (clip - V) * INTRA_BURST_INTERVAL_FRAMES

// Attack speed scaled frames:
F_scaled(AS) = ceil(COCKING_FRAMES / s) + R * ceil(RECOVERY_FRAMES / s)


// For Juno
F_fixed = 90 + (180 - 15) * 1.8 = 387
F_scaled(AS) = ceil(18 / AS) + 14 * ceil(27 / AS)

// Total cycle:
C(AS) = 387 + ceil(18 / AS) + 14 * ceil(27 / AS)
```

If we ignore frame rounding and replace ceil(x) with x: `C_theory(AS) = 387 + (396 / AS)`

Only the 396 / AS term scales. The 387 frames are a hard floor.
Only about 50.6 percent of the cycle is scalable at base case (AS=1).

## Conclusion

The testing and modeling show that attack speed is fundamentally weak on Juno in Stadium, not because of bugs or bad math, but because of how her weapon is structured.

Most of Juno's firing cycle is fixed-time. Reload, intra-burst spacing, and volley execution do not scale with attack speed. Only two parts do: the post-reload delay and the between-volley recovery time. Together, these account for roughly half of the total cycle at baseline, which already caps the theoretical max value of attack speed to about 50% effectiveness. In actual weapon model, much lower due to many factors.

On top of that, attack speed scaling is quantized by server tickrate. Because recovery and cocking times are rounded to whole frames, some 5% attack speed increments produce no real change at all. Portions of investment end up with no effect until a threshold is crossed, at which point DPS jumps by only small amounts. This explains why some attack speed values feel completely wasted.

Weapon power does not suffer from either limitation. It scales all damage directly, applies to every bullet, and is not subject to frame rounding. As a result, weapon power behaves exactly as players expect, while attack speed consistently underperforms.

In short:

- Juno's volley timing does not scale with attack speed
- Only recovery and cocking delays scale, and they are a minority of the cycle
- Frame rounding causes frequent dead zones in attack speed investment
- Weapon power scales cleanly, smoothly, and fully

For Stadium builds, weapon power is objectively the stronger stat for Juno's Mediblaster. Attack speed has a hard ceiling, heavy quantization, and diminishing returns that make it a poor primary investment.

---

### Side note

While weapon power is not the main focus here, but I will point out how conditional "more"-labeled items do.

Items like Long Range Blaster (Mediblaster deals 15% more damage and healing beyond 12 meters) and Vantage Shot (Mediblaster deals 15% more damage while airborne), along with other "more X% when Y condition" general items, stack together as a single multiplier.

For example, if you take Long Range Blaster and Vantage Shot, have 40% weapon power, and shoot beyond 12 meters while airborne, the effective weapon multiplier becomes:

```txt
1 * (1 + 0.4) * (1 + 0.15 + 0.15) = 1.82
```

That's an effective 82% increase to DPS under those conditions.
