# Snore Log

A web app for iPhone that listens overnight and shows when you snored, for how long and how loudly. It runs entirely on the phone: audio and results are stored on the device and never uploaded.

**Open it:** https://kristjohns.github.io/snore-log/

## Using it

1. Open the link in Safari, tap **Share → Add to Home Screen**, and open Snore Log from the Home Screen from then on. A Home Screen app keeps its data separate from Safari's clean-up of unused sites.
2. At bedtime: plug in the charger, put the phone within about 1 m of your head, turn on Sleep or Do Not Disturb, and turn the brightness down. Tag anything different about the night (alcohol, blocked nose, nasal strip…) and tap **Start night**.
3. Leave the screen on. The night screen is black with a dim clock. **Locking the phone stops the recording**, because iOS pauses the microphone for web apps when the screen is off.
4. In the morning, hold the button at the bottom to end the night and see the report.

Use **Test the microphone** first to check that a few fake snores push the snoring bar past the line.

## What the report shows

- **Snoring time.** A minute counts as snoring when it has at least two snore sounds, since snoring repeats with each breath.
- **Loudness**, in dB above the room's own background noise. It isn't an absolute sound level, because phone microphones aren't calibrated. Light is under 15 dB above the room, moderate 15–25 dB, loud over 25 dB.
- **Timeline** of the night, with stretches that weren't recorded marked.
- **Short clips** (12 s, at most one every five minutes and 40 per night, the loudest kept), boosted so they're audible.
- **Other loud sounds** that weren't snoring, such as coughs or talking.
- **History** of snoring per night, and a comparison of nights with and without each tag.

## How detection works

Every 0.5 s the app runs [YAMNet](https://github.com/tensorflow/models/tree/master/research/audioset/yamnet), Google's sound-event model (521 sound classes, including "Snoring"), on the last second of audio, using MediaPipe Audio running as WebAssembly on the phone. A window counts as a snore when its Snoring score passes the sensitivity threshold: 0.5 low, 0.3 normal, 0.15 high.

On 106 clips from the ESC-50 dataset, every one of the 40 snoring clips reached 0.26 or more (39 reached 0.3). Rain, engines, vacuum cleaners, coughs, dogs, footsteps, knocking and clocks all scored about 0. Heavy breathing is the main source of false positives, scoring up to about 0.6 on some frames. If breathing gets counted, set sensitivity to Low.

## Limits

- The screen has to stay on all night (the app asks iOS to keep it awake). A phone call, an alarm or Siri can pause recording; the app shows a **Continue recording** button when that happens.
- A partner's snoring counts too. The app can't tell whose snoring it hears.
- **Not a medical device.** Pauses in breathing, gasping, or strong daytime sleepiness can be signs of sleep apnea; see a doctor about those.

## Development

Plain HTML, CSS and JavaScript modules with no build step. Serve the folder over HTTP (`npx serve .`) and open it; microphone access needs `localhost` or HTTPS.

| Path | What it is |
|---|---|
| `js/listener.js` | Microphone capture (AudioWorklet resampling to 16 kHz) and YAMNet classification |
| `js/analysis.js` | Snore events, per-minute buckets, night summary, tag comparison. No browser APIs |
| `js/session.js` | One night: listener → analysis → IndexedDB, plus clip capture |
| `js/app.js` | Screens and interactions |
| `js/charts.js` | SVG timeline and trend charts |
| `sw.js` | Offline cache. Bump `VERSION` on every release |

Tests:

```sh
npm test                    # analysis logic (Node)
npm run test:clips          # YAMNet over the ESC-50 clips in test/audio (needs the clips)
python3 test/make-night.py test/results/night.wav && npm run test:e2e   # a 5-minute night in headless Chromium
node test/screens.mjs       # screenshots of every screen with two weeks of simulated nights
```

The browser tests use Playwright with Chromium. ESC-50 clips (CC BY-NC) are used for testing only and aren't included in the repository.

## Credits

Snore detection uses the YAMNet model and MediaPipe Audio (`@mediapipe/tasks-audio` 1.0.1), © Google, under the Apache License 2.0 (`vendor/LICENSE-APACHE-2.0.txt`).
