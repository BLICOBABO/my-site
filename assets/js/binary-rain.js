(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.id = "binary-rain";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: false });
  const glyphs = "01";
  const fontSize = 18;
  const colGap = 48;
  let columns = [];
  let width = 0;
  let height = 0;
  let last = 0;

  function randomBits(n) {
    const bits = [];
    for (let i = 0; i < n; i++) {
      bits.push(glyphs[Math.random() < 0.5 ? 0 : 1]);
    }
    return bits;
  }

  function makeColumn(i) {
    const trail = 4 + Math.floor(Math.random() * 6);
    return {
      x: i * colGap,
      y: Math.random() * -height,
      speed: 0.35 + Math.random() * 0.55,
      trail: trail,
      bits: randomBits(trail),
    };
  }

  function reset() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = fontSize + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "top";

    const count = Math.ceil(width / colGap);
    columns = Array.from({ length: count }, (_, i) => makeColumn(i));
  }

  function draw(now) {
    const dt = Math.min((now - last) / 16.67, 2.5);
    last = now;

    ctx.fillStyle = "rgba(3, 8, 14, 0.32)";
    ctx.fillRect(0, 0, width, height);

    for (const col of columns) {
      col.y += col.speed * dt * fontSize * 0.1;
      if (col.y - col.trail * fontSize > height) {
        const next = makeColumn(Math.round(col.x / colGap));
        col.y = next.y;
        col.speed = next.speed;
        col.trail = next.trail;
        col.bits = next.bits;
      }

      for (let i = 0; i < col.trail; i++) {
        const gy = col.y - i * fontSize;
        if (gy < -fontSize || gy > height) continue;
        const ch = col.bits[i];
        if (i === 0) {
          ctx.fillStyle = "rgba(198, 255, 198, 0.7)";
        } else if (i < 2) {
          ctx.fillStyle = "rgba(152, 251, 152, 0.5)";
        } else {
          const alpha = Math.max(0.12, 0.38 - i / col.trail * 0.22);
          ctx.fillStyle = "rgba(144, 238, 144," + alpha + ")";
        }
        ctx.fillText(ch, col.x, gy);
      }
    }

    requestAnimationFrame(draw);
  }

  reset();
  ctx.fillStyle = "#03080e";
  ctx.fillRect(0, 0, width, height);
  last = performance.now();
  requestAnimationFrame(draw);

  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reset, 120);
  });
})();
