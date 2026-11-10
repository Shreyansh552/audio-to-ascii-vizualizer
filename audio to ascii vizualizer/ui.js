/**
 * =====================================================================
 * UI & CONTROLS MANAGER (ui.js)
 * Manages mode switching (5 modes), color themes, hotkeys,
 * volume, gain, smoothing, drag & drop, and audio scrubbing.
 * =====================================================================
 */

class UIManager {
  constructor(audioCtrl, visualizer) {
    this.audioCtrl = audioCtrl;
    this.visualizer = visualizer;

    this.themes = ['green', 'cyan', 'amber', 'magenta', 'white'];
    this.currentThemeIndex = 0;

    this.modes = ['spectrum', 'waveform', 'radial', 'matrix', 'tunnel'];

    this.cacheElements();
    this.initEvents();
    this.initDragAndDrop();
    this.applyTheme('green');
  }

  cacheElements() {
    this.micBtn = document.getElementById('mic-btn');
    this.fileInput = document.getElementById('file-input');
    this.fileLabel = document.getElementById('file-label');
    this.demoBtn = document.getElementById('demo-btn');
    this.playPauseBtn = document.getElementById('play-pause-btn');
    this.playIcon = document.getElementById('play-icon');
    this.playLabel = document.getElementById('play-label');
    this.stopBtn = document.getElementById('stop-btn');

    this.sourceBadge = document.getElementById('source-badge');
    this.modeBadge = document.getElementById('mode-badge');
    this.themeBadge = document.getElementById('theme-badge');
    this.fpsDisplay = document.getElementById('fps-display');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');

    this.statusBanner = document.getElementById('status-banner');
    this.statusMessage = document.getElementById('status-message');
    this.dismissStatusBtn = document.getElementById('dismiss-status');

    this.volumeSlider = document.getElementById('volume-slider');
    this.volumeVal = document.getElementById('volume-val');

    this.gainSlider = document.getElementById('gain-slider');
    this.gainVal = document.getElementById('gain-val');

    this.smoothSlider = document.getElementById('smooth-slider');
    this.smoothVal = document.getElementById('smooth-val');

    this.bandsSlider = document.getElementById('bands-slider');
    this.bandsVal = document.getElementById('bands-val');

    this.glowToggle = document.getElementById('glow-toggle');

    this.progressBar = document.getElementById('progress-bar');
    this.progressContainer = document.getElementById('progress-container');
    this.timeCurrent = document.getElementById('time-current');
    this.timeTotal = document.getElementById('time-total');

    this.dropOverlay = document.getElementById('drop-overlay');
    this.modeButtons = document.querySelectorAll('.term-btn-mode');
    this.themeButtons = document.querySelectorAll('.color-swatch-btn');
  }

  initEvents() {
    // Microphone button
    this.micBtn.addEventListener('click', () => this.toggleMicrophone());

    // File Input
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadFile(file);
    });

    // Demo Track
    this.demoBtn.addEventListener('click', () => this.toggleDemo());

    // Play / Pause
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());

    // Stop
    this.stopBtn.addEventListener('click', () => this.stopPlayback());

    // Progress bar seeking
    this.progressContainer.addEventListener('click', (e) => {
      if (this.audioCtrl.sourceType === 'file' && this.audioCtrl.audioElement.duration) {
        const rect = this.progressContainer.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.audioCtrl.audioElement.currentTime = pos * this.audioCtrl.audioElement.duration;
      }
    });

    // Volume
    this.volumeSlider.addEventListener('input', (e) => {
      const vol = e.target.value / 100;
      this.audioCtrl.setVolume(vol);
      this.volumeVal.textContent = `${e.target.value}%`;
    });

    // Gain / Sensitivity
    this.gainSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioCtrl.setSensitivity(val);
      this.gainVal.textContent = `${val.toFixed(1)}x`;
    });

    // Smoothing
    this.smoothSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioCtrl.setSmoothing(val);
      this.smoothVal.textContent = val.toFixed(2);
    });

    // Frequency Bands
    this.bandsSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.audioCtrl.setNumBands(val);
      this.bandsVal.textContent = val;
    });

    // CRT Glow
    this.glowToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.add('glow-enabled');
      } else {
        document.body.classList.remove('glow-enabled');
      }
    });

    // Mode Buttons
    this.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });

    // Theme Swatches
    this.themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this.applyTheme(theme);
      });
    });

    // Fullscreen
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    // Dismiss Alert
    this.dismissStatusBtn.addEventListener('click', () => {
      this.statusBanner.classList.add('hidden');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e));
  }

  initDragAndDrop() {
    ['dragenter', 'dragover'].forEach(name => {
      window.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropOverlay.classList.remove('hidden');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      this.dropOverlay.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropOverlay.classList.add('hidden');
      });
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropOverlay.classList.add('hidden');
      const dt = e.dataTransfer;
      if (dt && dt.files.length > 0) {
        const file = dt.files[0];
        if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(file.name)) {
          this.loadFile(file);
        } else {
          this.showError('Unsupported file type. Please drop an audio file (MP3, WAV, OGG, FLAC).');
        }
      }
    });
  }

  handleKeyboardShortcut(e) {
    if (e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'Digit1':
      case 'Numpad1':
        this.setMode('spectrum');
        break;
      case 'Digit2':
      case 'Numpad2':
        this.setMode('waveform');
        break;
      case 'Digit3':
      case 'Numpad3':
        this.setMode('radial');
        break;
      case 'Digit4':
      case 'Numpad4':
        this.setMode('matrix');
        break;
      case 'Digit5':
      case 'Numpad5':
        this.setMode('tunnel');
        break;
      case 'KeyC':
        this.cycleTheme();
        break;
      case 'KeyM':
        this.toggleMicrophone();
        break;
      case 'KeyF':
        this.toggleFullscreen();
        break;
    }
  }

  async loadFile(file) {
    try {
      this.hideStatus();
      await this.audioCtrl.loadAudioFile(file);
      const name = file.name;
      this.fileLabel.textContent = name.length > 14 ? name.substring(0, 12) + '..' : name;
      this.sourceBadge.textContent = `SRC: ${name.substring(0, 16).toUpperCase()}`;
      this.playPauseBtn.disabled = false;
      this.stopBtn.disabled = false;
      this.updatePlayState(true);
      this.micBtn.classList.remove('active');
      this.demoBtn.classList.remove('active');
    } catch (err) {
      this.showError('Could not decode audio file: ' + err.message);
    }
  }

  async toggleDemo() {
    if (this.audioCtrl.sourceType === 'demo' && this.audioCtrl.isPlaying) {
      this.audioCtrl.stopSynthDemo();
      this.demoBtn.classList.remove('active');
      this.updatePlayState(false);
      this.sourceBadge.textContent = 'SRC: IDLE';
    } else {
      this.hideStatus();
      this.micBtn.classList.remove('active');
      await this.audioCtrl.startSynthDemo();
      this.demoBtn.classList.add('active');
      this.sourceBadge.textContent = 'SRC: CYBER SYNTH';
      this.playPauseBtn.disabled = false;
      this.stopBtn.disabled = false;
      this.updatePlayState(true);
    }
  }

  async toggleMicrophone() {
    if (this.audioCtrl.sourceType === 'mic') {
      this.audioCtrl.stopMicrophone();
      this.audioCtrl.sourceType = 'idle';
      this.micBtn.classList.remove('active');
      this.sourceBadge.textContent = 'SRC: IDLE';
      this.playPauseBtn.disabled = true;
      this.stopBtn.disabled = true;
      this.updatePlayState(false);
    } else {
      this.hideStatus();
      const res = await this.audioCtrl.startMicrophone();
      if (res.success) {
        this.demoBtn.classList.remove('active');
        this.micBtn.classList.add('active');
        this.sourceBadge.textContent = 'SRC: LIVE MIC';
        this.playPauseBtn.disabled = false;
        this.stopBtn.disabled = false;
        this.updatePlayState(true);
      } else {
        this.showError(res.message);
      }
    }
  }

  togglePlayPause() {
    const isPlaying = this.audioCtrl.togglePlay();
    this.updatePlayState(isPlaying);
  }

  updatePlayState(isPlaying) {
    if (isPlaying) {
      this.playIcon.textContent = '⏸';
      this.playLabel.textContent = 'PAUSE';
      this.playPauseBtn.classList.add('active');
    } else {
      this.playIcon.textContent = '▶';
      this.playLabel.textContent = 'PLAY';
      this.playPauseBtn.classList.remove('active');
    }
  }

  stopPlayback() {
    this.audioCtrl.stopCurrentSource();
    this.updatePlayState(false);
    this.sourceBadge.textContent = 'SRC: IDLE';
    this.micBtn.classList.remove('active');
    this.demoBtn.classList.remove('active');
    this.playPauseBtn.disabled = true;
    this.stopBtn.disabled = true;
  }

  setMode(mode) {
    this.visualizer.setMode(mode);
    const idx = this.modes.indexOf(mode) + 1;
    this.modeBadge.textContent = `MODE: ${idx}.${mode.toUpperCase()}`;

    this.modeButtons.forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    this.currentThemeIndex = this.themes.indexOf(theme);
    this.themeBadge.textContent = `COLOR: ${theme.toUpperCase()}`;

    this.themeButtons.forEach(btn => {
      if (btn.dataset.theme === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.visualizer.setColorTheme();
  }

  cycleTheme() {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
    this.applyTheme(this.themes[this.currentThemeIndex]);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
      this.fullscreenBtn.innerHTML = '✖ EXIT FULLSCREEN';
    } else {
      document.exitFullscreen().catch(err => {});
      this.fullscreenBtn.innerHTML = '⛶ FULLSCREEN';
    }
  }

  showError(msg) {
    this.statusMessage.textContent = msg;
    this.statusBanner.classList.remove('hidden');
  }

  hideStatus() {
    this.statusBanner.classList.add('hidden');
  }

  updateProgress() {
    if (this.audioCtrl.sourceType === 'file') {
      const el = this.audioCtrl.audioElement;
      const cur = el.currentTime || 0;
      const dur = el.duration || 0;

      if (dur > 0) {
        const pct = (cur / dur) * 100;
        this.progressBar.style.width = `${pct}%`;
        this.timeCurrent.textContent = this.formatTime(cur);
        this.timeTotal.textContent = this.formatTime(dur);
      }
    } else if (this.audioCtrl.sourceType === 'demo') {
      this.progressBar.style.width = '100%';
      this.timeCurrent.textContent = '124';
      this.timeTotal.textContent = 'BPM';
    } else if (this.audioCtrl.sourceType === 'mic') {
      this.progressBar.style.width = '100%';
      this.timeCurrent.textContent = 'LIVE';
      this.timeTotal.textContent = 'MIC';
    } else {
      this.progressBar.style.width = '0%';
      this.timeCurrent.textContent = '00:00';
      this.timeTotal.textContent = '00:00';
    }
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  updateFPS(fps) {
    this.fpsDisplay.textContent = Math.round(fps);
  }
}

window.UIManager = UIManager;
