/**
 * =====================================================================
 * APPLICATION BOOTSTRAP & MAIN RENDER LOOP (main.js)
 * Initializes components, handles window resize debounce, manages
 * requestAnimationFrame loop, and tracks performance FPS.
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('ascii-canvas');

  // Initialize modular controllers
  const audioCtrl = new AudioController();
  const visualizer = new AsciiVisualizer(canvas);
  const ui = new UIManager(audioCtrl, visualizer);

  // Sync state when audio element triggers playback state
  window.onAudioStateChange = ({ isPlaying }) => {
    ui.updatePlayState(isPlaying);
    if (!isPlaying && audioCtrl.sourceType === 'file' && audioCtrl.audioElement.currentTime === 0) {
      ui.sourceBadge.textContent = 'SOURCE: IDLE';
    }
  };

  // System clock + session uptime telemetry
  const sysClockEl = document.getElementById('sys-clock');
  const uptimeEl = document.getElementById('uptime');
  const bootTime = Date.now();
  function tickTelemetry() {
    const now = new Date();
    sysClockEl.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
    const elapsed = Math.floor((Date.now() - bootTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    uptimeEl.textContent = `${h}:${m}:${s}`;
  }
  tickTelemetry();
  setInterval(tickTelemetry, 1000);

  // FPS calculation variables
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsTimer = 0;

  /**
   * Main 60 FPS requestAnimationFrame loop
   */
  function animationLoop(currentTime) {
    const delta = currentTime - lastTime;
    lastTime = currentTime;

    // Track FPS every 500ms
    frameCount++;
    fpsTimer += delta;
    if (fpsTimer >= 500) {
      const currentFps = (frameCount * 1000) / fpsTimer;
      ui.updateFPS(currentFps);
      frameCount = 0;
      fpsTimer = 0;
    }

    // 1. Fetch DSP frame data (reusing allocated buffers)
    const frameData = audioCtrl.getAudioFrameData();

    // 2. Render active ASCII visualization onto canvas
    visualizer.render(frameData);

    // 3. Update UI playback progress
    ui.updateProgress();

    // Request next frame
    requestAnimationFrame(animationLoop);
  }

  // Handle window resizing with debounce
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      visualizer.handleResize();
      visualizer.setColorTheme();
    }, 100);
  });

  // Start the render loop
  requestAnimationFrame(animationLoop);
});

