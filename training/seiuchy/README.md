# Vail Seiuchy

A revival of **Seiuchy**, the free CW (Morse code) QSO trainer and simulator
originally written by **François Wisard, HB9FXW**.

The original lived at `seiuchy.macache.com` and has since gone offline. This is
that original tool, kept as close to the original as we could and **re-skinned in
the [Vail](https://learncw.vailmorse.com/) visual style** so people can keep using
it. All credit for the tool itself, the QSO engine, the keying models, the
geography, and the humor, goes to HB9FXW. We just changed the paint.

> If you are HB9FXW, or you know him, and you'd rather this be taken down, renamed,
> or handled some other way, get in touch and we'll sort it out.

## What it does

Practice **head-copying** Morse code through simulated QSOs: listen, pick out the
relevant info (RST, name, QTH, rig, age, call, contest exchanges), and log it.
There's also a non-interactive **Full QSO simulator**, multiple realistic keying
styles (paddle, straight key, bug, cootie, Farnsworth), automatic speed
adjustment, and contest modes with grid-square distances.

## Project structure

```
.
├── index.html              # Rebranded page (markup IDs unchanged from original)
├── css/
│   └── vail-seiuchy.css     # New Vail dark theme (replaces the original twil.css)
├── js/
│   ├── seiuchy.js           # Original twil.js engine by HB9FXW (logic untouched*)
│   ├── AudioContextMonkeyPatch.js  # by Chris Wilson
│   └── jquery-3.2.1.min.js
├── img/                     # favicon / apple-touch-icon
├── netlify.toml
└── README.md
```

\* The only change to the engine: the two functions that pinged the original
author's (now-offline) `seiuchy.macache.com` server for anonymous usage stats are
disabled with an early `return`. No other logic was altered.

## Run locally

It's a static site, no build step. Just serve the folder:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

(Opening `index.html` directly via `file://` works too, though a local server is
closer to production.)

## Deploy to Netlify

The repo is deploy-ready as-is (`netlify.toml` publishes the root with no build):

- **Drag-and-drop:** drop this folder onto the Netlify dashboard, or
- **Git:** connect the repo; Netlify reads `netlify.toml` automatically. No build
  command, publish directory `.`.

## Credits

- **Seiuchy**, © 2016-2020 François Wisard, **HB9FXW**. Original tool, code, text.
- Morse audio approach based on code by **Eric Holk**.
- **AudioContext-MonkeyPatch** by **Chris Wilson** (Apache-2.0).
- jQuery 3.2.1.
- Vail visual styling inspired by [Vail CW School](https://learncw.vailmorse.com/).

Long live CW.
