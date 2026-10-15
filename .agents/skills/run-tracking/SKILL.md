---
name: run-tracking
description: GPS run tracking in the NutriDuo PWA (Mis salidas). Use when touching src/services/runTracker.ts, the run screens, route maps or their tests.
---

# Run tracking in a PWA

## What the web platform allows

- `navigator.geolocation.watchPosition` with `enableHighAccuracy: true, maximumAge: 0`. Works only while the page is visible: there is no background GPS for web apps on iOS or Android. Keep the screen on with the Screen Wake Lock API and re-acquire it on `visibilitychange`.
- iOS: the user must allow location for Safari/the home-screen app with "Precise Location" on. Motion sensors need `DeviceMotionEvent.requestPermission()` from a tap.
- Voice cues: `speechSynthesis` with an `es-AR`/`es` voice. Haptics: `navigator.vibrate` (Android only).
- Persist the in-progress run every few seconds so a reload can resume it.

## Turning noisy fixes into good numbers

- Reject fixes with accuracy worse than ~25 m (allow up to 40 m for the very first lock) and fixes implying impossible speed for the activity.
- Smooth lat/lng with a small Kalman filter whose measurement variance is the reported accuracy squared.
- Do not add distance for movement smaller than the noise (about half the accuracy, min 2 m): this kills drift while standing.
- Auto-pause after ~10 s without real movement; moving time is what pace uses.
- Current pace = last ~200 m or 30 s window; average pace = moving time / distance; splits every 1000 m.
- Elevation gain only from fixes with good `altitudeAccuracy`, with a 3 m hysteresis.
- Store the route as an encoded polyline (5 decimals) after removing points closer than 5 m.

## Maps (free)

- Raster tiles from `tile.openstreetmap.org` (CARTO now needs an API key). Respect the OSM tile policy: show "© OpenStreetMap", no prefetching or bulk downloads. Recolor with CSS filters (dark mode: invert + hue-rotate) plus a profile-color tint. Web Mercator math is done by hand and the route is SVG on top; without network the route still draws on the plain background.

## Testing

- Unit-test the pure session logic with synthetic tracks (straight line, standing jitter, a GPS jump, crossing km marks).
- Playwright: `context.grantPermissions(["geolocation"])` and `context.setGeolocation({ latitude, longitude, accuracy })` step by step to simulate a run.

## Import, heart rate and sharing

- `src/services/runImport.ts` reads the adidas Running export (.zip with `Sport-sessions/*.json` and `GPS-data/*`), session JSON files and any GPX, using a small zip reader on `DecompressionStream`. Duplicates (same start within 2 min, or same day, distance and duration) are skipped; bikes and swims are ignored.
- `src/services/heartRate.ts` connects standard BLE heart-rate monitors with Web Bluetooth (Chrome on Android/desktop only). A Galaxy Watch needs a watch app that broadcasts its pulse as a BLE heart-rate sensor.
- `src/services/runShare.ts` draws 1080×1920 story images (photo, map, color, transparent sticker) on a canvas; OSM tiles load with CORS. Share with `navigator.share({ files })`, falling back to a download.
