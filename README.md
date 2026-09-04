# Moodwave — mood internet radio

A single-file web app that streams SomaFM stations grouped by mood (Chill, Focus, Energy, Retro). Open it in any modern browser — no build step, no backend, no install.

**Live:** `https://colder-medusa.github.io/moodwave/moodwave.html`

## What it does

- Pick a mood (Chill / Focus / Energy / Retro) and choose a station from that mood.
- Press play; the LCD readout, VU meters, and status line give feedback.
- Volume slider, play/pause, and a ✦ "surprise me" button that picks a random station in the current mood.
- Add your own stations by URL and pin favorites that surface across moods.
- Recently played tiles (last 5) let you jump back.

## Controls

| Input | Action |
|---|---|
| **Space** | Play / pause |
| **← →** | Cycle stations in the current mood |
| **↑ ↓** | Switch moods |
| **S** | Surprise me (random station in current mood) |
| **Text input focus** | Arrow keys still control the volume slider |

Click any preset, favorite chip, or recently-played chip to tune there.

## Build phases

The app was built in five phases. Each phase is self-contained, so you can read the diff per phase if you're following along.

**Phase 1 — Core**
Static mood/station data, `<audio>` playback, play/pause, volume. The original artifact: LCD readout, VU meters, mood band selector, preset grid.

**Phase 2 — Reliability & UX polish**
- Stream drop-outs are retried once before showing an "unavailable" message.
- Last-played station remembered (in memory; localStorage in Phase 5).
- A loading spinner state distinct from the "buffering…" state.
- Keyboard support: Space, arrow keys, plus the volume slider keeps its own arrow handling.

**Phase 3 — Personalization**
- Favorites: pinned across moods, surfaced in a top row with remove buttons.
- Custom stations: "Add a station by URL" form — two actions, "Add" (to favorites) and "⊕ to mood" (adds to the current mood and tunes there).
- Recently played list (last 5), clickable to jump back.

**Phase 4 — Smarter mood matching**
- Time-of-day default mood on load: Focus during working hours, Chill in the evening/night, with Chill also covering early morning.
- "Surprise me" button and **S** key.
- Crossfade between stations instead of a hard cut.

**Phase 5 — Packaging & persistence**
- `localStorage` persistence for favorites, last station, and the recently-played list. A **↺ Reset** button clears saved preferences.
- Deployed as a static GitHub Pages site.

## How the crossfade works

Two `<audio>` elements live in the DOM at all times:

- `#player` — the currently audible one.
- `#crossfadePlayer` — the silent element the next stream is loaded onto.

When you switch stations while something is already playing, the new URL is loaded onto the silent element, both play together, and their volumes ramp over ~760ms (ease-in-out): the old one down to 0, the new one up to the master volume. Then the elements swap IDs so `#player` always names the audible stream.

If the incoming stream fails to start, the crossfade aborts and the current stream keeps playing — you don't go silent.

## Persistence

Preferences are stored under the localStorage key `moodwave_prefs_v1`:

- `lastStation` — `{ moodId, url, name }` of the last-tuned station.
- `favorites` — `[{ url, name }]`.
- `recentlyPlayed` — `[{ moodId, url, name }]` (most recent first, capped at 5).

A storage-capability probe runs at load; if localStorage is unavailable (private mode, corporate policy), the app degrades to in-memory with no errors.

## Run locally

Open `moodwave.html` directly in a browser, or serve it:

```bash
cd /path/to/moodwave
python -m http.server 8080
```

Then open `http://localhost:8080/moodwave.html`.

Some browsers are more permissive with audio autoplay over `http://` than over `file://`, so a local server is the more reliable way to test.

## Deployment

The repo is set up for GitHub Pages. To re-deploy after a change:

```bash
git add -A
git commit -m "Message"
git push
```

GitHub Pages serves from the `master` branch root. Any push auto-deploys.

## License

MIT.
