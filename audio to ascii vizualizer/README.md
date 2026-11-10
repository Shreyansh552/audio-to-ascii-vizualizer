# ASCII Audio Visualizer (Terminal Web App)

A production-quality, real-time Audio-to-ASCII Art Visualizer web application built with vanilla JavaScript, HTML5 Canvas, and the Web Audio API.

## Features

- **Multi-source Audio Input**:
  - Live microphone input via `navigator.mediaDevices.getUserMedia` with feedback prevention and error handling.
  - Local audio file loading via `<input type="file">` and drag-and-drop.
  - Built-in Cyberpunk Synthesizer Demo track with bass kick, bassline, and percussion synthesis (testable immediately without needing an audio file or mic permission).
- **Audio DSP & Analysis**:
  - Web Audio API `AudioContext` and `AnalyserNode` with `fftSize = 2048`.
  - Logarithmic frequency band binning (32, 48, 64, or 128 bands) matching human hearing perception.
  - High-frequency tilt compensation and separate fast-attack / smooth-decay ballistics.
  - Real-time time-domain waveform processing for zero-crossing oscilloscope representation.
- **5 Visualizer Modes** (`1`–`5`):
  1. **Spectrum Bars**: Frequency bars with falling peak-hold markers, bass flash on the baseline, and a 12-tier character density gradient (`·`, `.`, `:`, `;`, `-`, `=`, `+`, `*`, `#`, `%`, `@`).
  2. **Waveform / Oscilloscope**: Horizontal oscilloscope with zero-crossing line interpolation reacting to transients.
  3. **Radial Visualizer**: Centered kaleidoscope rings radiating outward with a bass-pulsating core and audio-energy rotation.
  4. **Matrix Rain**: Cascading digital katakana/code stream with per-column speed driven by audio bands and bright transients flashes.
  5. **3D Cyber Tunnel**: Perspective warp tunnel expanding to bass kicks, treble wireframe crosshairs, and a pulsing neon core.
- **Retro CRT Cyberdeck Aesthetic**:
  - Animated moving scanlines, subtle CRT flicker, radial vignette, and phosphor glow toggle.
  - Glass-morphism panels with beveled borders, neon button states, and themed glow accents.
  - 5 monochrome palettes: **Matrix Green**, **Cyber Cyan**, **Phosphor Amber**, **Synthwave Magenta**, **Monochrome White**.
  - System clock + session uptime telemetry, real-time 60 FPS counter, interactive badges.
- **Keyboard Shortcuts**:
  - `Space`: Play / Pause
  - `1`: Spectrum Mode
  - `2`: Waveform Mode
  - `3`: Radial Mode
  - `4`: Matrix Rain Mode
  - `5`: 3D Tunnel Mode
  - `C`: Cycle Color Theme
  - `M`: Toggle Microphone
  - `F`: Toggle Fullscreen

---

## How the Audio-to-ASCII Mapping Works

1. **Perceptual Logarithmic Frequency Binning**:
   The `AnalyserNode` outputs 1024 linear frequency bins (from 0 Hz to $f_s / 2 \approx 24\text{ kHz}$). Because human hearing perceives pitch logarithmically, the visualizer uses a geometric mapping equation $b_i = \lfloor (\text{binCount})^{i / N} \rfloor$ to map the 1024 bins into 64 perceptual frequency bands.
2. **Dynamic Range Normalization & High-Frequency Boost**:
   Natural sound contains far more physical energy in low frequencies (bass) than in high frequencies (cymbals, air). The DSP module applies a gentle linear boost factor $\text{boost}(i) = 1.0 + 1.5 \cdot (i / N)$ to high-frequency bands so treble sparkles as visibly as bass hits.
3. **Ballistics & Smoothing**:
   Sudden changes are smoothed using an asymmetrical filter:
   - When amplitude increases: $\text{val}_{\text{new}} = \text{val}_{\text{prev}} + (\text{val}_{\text{target}} - \text{val}_{\text{prev}}) \times 0.65$ (fast attack).
   - When amplitude drops: $\text{val}_{\text{new}} = \text{val}_{\text{prev}} \times 0.82$ (smooth cinematic decay).
4. **Character Density Ramp**:
   Normalized amplitude values $[0.0, 1.0]$ are quantized into 10 optical density levels:
   `' '` $\to$ `'.'` $\to$ `':'` $\to$ `'-'` $\to$ `'='` $\to$ `'+'` $\to$ `'*'` $\to$ `'#'` $\to$ `'%'` $\to$ `'@'`
   Silence yields blank spaces and faint dots, while peak transients trigger dense characters like `#`, `%`, and `@`.

---

## How to Run Locally

Because the Web Audio API and `getUserMedia` require a secure context or a local web server to run without browser CORS/audio restrictions, run a simple local web server:

### Option 1: Python 3 (Installed on most systems)
Open a terminal in the project directory and run:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in Chrome, Firefox, or Edge.

### Option 2: Node.js (npx serve or http-server)
```bash
npx serve .
```
or
```bash
npx http-server -p 8000
```

### Option 3: VS Code / IDE Live Server
Right-click `index.html` and select **"Open with Live Server"**.

