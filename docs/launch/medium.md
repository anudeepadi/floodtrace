# I rebuilt the Langtang–Trishuli flood in a browser

*Subtitle: What one camera timestamp can and cannot tell you about a disaster.*

On the morning of 26 August, a block of rock and ice broke off the north face of Langtang Lirung. The seismic signal was logged at 08:37 Nepal time. Seven minutes later a surveillance camera at the Gyirong border crossing recorded the surge destroying it. By the end of the morning the flood had run 80 km down the Trishuli. More than 1,450 people died in Nepal, and over 5,000 are still missing.

I wanted to see that morning, not just read about it. So I built FloodTrace, a 3D reconstruction on real terrain that you can scrub minute by minute.

[Hero image: dashboard at 09:30]

## Where it started

A few weeks earlier I saw Dilum Sanjaya's wildfire analysis demo on X: fire spreading over terrain, drones tracking hot spots, aircraft dropping retardant. His terrain was procedural, and someone in the replies asked which elevation model he had used. That reply stuck with me. The same kind of tool on real ground would be useful for understanding an event, not just showing one.

I built it with Claude Code as a pair. I made the calls on scope, data and design, and Claude wrote most of the code and tests. That split worked well, and I'll come back to where it needed correcting.

## Real ground first

The terrain is 12 tiles from the AWS Terrain dataset, decoded from PNG colour values into metres. On top sits Esri satellite imagery. Both load straight into the browser, covering a 52 by 69 km box from the glacier to Bidur.

There is no surveyed river channel at this resolution, so the route comes from a shortest-path search over the elevation grid. Each step gets more expensive the higher it is, so the path stays on valley floors. Chained through the settlements the flood hit, it gives an 80.7 km river with a distance at every point.

## One timestamp

This was the most interesting part. The only timed observation on the river is that camera at Gyirong. The route from the collapse to Gyirong is 22 km. Covering that in 7 minutes means an average of 52.4 m/s.

My first model treated the front as a single decaying speed, starting from the published debris estimate of about 52 m/s. It refused to calibrate, because 22 km in 7 minutes needs slightly more than 52 m/s on average. The fallback ran the front at full speed down the whole river and had it reaching Trishuli Bazar by 09:01. That is not credible.

The fix was to stop forcing one curve to do two jobs. Collapse to Gyirong now runs at the speed the observation implies. Below Gyirong the front slows toward a 7 m/s flood wave, which is close to the average speed of the 2021 Chamoli flood in India. That second part is an assumption, and the app says so.

## Labelling what is real

This is a reconstruction of a real disaster, so I didn't want the animation to blur what was recorded and what was computed. Every time in the dashboard has one of three labels:

- **Observed**, for things people or instruments recorded. The 08:44 camera footage, the 09:15 national SMS alert, the casualty figures.
- **Derived**, for things calculated from observations. The 52.4 m/s debris speed. The Betrawati school evacuation, placed 10 minutes before the modeled arrival because the headteacher reported that gap.
- **Modeled**, for everything downstream of Gyirong: arrival times, surge height, flood width.

The data tests check that no model-derived event can be marked observed.

## Water that fills the valley

The first version drew the flood as a flat ribbon. It looked like a road. The version that works builds cross-sections across the valley every 60 m and places a water surface at river bed plus surge height. Wherever the ground is higher than the water, the terrain hides it, so the flood's edge follows the real valley walls. After the surge passes, a silt mark stays on the slopes.

There is also a follow mode. The camera starts on the glacier and chases the front down the valley. The hard part was that ridges in river bends kept hiding the water. Lifting the camera above the highest ground wasn't enough, because the line of sight slopes down to the front. The camera now solves for a height where the whole line clears the terrain.

[Image: follow mode above Betrawati]

For presentations there is a cinematic layer with rolling waves, spray and a breaking front. It draws the surge three times taller and keeps a notice on screen while it is on.

## Where Claude needed correcting

The first design used a blue, glowing dashboard style with badges everywhere. It looked generated, and I asked for black and white. The first water was too thin to see from a normal camera distance. A label overlap fix applied the same offset twice. Each of these showed up in a screenshot, not in a test, which is the main gap I want to close next.

## What's next

The model needs more observations. Gauge records, hydropower CCTV timestamps or dated witness accounts below Gyirong would replace my assumed flood-wave speed with measurements. Post-event Sentinel-2 imagery would show the real silt line to check against. A 2D shallow-water solver would replace the fitted curve with physics.

FloodTrace is open source under MIT. You can open the dashboard, press Follow the flood, and watch the morning in about a minute.

Live: https://floodtrace-delta.vercel.app
Code: https://github.com/anudeepadi/floodtrace

If you work on Himalayan hazards and have timed observations from that morning, I would love to add them.

---

*FloodTrace is a reconstruction for understanding what happened. It is not a forecast and should not be used for warning or rescue decisions.*

*Tags: Data Visualization, Climate, Nepal, Three.js, GIS*
