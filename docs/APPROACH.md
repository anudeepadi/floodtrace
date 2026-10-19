# How FloodTrace was built

This is the working record: what I set out to do, the decisions along the way, and the parts that did not work the first time. Built in October 2026 with Claude Code (Opus 5.5) as a pair.

## Starting point

It began with [Dilum Sanjaya's wildfire analysis demo](https://x.com/DilumSanjaya): fire spreading over terrain, drones tracking hot spots, aircraft dropping retardant. His terrain was procedural. The first thing I built was a single-file copy of that idea to see how far a browser could go. It lives in `experiments/wildfire-prototype/`.

The next question was whether the same kind of tool could describe a real event. My first ask was a "Nepal tsunami". Nepal has no coast, so that made no sense as stated. The closest real phenomenon is a glacial lake outburst flood, often called a Himalayan tsunami. When I said I meant the recent Nepal flood, a search turned up the 26 August 2026 Langtang Lirung collapse. That became the subject.

## Principles

**Real data where it exists.** Terrain and imagery come from public tile services. Facts come from cited sources. Nothing about the place is procedural.

**Label everything.** A reconstruction of a disaster that killed more than 1,450 people should not blur the line between what was recorded and what was computed. Every time in the app is `observed`, `derived` or `modeled`, and the landing page explains each.

**One observation is enough to calibrate, not to validate.** The only timed point on the river is the Gyirong camera at 08:44. The model reproduces it exactly. Nothing downstream is checked against measurements yet, and the app says so.

## Architecture

Vite, strict TypeScript and three.js, with no framework. The UI is a few hundred lines of DOM code behind a tiny immutable store. Pure logic (projection, routing, the flood model, camera pacing) has no three.js imports and is unit tested. Rendering code is checked by screenshots.

```
tiles (AWS DEM, Esri imagery)
  └─ heightfield ─┬─ least-cost route ── chainage (km)
                  │                         └─ flood model: arrival, stage, max stage
                  └─ corridor cross-sections ── water sheet, silt mark, spray emitter
store (time, selection, layers) ── panels, timeline, charts, follow camera
```

## Decisions and what went wrong

### Terrain from tiles, not a mesh file

AWS Terrain Tiles encode elevation in PNG colour channels (Terrarium format). Twelve zoom-11 tiles cover 52 × 69 km, about 67 m per pixel. They load straight into a canvas, decode to metres, and become a 768 × 1024 plane. Esri imagery at zoom 13 drapes over it. Both hosts send permissive CORS headers, so the deployed site needs no proxy and stores no tiles.

Early versions downloaded tiles at build time. That would have meant redistributing Esri imagery, so the loader now fetches at runtime.

### A route water would take

There is no surveyed channel at this resolution, so the route comes from Dijkstra over the elevation grid. Each step costs its length times `1 + 200·h³`, where `h` is normalised elevation. Ridges become very expensive and valley floors stay cheap. Chaining the search through known settlements (collapse site, Gyirong, Timure, Syafrubesi, Mailung, Betrawati, Bidur, Devighat) gives an 80.7 km route.

A unit test builds a ridge with a single low pass and checks the path goes through the pass. That test caught a cost function that was too flat in the first draft.

### The calibration problem

The first model was a single exponential decay from the 52 m/s debris estimate, solved so that the front reached Gyirong in 7 minutes. It reported "uncalibrated". The traced route to Gyirong was 22.4 km, which needs an average of 53.3 m/s, just above the estimate. The fallback ran the front at 52 m/s along the whole river and put the surge at Trishuli Bazar at 09:01, which is not credible.

Removing a guessed waypoint only shortened the route to 22.0 km. So the route length was real, and the model shape was wrong. The fix was two phases:

1. Collapse to Gyirong at the constant speed the observation implies: 22.0 km in 420 s, 52.4 m/s. The app shows this beside the published ~52 m/s estimate as a sanity check.
2. Below Gyirong, `v(s) = vMin + (v1 − vMin)·e^(−(s − d)/L)`, with a 7 m/s floor (close to the 2021 Chamoli flood's mean) and a 12 km decay length. Both are assumptions and are named as such.

Arrival time has a closed form in both phases, so the front position is a bisection on that function. A test checks that `frontKm(arrivalMin(x)) ≈ x`, which keeps the map and the timeline in agreement.

### Following the front

The chase camera sits behind and to the side of the front, looking slightly ahead. Two problems showed up in screenshots.

First, the debris flow covered 22 km in under two seconds of playback. Playback now runs at a rate that keeps the front moving about 1.4 km per second on screen, which is slow for the debris and fast for the flood wave.

Second, ridges in river bends hid the water. Raising the camera above the highest ground on the sight line was not enough, because the line slopes down to the front. The camera height is now solved so that the straight line from eye to front clears every sampled point: `eyeY·(1 − k) + frontY·k ≥ terrain(k) + margin`.

### Water that fills the valley

The first water was a flat ribbon of fixed width. It looked like a road. The second version builds cross-sections every 60 m, 2.8 km wide, and places a water sheet at bed level plus surge height across each one. Depth testing does the rest: wherever terrain is higher than the water, the terrain wins, so the shoreline follows the real valley walls.

The water base per section is the lowest ground near the centre line, smoothed and clamped so it never rises downstream. A test checks that the river cannot flow uphill through DEM noise.

A custom shader adds advected ripples, Fresnel reflection, sun glints and foam at the banks and the front. Water colour goes from grey-green for the normal glacial river to opaque brown during the surge. The terrain shader reads the highest stage reached at each section from a 1D data texture and leaves a silt mark on the slopes.

### Design

The first dashboard used a blue Palantir-style palette with glows, gradients and badges. It looked generated. The current version is black and white with system fonts, plain text labels on the map, and one red for the wave front, impacted sites and loss of life. Certainty is shown by fill (solid, outline, dashed) instead of colour. The satellite terrain keeps its colour, which turned out to be the right contrast against a monochrome interface.

### Cinematic water

For presentations there is an optional layer that draws the surge three times taller, adds three downstream wave trains with peaked crests, a breaking wall at the front, spray and debris particles that travel with the front, and a slight camera rumble. A notice stays on screen while it is on. The charts, ETAs and inspector never use the exaggerated values.

## Testing

60 unit tests across Web Mercator maths, the heightfield, the least-cost route, the corridor, the flood model, follow pacing, cinematic heights, the store and the incident data. The data tests check that every site and event cites a known source, and that no model-derived event is ever marked observed.

The 3D scene and panels are verified by screenshots at fixed times (08:43, 09:30, 09:42), not by automated tests. That is the biggest gap.

## Known limits

- 67 m elevation cannot resolve the river channel, so the normal river is drawn 14 m above the DEM valley floor.
- Site coordinates are approximate to 1–2 km.
- Surge height decays exponentially from 80 m at the source. The 80 m figure is reported. The decay is not.
- Up close the imagery blurs, because each pixel covers about 19 m.
