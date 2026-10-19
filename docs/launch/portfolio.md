# Portfolio entry

Copy as published to heyadi.dev/work/floodtrace (see `app/data/products.ts` in personal-portfolio).

- **Name:** FloodTrace
- **Tagline:** Trace the Langtang–Trishuli flood, minute by minute.
- **Summary (card):** A 3D reconstruction of the 2026 Langtang–Trishuli flood in Nepal, on real terrain, calibrated to the one travel time anyone observed.
- **Status:** Open source

## About

FloodTrace rebuilds the morning of 26 August 2026, when a rock and ice collapse on Langtang Lirung sent a flood 80 km down the Trishuli. It runs in the browser on AWS elevation tiles and Esri imagery, with a timeline you can scrub from 08:30 to 12:30.

The only timed point on the river is a camera at the Gyirong crossing, 7 minutes after the collapse. The model reproduces it exactly and labels everything downstream as modeled.

## Features

- **Real ground.** Elevation and satellite tiles load in the browser. The river route is a least-cost path that keeps to the valley floor.
- **Every number labelled.** Times are marked observed, derived or modeled, and each site's facts link to their source.
- **Follow the flood.** The camera chases the front from the glacier to Devighat, rising over ridges that would block the view.

## Profile README lineup entry (position 4)

### [FloodTrace](https://github.com/anudeepadi/floodtrace)

A 3D reconstruction of the 2026 Langtang–Trishuli flood on real terrain. [Open the dashboard](https://floodtrace.vercel.app/app/) and press Follow the flood. Times below the Gyirong crossing are modeled, and the app labels them that way.
