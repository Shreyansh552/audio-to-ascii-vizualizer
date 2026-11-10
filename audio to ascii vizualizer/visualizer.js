/**
 * =====================================================================
 * ASCII VISUALIZER ENGINE (visualizer.js)
 * High-performance 2D Canvas ASCII Renderer with 5 Cutting-Edge Modes:
 * 1. SPECTRUM - Dynamic vertical bars with floating peak caps & VU meter style
 * 2. WAVEFORM - Reactive oscilloscope with zero-crossing sync & glow trail
 * 3. RADIAL - Concentric circular visualizer with bass pulsation & audio rotation
 * 4. MATRIX RAIN - Cascading digital stream triggered & driven by audio energy
 * 5. 3D TUNNEL - Perspective infinite cyber-tunnel expanding to bass and transients
 * =====================================================================
 */

class AsciiVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Mode: 'spectrum' | 'waveform' | 'radial' | 'matrix' | 'tunnel'
    this.mode = 'spectrum';

    // 12-tier ASCII Optical Density Ramp (from dark to bright) for smoother gradients
    this.charRamp = [' ', '·', '.', ':', ';', '-', '=', '+', '*', '#', '%', '@'];
    this.numChars = this.charRamp.length;

    // Grid Dimensions
    this.cols = 100;
    this.rows = 45;
    this.charWidth = 9;
    this.charHeight = 15;
    this.fontSize = 13;

    // Animation state variables
    this.rotationAngle = 0;
    this.tunnelZ = 0;

    // Matrix Rain state columns
    this.matrixDrops = [];

    // Cached theme colors
    this.primaryColor = '#33ff66';
    this.primaryDim = '#14732b';
    this.bgColor = '#040804';
    this.glowColor = 'rgba(51, 255, 102, 0.45)';

    // Pre-allocated cell buffers
    this.charGrid = [];
    this.alphaGrid = [];

    this.initBuffers();
    this.handleResize();
  }

  initBuffers() {
    this.charGrid = new Array(this.rows);
    this.alphaGrid = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      this.charGrid[r] = new Array(this.cols).fill(' ');
      this.alphaGrid[r] = new Float32Array(this.cols);
    }

    // Matrix drops initialization
    this.matrixDrops = new Array(this.cols);
    for (let c = 0; c < this.cols; c++) {
      this.matrixDrops[c] = Math.floor(Math.random() * this.rows);
    }
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(220, Math.floor(rect.height));

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false; // crisp, pixel-perfect ASCII

    // Responsive font calculation
    this.fontSize = Math.max(11, Math.min(15, Math.floor(width / 78)));
    this.charHeight = Math.floor(this.fontSize * 1.32);
    this.charWidth = Math.floor(this.fontSize * 0.62);

    this.cols = Math.floor(width / this.charWidth);
    this.rows = Math.floor(height / this.charHeight);

    this.initBuffers();
    this.ctx.font = `700 ${this.fontSize}px 'JetBrains Mono', 'Fira Code', 'Courier New', monospace`;
    this.ctx.textBaseline = 'top';
  }

  setColorTheme() {
    const computed = getComputedStyle(document.body);
    this.primaryColor = computed.getPropertyValue('--primary-color').trim() || '#33ff66';
    this.primaryDim = computed.getPropertyValue('--primary-dim').trim() || '#14732b';
    this.bgColor = computed.getPropertyValue('--bg-panel').trim() || '#040804';
    this.glowColor = computed.getPropertyValue('--primary-glow').trim() || 'rgba(51, 255, 102, 0.45)';
  }

  setMode(mode) {
    if (['spectrum', 'waveform', 'radial', 'matrix', 'tunnel'].includes(mode)) {
      this.mode = mode;
      this.clearBuffer();
    }
  }

  clearBuffer() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.charGrid[r][c] = ' ';
        this.alphaGrid[r][c] = 0;
      }
    }
  }

  valToChar(val) {
    const clamped = Math.max(0, Math.min(0.999, val));
    return this.charRamp[Math.floor(clamped * this.numChars)];
  }

  /**
   * ===================================================================
   * MODE 1: SPECTRUM BARS (VU-Meter Style + Peak Markers)
   * ===================================================================
   */
  renderSpectrum(audioData) {
    const bands = audioData.bands;
    const peaks = audioData.peaks;
    const bandCount = bands.length;
    const cols = this.cols;
    const rows = this.rows;

    const colsPerBand = Math.max(1, Math.floor(cols / bandCount));
    const totalCols = bandCount * colsPerBand;
    const startCol = Math.max(0, Math.floor((cols - totalCols) / 2));

    for (let b = 0; b < bandCount; b++) {
      const val = bands[b];
      const peakVal = peaks[b];

      const barHeight = Math.floor(val * (rows - 3));
      const peakRow = rows - 2 - Math.floor(peakVal * (rows - 3));

      for (let c = 0; c < colsPerBand; c++) {
        const colIdx = startCol + (b * colsPerBand) + c;
        if (colIdx >= cols) break;

        // Gap column for clean bar separation
        if (colsPerBand > 2 && c === colsPerBand - 1) continue;

        // Bass flash on the bottom baseline dot when this band slams
        if (val > 0.6) {
          this.charGrid[rows - 1][colIdx] = '·';
          this.alphaGrid[rows - 1][colIdx] = 1.0;
        }

        // Draw vertical bar from bottom
        for (let h = 0; h < barHeight; h++) {
          const r = rows - 2 - h;
          if (r < 0 || r >= rows) continue;

          const ratio = (h / Math.max(1, barHeight));
          const charVal = 0.25 + 0.75 * (ratio * val);

          this.charGrid[r][colIdx] = this.valToChar(charVal);
          this.alphaGrid[r][colIdx] = 0.45 + 0.55 * ratio;
        }

        // Floating peak indicator
        if (peakRow >= 0 && peakRow < rows) {
          this.charGrid[peakRow][colIdx] = '―';
          this.alphaGrid[peakRow][colIdx] = 1.0;
        }

        // Base baseline dot
        this.charGrid[rows - 1][colIdx] = '·';
        this.alphaGrid[rows - 1][colIdx] = 0.3;
      }
    }
  }

  /**
   * ===================================================================
   * MODE 2: OSCILLOSCOPE / WAVEFORM (Transients & Zero Crossing)
   * ===================================================================
   */
  renderWaveform(audioData) {
    const wave = audioData.waveform;
    const cols = this.cols;
    const rows = this.rows;
    const midRow = Math.floor(rows / 2);

    const step = wave.length / cols;
    let prevRow = midRow;

    // Center subtle grid line
    for (let c = 0; c < cols; c++) {
      this.charGrid[midRow][c] = '·';
      this.alphaGrid[midRow][c] = 0.2;
    }

    for (let c = 0; c < cols; c++) {
      const waveIdx = Math.floor(c * step);
      const sample = (wave[waveIdx] - 128) / 128.0; // -1.0 .. +1.0
      const amplified = sample * 1.5;
      const clamped = Math.max(-1.0, Math.min(1.0, amplified));

      const targetRow = Math.round(midRow - clamped * (midRow - 3));
      const safeTarget = Math.max(0, Math.min(rows - 1, targetRow));

      const startR = Math.min(prevRow, safeTarget);
      const endR = Math.max(prevRow, safeTarget);
      const amp = Math.abs(clamped);

      for (let r = startR; r <= endR; r++) {
        if (r >= 0 && r < rows) {
          const charVal = 0.35 + 0.65 * amp;
          this.charGrid[r][c] = this.valToChar(charVal);
          this.alphaGrid[r][c] = 0.55 + 0.45 * amp;
        }
      }

      prevRow = safeTarget;
    }
  }

  /**
   * ===================================================================
   * MODE 3: RADIAL / CIRCULAR (Kaleidoscope Pulsing Core)
   * ===================================================================
   */
  renderRadial(audioData) {
    const bands = audioData.bands;
    const bandCount = bands.length;
    const cols = this.cols;
    const rows = this.rows;
    const centerX = cols / 2;
    const centerY = rows / 2;

    const aspect = this.charHeight / this.charWidth;
    const maxRadius = Math.min(centerX, centerY * aspect) * 0.95;
    const innerRadius = maxRadius * 0.24;

    // Dynamic rotation reacting to audio energy
    this.rotationAngle += 0.01 + audioData.energy * 0.05;

    // Bass core sphere
    const bass = audioData.bassEnergy;
    const coreR = innerRadius * (0.8 + bass * 0.75);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c - centerX;
        const dy = (r - centerY) * aspect;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Core bass
        if (dist <= coreR) {
          const normDist = 1.0 - (dist / coreR);
          this.charGrid[r][c] = this.valToChar(0.4 + normDist * 0.6 * bass);
          this.alphaGrid[r][c] = 0.7 + 0.3 * bass;
          continue;
        }

        // Radiating rays
        if (dist > innerRadius && dist <= maxRadius) {
          let angle = Math.atan2(dy, dx) + this.rotationAngle;
          if (angle < 0) angle += Math.PI * 2;

          const angleNorm = (angle % (Math.PI * 2)) / (Math.PI * 2);
          const bandIdx = Math.floor(angleNorm * bandCount) % bandCount;
          const bandVal = bands[bandIdx];

          const reach = innerRadius + (maxRadius - innerRadius) * bandVal;

          if (dist <= reach) {
            const progress = (dist - innerRadius) / (maxRadius - innerRadius);
            const val = bandVal * (1.1 - progress * 0.35);

            this.charGrid[r][c] = this.valToChar(val);
            this.alphaGrid[r][c] = 0.45 + 0.55 * bandVal;
          }
        }
      }
    }
  }

  /**
   * ===================================================================
   * MODE 4: DIGITAL MATRIX RAIN (Audio-Driven Cascade)
   * Streams fall with speed and density proportional to frequency energy
   * ===================================================================
   */
  renderMatrix(audioData) {
    const cols = this.cols;
    const rows = this.rows;
    const bands = audioData.bands;
    const bandCount = bands.length;
    const energy = audioData.energy;

    // Katakana & Cyrillic & Code glyphs for authentic Matrix feel
    const matrixGlyphs = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
    const flashGlyphs = 'ZXCVBNM0123456789';

    for (let c = 0; c < cols; c++) {
      // Each column mapped to an audio band
      const bandIdx = Math.floor((c / cols) * bandCount);
      const bandVal = bands[bandIdx] || 0.1;
      const isTransient = bandVal > 0.75;

      // Drop speed proportional to band amplitude & overall energy
      const dropSpeed = Math.max(1, Math.round(bandVal * 3 + energy * 2));
      this.matrixDrops[c] = (this.matrixDrops[c] + dropSpeed) % (rows + 15);

      const headY = this.matrixDrops[c];
      const trailLength = Math.max(6, Math.floor(10 + bandVal * 20));

      for (let t = 0; t < trailLength; t++) {
        const r = headY - t;
        if (r >= 0 && r < rows) {
          const randomChar = isTransient
            ? flashGlyphs[Math.floor(Math.random() * flashGlyphs.length)]
            : matrixGlyphs[Math.floor(Math.random() * matrixGlyphs.length)];
          this.charGrid[r][c] = randomChar;

          if (t === 0) {
            // Bright white leading head (flashes to full intensity on transients)
            this.alphaGrid[r][c] = 1.0;
          } else {
            // Gradient trailing tail
            const tailRatio = 1.0 - (t / trailLength);
            this.alphaGrid[r][c] = Math.max(0.15, tailRatio * (0.3 + bandVal * 0.7));
          }
        }
      }
    }
  }

  /**
   * ===================================================================
   * MODE 5: 3D CYBER TUNNEL (Perspective Warp Reacting to Bass)
   * ===================================================================
   */
  renderTunnel(audioData) {
    const cols = this.cols;
    const rows = this.rows;
    const centerX = cols / 2;
    const centerY = rows / 2;
    const aspect = this.charHeight / this.charWidth;

    const bass = audioData.bassEnergy;
    const treble = audioData.trebleEnergy;

    // Advance tunnel perspective with bass kicks
    this.tunnelZ += 0.05 + bass * 0.12;

    // Neon neutron at the tunnel core
    const centerC = Math.round(centerX);
    const centerR = Math.round(centerY);
    if (centerR >= 0 && centerR < rows && centerC >= 0 && centerC < cols) {
      this.charGrid[centerR][centerC] = bass > 0.5 ? '@' : '+';
      this.alphaGrid[centerR][centerC] = 0.85 + bass * 0.15;
    }

    const numRings = 14;

    for (let i = 0; i < numRings; i++) {
      // Perspective ring depth
      const z = ((i - (this.tunnelZ % 1) + numRings) % numRings) + 1;
      const radius = (Math.min(centerX, centerY * aspect) * 1.3) / z;
      const ringIntensity = Math.min(1.0, 1.5 / z);

      // Ring angle steps
      const points = 36;
      for (let p = 0; p < points; p++) {
        const angle = (p / points) * Math.PI * 2 + (z * 0.15);
        const spokeX = Math.round(centerX + (Math.cos(angle) * radius));
        const spokeY = Math.round(centerY + (Math.sin(angle) * radius / aspect));

        if (spokeX >= 0 && spokeX < cols && spokeY >= 0 && spokeY < rows) {
          const charVal = (ringIntensity * 0.7) + (bass * 0.3);
          this.charGrid[spokeY][spokeX] = this.valToChar(charVal);
          this.alphaGrid[spokeY][spokeX] = Math.max(0.2, ringIntensity);
        }
      }
    }

    // High treble crosshairs / wireframe radial spokes
    const numSpokes = 8;
    for (let s = 0; s < numSpokes; s++) {
      const angle = (s / numSpokes) * Math.PI * 2 + (this.tunnelZ * 0.08);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const maxLen = Math.min(centerX, centerY * aspect);

      for (let d = 4; d < maxLen; d += 2) {
        const sx = Math.round(centerX + cosA * d);
        const sy = Math.round(centerY + (sinA * d / aspect));

        if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
          if (this.charGrid[sy][sx] === ' ') {
            this.charGrid[sy][sx] = '+';
            this.alphaGrid[sy][sx] = 0.25 + treble * 0.6;
          }
        }
      }
    }
  }

  /**
   * High performance Canvas drawing
   */
  drawToCanvas() {
    const ctx = this.ctx;
    const cols = this.cols;
    const rows = this.rows;
    const charW = this.charWidth;
    const charH = this.charHeight;

    // Clear background
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = this.primaryColor;

    for (let r = 0; r < rows; r++) {
      const y = r * charH;
      for (let c = 0; c < cols; c++) {
        const char = this.charGrid[r][c];
        if (char === ' ') continue;

        const alpha = this.alphaGrid[r][c];
        ctx.globalAlpha = Math.max(0.18, Math.min(1.0, alpha));
        ctx.fillText(char, c * charW, y);
      }
    }

    ctx.globalAlpha = 1.0;
  }

  /**
   * Main render tick called by requestAnimationFrame
   */
  render(audioData) {
    this.clearBuffer();

    switch (this.mode) {
      case 'waveform':
        this.renderWaveform(audioData);
        break;
      case 'radial':
        this.renderRadial(audioData);
        break;
      case 'matrix':
        this.renderMatrix(audioData);
        break;
      case 'tunnel':
        this.renderTunnel(audioData);
        break;
      case 'spectrum':
      default:
        this.renderSpectrum(audioData);
        break;
    }

    this.drawToCanvas();
  }
}

window.AsciiVisualizer = AsciiVisualizer;
