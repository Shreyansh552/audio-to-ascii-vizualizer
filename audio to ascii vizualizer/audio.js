/**
 * =====================================================================
 * AUDIO CONTROLLER & DSP MODULE (audio.js)
 * High-performance Web Audio API engine.
 * Supports:
 * - Local file playback (Blob URL + File API)
 * - Low-latency Microphone stream with acoustic feedback protection
 * - Multi-track Cyberpunk Synth/Beats Generator (Kick, Snare, Hihat, Bass Synth, Arp Lead)
 * - Psychoacoustic frequency weighting (A-weighting curve + Logarithmic bands)
 * - Ballistics envelope (Fast attack, smooth exponential decay)
 * =====================================================================
 */

class AudioController {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.masterGain = null;

    // Source handles
    this.audioElement = document.getElementById('audio-element');
    this.mediaElementSource = null;
    this.micStream = null;
    this.micSourceNode = null;

    // Advanced Synthesizer Demo engine
    this.isDemoPlaying = false;
    this.demoTimer = null;
    this.demoStep = 0;
    this.demoTempo = 124; // BPM

    // Pre-allocated typed arrays for 60 FPS zero-allocation loop
    this.fftSize = 2048;
    this.rawFrequency = null;
    this.rawTimeDomain = null;

    // Processed output buffers
    this.maxBands = 128;
    this.smoothedBands = new Float32Array(this.maxBands);
    this.peakBands = new Float32Array(this.maxBands);
    this.peakDecay = 0.008;

    // Operational state
    this.sourceType = 'idle'; // 'file' | 'mic' | 'demo' | 'idle'
    this.isPlaying = false;
    this.currentSourceName = 'IDLE';

    // DSP Tuning properties
    this.sensitivity = 1.25;
    this.smoothingTimeConstant = 0.82;
    this.numBands = 64;

    this.initAudioElementEvents();
  }

  /**
   * Initializes AudioContext upon user gesture
   */
  async ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Master output volume control
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.audioCtx.currentTime);

      // AnalyserNode setup
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
      this.analyser.minDecibels = -95;
      this.analyser.maxDecibels = -10;

      // Master routing: MasterGain -> Analyser -> Speakers
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      // Allocate reusable typed arrays
      this.rawFrequency = new Uint8Array(this.analyser.frequencyBinCount); // 1024 bins
      this.rawTimeDomain = new Uint8Array(this.analyser.fftSize);          // 2048 samples
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  /**
   * Adjust master output volume
   */
  setVolume(volume) {
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.audioCtx.currentTime);
    }
  }

  setSensitivity(val) {
    this.sensitivity = val;
  }

  setSmoothing(val) {
    this.smoothingTimeConstant = val;
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = val;
    }
  }

  setNumBands(count) {
    this.numBands = Math.min(this.maxBands, Math.max(16, count));
  }

  /**
   * Load local file
   */
  async loadAudioFile(file) {
    await this.ensureAudioContext();
    this.stopCurrentSource();

    const objectUrl = URL.createObjectURL(file);
    this.audioElement.src = objectUrl;
    this.currentSourceName = file.name;

    if (!this.mediaElementSource) {
      this.mediaElementSource = this.audioCtx.createMediaElementSource(this.audioElement);
      this.mediaElementSource.connect(this.masterGain);
    }

    this.sourceType = 'file';
    await this.audioElement.play();
    this.isPlaying = true;
  }

  /**
   * Live Microphone input
   */
  async startMicrophone() {
    await this.ensureAudioContext();
    this.stopCurrentSource();

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });

      this.micSourceNode = this.audioCtx.createMediaStreamSource(this.micStream);

      // IMPORTANT: Connect mic only to analyser, NOT to speakers (avoids acoustic feedback loop)
      this.micSourceNode.connect(this.analyser);

      this.sourceType = 'mic';
      this.isPlaying = true;
      this.currentSourceName = 'Live Microphone';
      return { success: true };
    } catch (err) {
      console.error('Mic Error:', err);
      let msg = 'Could not access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No microphone input hardware was detected.';
      }
      return { success: false, message: msg };
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect(); } catch (e) {}
      this.micSourceNode = null;
    }
  }

  /**
   * -------------------------------------------------------------
   * HIGH-OCTANE CYBERPUNK 8-BAR SYNTHESIZER DEMO
   * Built-in multi-voice sound engine:
   * - Punchy 808 Kick Drum
   * - Crisp White-noise Snare & Hi-Hat
   * - Analog Saw Bass with Lowpass Resonant Filter Sweep
   * - Synth Arpeggio Melody
   * -------------------------------------------------------------
   */
  async startSynthDemo() {
    await this.ensureAudioContext();
    this.stopCurrentSource();

    this.sourceType = 'demo';
    this.isPlaying = true;
    this.isDemoPlaying = true;
    this.currentSourceName = 'Cyberpunk Synth Engine';
    this.demoStep = 0;

    // 16-step bass pattern (in Hz)
    // C2 (65.41), D#2 (77.78), F2 (87.31), G2 (98.00), A#2 (116.54)
    const bassline = [
      65.41, 65.41, 130.81, 65.41,  77.78, 77.78, 155.56, 77.78,
      87.31, 87.31, 174.61, 87.31,  98.00, 98.00, 116.54, 98.00
    ];

    // High Arpeggiator Melody (C4, Eb4, G4, Bb4, C5)
    const arpNotes = [
      261.63, 311.13, 392.00, 523.25, 466.16, 392.00, 311.13, 392.00,
      349.23, 415.30, 523.25, 622.25, 523.25, 415.30, 349.23, 415.30
    ];

    const stepInterval = (60 / this.demoTempo) / 4; // 16th notes ~120ms

    const triggerNextBeat = () => {
      if (!this.isDemoPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const step = this.demoStep;

      // 1. Kick Drum (Steps 0, 4, 8, 12 + syncopated step 10)
      if (step % 4 === 0 || step === 10) {
        const kickOsc = this.audioCtx.createOscillator();
        const kickGain = this.audioCtx.createGain();
        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
        kickGain.gain.setValueAtTime(1.0, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        kickOsc.connect(kickGain);
        kickGain.connect(this.masterGain);

        kickOsc.start(now);
        kickOsc.stop(now + 0.23);
      }

      // 2. Snare / Clap (Steps 4 and 12)
      if (step === 4 || step === 12) {
        const bufferLen = Math.floor(this.audioCtx.sampleRate * 0.12);
        const noiseBuf = this.audioCtx.createBuffer(1, bufferLen, this.audioCtx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufferLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferLen * 0.25));
        }

        const noiseSrc = this.audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuf;

        const noiseFilter = this.audioCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(900, now);

        const snareGain = this.audioCtx.createGain();
        snareGain.gain.setValueAtTime(0.45, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(snareGain);
        snareGain.connect(this.masterGain);

        noiseSrc.start(now);
      }

      // 3. Hi-Hat (Every odd 16th note)
      if (step % 2 === 1) {
        const hatLen = Math.floor(this.audioCtx.sampleRate * 0.04);
        const hatBuf = this.audioCtx.createBuffer(1, hatLen, this.audioCtx.sampleRate);
        const hData = hatBuf.getChannelData(0);
        for (let i = 0; i < hatLen; i++) {
          hData[i] = (Math.random() * 2 - 1);
        }

        const hatSrc = this.audioCtx.createBufferSource();
        hatSrc.buffer = hatBuf;

        const hatFilter = this.audioCtx.createBiquadFilter();
        hatFilter.type = 'bandpass';
        hatFilter.frequency.setValueAtTime(8500, now);
        hatFilter.Q.setValueAtTime(3.0, now);

        const hatGain = this.audioCtx.createGain();
        hatGain.gain.setValueAtTime(0.18, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        hatSrc.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(this.masterGain);

        hatSrc.start(now);
      }

      // 4. Heavy Saw Bassline with Filter Envelope
      const bassFreq = bassline[step % bassline.length];
      const bassOsc = this.audioCtx.createOscillator();
      const bassFilter = this.audioCtx.createBiquadFilter();
      const bassEnv = this.audioCtx.createGain();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassFilter.type = 'lowpass';
      bassFilter.Q.setValueAtTime(5.5, now);
      // Filter sweep
      bassFilter.frequency.setValueAtTime(450, now);
      bassFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
      bassFilter.frequency.exponentialRampToValueAtTime(300, now + stepInterval * 0.9);

      bassEnv.gain.setValueAtTime(0.38, now);
      bassEnv.gain.exponentialRampToValueAtTime(0.01, now + stepInterval * 0.95);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassEnv);
      bassEnv.connect(this.masterGain);

      bassOsc.start(now);
      bassOsc.stop(now + stepInterval);

      // 5. Arpeggio Lead (Stereo ping-pong feel)
      if (step % 2 === 0) {
        const leadFreq = arpNotes[(step / 2) % arpNotes.length];
        const leadOsc = this.audioCtx.createOscillator();
        const leadGain = this.audioCtx.createGain();

        leadOsc.type = 'square';
        leadOsc.frequency.setValueAtTime(leadFreq, now);

        leadGain.gain.setValueAtTime(0.09, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepInterval * 1.5);

        leadOsc.connect(leadGain);
        leadGain.connect(this.masterGain);

        leadOsc.start(now);
        leadOsc.stop(now + stepInterval * 1.6);
      }

      this.demoStep = (this.demoStep + 1) % 16;
    };

    triggerNextBeat();
    this.demoTimer = setInterval(triggerNextBeat, stepInterval * 1000);
  }

  stopSynthDemo() {
    this.isDemoPlaying = false;
    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
  }

  /**
   * Play / Pause switch
   */
  togglePlay() {
    if (this.sourceType === 'file') {
      if (this.audioElement.paused) {
        this.audioElement.play();
        this.isPlaying = true;
      } else {
        this.audioElement.pause();
        this.isPlaying = false;
      }
      return this.isPlaying;
    } else if (this.sourceType === 'demo') {
      if (this.isDemoPlaying) {
        this.stopSynthDemo();
        this.isPlaying = false;
      } else {
        this.startSynthDemo();
        this.isPlaying = true;
      }
      return this.isPlaying;
    } else if (this.sourceType === 'mic') {
      if (this.isPlaying) {
        this.stopMicrophone();
        this.isPlaying = false;
        this.sourceType = 'idle';
      }
      return this.isPlaying;
    }
    return false;
  }

  stopCurrentSource() {
    if (this.sourceType === 'file') {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    } else if (this.sourceType === 'mic') {
      this.stopMicrophone();
    } else if (this.sourceType === 'demo') {
      this.stopSynthDemo();
    }
    this.isPlaying = false;
    this.sourceType = 'idle';
  }

  initAudioElementEvents() {
    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      if (window.onAudioStateChange) window.onAudioStateChange({ isPlaying: false });
    });
    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      if (window.onAudioStateChange) window.onAudioStateChange({ isPlaying: true });
    });
    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      if (window.onAudioStateChange) window.onAudioStateChange({ isPlaying: false });
    });
  }

  /**
   * ===================================================================
   * DSP DATA PIPELINE (Called 60 times per second)
   * Converts 1024 raw linear FFT bins into logarithmic perceptual bands
   * with peak hold, energy calculation, and transient envelope tracking.
   * ===================================================================
   */
  getAudioFrameData() {
    const bandCount = this.numBands;

    if (!this.analyser || !this.isPlaying) {
      // Natural exponential decay down to rest level
      for (let i = 0; i < bandCount; i++) {
        this.smoothedBands[i] *= 0.85;
        this.peakBands[i] = Math.max(0, this.peakBands[i] - this.peakDecay);
      }
      return {
        bands: this.smoothedBands.subarray(0, bandCount),
        peaks: this.peakBands.subarray(0, bandCount),
        waveform: this.rawTimeDomain || new Uint8Array(2048).fill(128),
        energy: 0,
        bassEnergy: 0,
        trebleEnergy: 0
      };
    }

    // Capture Web Audio frequency and time data
    this.analyser.getByteFrequencyData(this.rawFrequency);
    this.analyser.getByteTimeDomainData(this.rawTimeDomain);

    const binCount = this.analyser.frequencyBinCount; // 1024
    let totalEnergy = 0;
    let bassEnergy = 0;
    let trebleEnergy = 0;

    // Perceptual logarithmic mapping
    const logBase = Math.pow(binCount, 1 / bandCount);

    for (let i = 0; i < bandCount; i++) {
      const startIndex = Math.floor(Math.pow(logBase, i)) - 1;
      const endIndex = Math.floor(Math.pow(logBase, i + 1)) - 1;

      const low = Math.max(0, Math.min(binCount - 1, startIndex));
      const high = Math.max(low + 1, Math.min(binCount, endIndex));

      let sum = 0;
      let count = 0;
      for (let b = low; b < high; b++) {
        sum += this.rawFrequency[b];
        count++;
      }

      // Normalize byte to 0..1
      let rawVal = (count > 0 ? (sum / count) : 0) / 255.0;

      // Equal-loudness / treble boost (high frequencies need perceptual compensation)
      const freqMultiplier = 1.0 + Math.pow(i / bandCount, 1.3) * 1.8;
      rawVal = Math.min(1.0, rawVal * this.sensitivity * freqMultiplier);

      // Ballistics: Fast attack (0.65) vs Smooth decay (0.84)
      const prev = this.smoothedBands[i];
      if (rawVal > prev) {
        this.smoothedBands[i] = prev + (rawVal - prev) * 0.70;
      } else {
        this.smoothedBands[i] = prev * 0.84;
      }

      // Peak hold calculation
      if (this.smoothedBands[i] >= this.peakBands[i]) {
        this.peakBands[i] = this.smoothedBands[i];
      } else {
        this.peakBands[i] = Math.max(0, this.peakBands[i] - this.peakDecay);
      }

      totalEnergy += this.smoothedBands[i];
      if (i < bandCount * 0.2) bassEnergy += this.smoothedBands[i];
      if (i > bandCount * 0.7) trebleEnergy += this.smoothedBands[i];
    }

    return {
      bands: this.smoothedBands.subarray(0, bandCount),
      peaks: this.peakBands.subarray(0, bandCount),
      waveform: this.rawTimeDomain,
      energy: totalEnergy / bandCount,
      bassEnergy: bassEnergy / (bandCount * 0.2),
      trebleEnergy: trebleEnergy / (bandCount * 0.3)
    };
  }
}

window.AudioController = AudioController;
