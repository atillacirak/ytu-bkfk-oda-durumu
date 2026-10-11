/**
 * Interactive Deep Space Starfield & Portal Particles Canvas
 * Smooth, 60fps, low battery impact, dynamically tinted by room status
 */
(function() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // Star particles
  const STAR_COUNT = Math.min(Math.floor((width * height) / 9000), 120);
  const stars = [];

  // Theme tint color: default cyan/purple
  let currentHue = 190; // 190 = cyan, 145 = emerald, 0 = crimson, 35 = amber
  let targetHue = 190;

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.6 + 0.3,
        alpha: Math.random() * 0.8 + 0.2,
        speedX: (Math.random() - 0.5) * 0.25,
        speedY: (Math.random() - 0.5) * 0.25,
        pulseSpeed: 0.01 + Math.random() * 0.02
      });
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initStars();
  }

  window.addEventListener('resize', resize, { passive: true });
  initStars();

  // Public method to adjust ambient background hue
  window.updateSpaceTheme = function(isOpen, occupancy) {
    if (!isOpen) {
      targetHue = 345; // Crimson / dark violet
    } else if (occupancy === 'full') {
      targetHue = 35;  // Amber / warning
    } else {
      targetHue = 165; // Emerald cyan
    }
  };

  let animationFrameId;

  function draw() {
    // Smoothly interpolate hue
    currentHue += (targetHue - currentHue) * 0.04;

    ctx.clearRect(0, 0, width, height);

    // Subtle radial nebula background glow
    const cx = width / 2;
    const cy = height * 0.45;
    const maxRadius = Math.max(width, height) * 0.6;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxRadius);
    grad.addColorStop(0, `hsla(${currentHue}, 70%, 15%, 0.4)`);
    grad.addColorStop(0.5, `hsla(${currentHue + 40}, 60%, 8%, 0.15)`);
    grad.addColorStop(1, 'rgba(7, 10, 19, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Draw twinkling stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x += s.speedX;
      s.y += s.speedY;

      // Wrap around edges
      if (s.x < 0) s.x = width;
      if (s.x > width) s.x = 0;
      if (s.y < 0) s.y = height;
      if (s.y > height) s.y = 0;

      s.alpha += Math.sin(Date.now() * s.pulseSpeed) * 0.008;
      const displayAlpha = Math.max(0.1, Math.min(0.9, s.alpha));

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${currentHue + 15}, 80%, 90%, ${displayAlpha})`;
      ctx.shadowBlur = s.radius > 1.2 ? 6 : 0;
      ctx.shadowColor = `hsl(${currentHue}, 90%, 70%)`;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    animationFrameId = requestAnimationFrame(draw);
  }

  draw();

  // Pause rendering when tab is hidden to save battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      draw();
    }
  });
})();
