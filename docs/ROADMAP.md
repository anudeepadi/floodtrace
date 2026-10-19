# Roadmap

Ordered by how much each item would improve the accuracy of the reconstruction.

## 1. Downstream observations

The model has one timed point. Gauge records from the Department of Hydrology and Meteorology, CCTV timestamps from hydropower sites, and dated witness accounts would each add a calibration point below Gyirong. With three or four, the 7 m/s floor and 12 km decay stop being assumptions.

## 2. Post-event imagery

Sentinel-2 scenes from late August 2026 show the real silt line and the extent of the debris. Draping one as a toggle beside the modeled silt mark would show where the model is wrong.

## 3. A physical flood model

Replace the fitted stage curve with a 2D shallow-water solver (for example, a GPU implementation of the Saint-Venant equations) over a finer DEM such as ALOS 30 m or a 12 m TanDEM-X product. Inundation would come from mass and momentum rather than an exponential.

## 4. Finer terrain near settlements

Higher-zoom tiles around Syafrubesi, Betrawati and Trishuli Bazar would resolve the channel and the settlements on its banks.

## 5. Other incidents

The pipeline needs a tile box, a list of sites with sources, and one observed travel time. Chamoli (Uttarakhand, February 2021) and Melamchi (Nepal, June 2021) both have published timelines.

## 6. Engineering

- Automated visual tests for the scene at fixed times
- Code-split three.js out of the landing page bundle
- Offline tile cache for workshops without connectivity
- A recording mode that exports the follow flythrough as video
