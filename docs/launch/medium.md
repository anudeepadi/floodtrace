# I rebuilt the Langtang–Trishuli flood in a browser

*What one camera timestamp can and can't tell you about a disaster.*

On the morning of 26 August, a block of rock and ice broke off the north face of Langtang Lirung. Seven minutes later, a surveillance camera at the Gyirong border crossing filmed the surge destroying it. By late morning the flood had run 80 km down the Trishuli. More than 1,450 people died in Nepal.

I wanted to see that morning, not just read about it. I built FloodTrace, a 3D reconstruction on real terrain that you can scrub minute by minute.

[Image: the dashboard at 09:30]

## Where it started

In early October I saw Dilum Sanjaya's wildfire demo on X. Fire spread across terrain while drones tracked hot spots. His terrain was procedural, and someone in the replies asked which elevation model he used. That question stayed with me. The same kind of tool on real ground could help explain an event instead of just showing one.

My first request was a tool for the Nepal tsunami. Nepal has no coast. What I meant was the flood, and that's where the project began.

I built it with Claude Code. I made the calls on scope, data and design. Claude wrote most of the code and the tests.

## Real ground first

The terrain comes from public AWS elevation tiles, with Esri satellite imagery on top. Both load straight into the browser.

There is no surveyed river channel at this resolution. Instead, a shortest-path search runs over the elevation grid. Every step costs more the higher it climbs, so the path settles onto the valley floor. Chained through the towns the flood reached, it becomes a river with a distance at every point.

## One timestamp

The only timed point on the whole river is that camera at Gyirong. The traced route there is 22 km. Covering it in 7 minutes means about 52 m/s, which matches the published estimate for the debris flow.

My first model used one speed curve for the whole river. It couldn't fit the observation, and its fallback had the surge reaching Trishuli Bazar by 09:01. That's not credible.

The fix was to split the river in two. Above Gyirong, the front moves at the speed the camera implies. Below it, the front slows toward a normal flood wave, using the 2021 Chamoli flood in India as a guide. That second part is my assumption, and the app says so.

## Labelling what is real

This is a real disaster. I didn't want the animation to blur what was recorded with what was computed, so every time in the dashboard carries one of three labels.

Observed means a person or an instrument recorded it, like the camera footage or the national SMS alert. Derived means I calculated it from an observation, like the debris speed. Modeled covers everything below Gyirong: arrival times, how high the water rose, how wide it spread. A test makes sure a modeled event can never be marked observed.

## Water that fills the valley

The first version drew the flood as a flat ribbon. It looked like a road.

The version that works lays cross-sections across the valley and puts a water surface at river level plus the surge height. Where the ground is higher than the water, the terrain hides it. The flood's edge ends up following the real valley walls. After the surge passes, a silt mark stays on the slopes.

There is also a follow mode. The camera starts on the glacier and chases the front down the valley. Ridges in the river bends kept hiding the water. The camera now solves for a height where its whole line of sight clears the terrain.

[Image: follow mode above Betrawati]

For presentations, a cinematic layer adds waves, spray and a breaking front. It draws the surge three times taller and keeps a notice on screen while it's on. The numbers never change.

## Where Claude needed correcting

The first design was a blue, glowing dashboard covered in badges. It looked generated, so I asked for black and white. The first water was too thin to see from a normal camera distance. A label fix applied the same offset twice. Each of these showed up in a screenshot, not a test. That's the gap I want to close next.

## What's next

The model needs more observations. Gauge records or timestamped footage from below Gyirong would replace my assumed flood speed with real measurements. Post-event satellite imagery would show the real silt line to check the model against.

FloodTrace is open source. Open the dashboard, press Follow the flood, and the whole morning plays in about a minute.

Live: https://floodtrace-delta.vercel.app
Code: https://github.com/anudeepadi/floodtrace

If you have timed observations from below Gyirong that morning, could you send them my way?

---

*FloodTrace is a reconstruction for understanding what happened. It is not a forecast, and it should not be used for warning or rescue decisions.*

*Tags: Data Visualization, Climate, Nepal, Three.js, GIS*
