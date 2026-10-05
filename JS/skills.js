   /* ---------------------------------------------------------
     Skills constellation — a draggable sphere of tags.
     Positions are projected by hand so hit-testing stays sane.
     --------------------------------------------------------- */
 
 const stage = document.getElementById('cloud-stage');
  const tags = Array.from(document.querySelectorAll('.cloud-tag'));
  const cloud = {
    rx: 200, ry: 200, maxHalf: 110, angleX: -0.25, angleY: 0,
    velX: 0.0012, velY: 0.0028,
    dragging: false, flat: false, lastX: 0, lastY: 0, points: []
  };

  const FONT = { 3: 0.9, 2: 0.7, 1: 0.56 };

  function buildCloud() {
    const n = tags.length;
    cloud.points = tags.map((tag, i) => {
      // Fibonacci sphere — even spacing, no clumping
      const phi = Math.acos(-1 + (2 * i + 1) / n);
      const theta = Math.sqrt(n * Math.PI) * phi;
      tag.style.fontSize = FONT[tag.dataset.weight] + 'rem';
      return { el: tag, x: Math.cos(theta) * Math.sin(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(phi) };
    });
    // widest label decides how far the sphere may spread before something
    // gets clipped at the stage edge
    cloud.maxHalf = Math.max(...tags.map(t => t.offsetWidth)) / 2;
    sizeCloud();
  }

  function sizeCloud() {
    // Below this the longest labels are wider than the sphere itself, so the
    // whole thing degrades to a flat wrapped list. Kept low so a merely
    // narrow desktop window still gets the ball.
    cloud.flat = stage.clientWidth < 560;
    stage.classList.toggle('flat', cloud.flat);
    if (cloud.flat) {
      for (const p of cloud.points) p.el.style.cssText = 'font-size:' + FONT[p.el.dataset.weight] + 'rem';
      return;
    }
    const r = stage.getBoundingClientRect();
    /* A true sphere: rx and ry are equal, so it reads as a ball rather than
       the squashed oval the ellipsoid gave.

       Perspective pushes tags outward past the raw radius. For focal length
       f = 1.9r the furthest a projected point can land is 1.175r (maximise
       r·sinθ·f/(f + r·cosθ) — it peaks at cosθ = -1/1.9, not at the equator).
       Clamping to 1.2r on BOTH axes is what stops the sphere being cut off;
       the previous clamp only guarded the horizontal and the top was being
       sliced by the stage's overflow. */
    const K = 1.2;
    const OVAL = 1.18;                  // a little wider than tall
    const roomX = (r.width / 2 - (cloud.maxHalf || 110) - 8) / (K * OVAL);
    const roomY = (r.height / 2 - 16) / K;
    const rad = Math.max(110, Math.min(r.width * 0.36, roomX, roomY));
    cloud.rx = rad * OVAL;
    cloud.ry = rad;
  }

  let cloudOnScreen = false;
  new IntersectionObserver(([e]) => { cloudOnScreen = e.isIntersecting; },
    { rootMargin: '15% 0px' }).observe(stage);

  function renderCloud() {
    if (!cloudOnScreen || cloud.flat) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    const cx = w / 2, cy = h / 2;
    // Shorter focal length = stronger near/far size difference, which is
    // what actually makes the eye read a sphere instead of a flat scatter.
    const fov = cloud.rx * 1.9;

    if (!cloud.dragging) {
      cloud.angleY += cloud.velY;
      cloud.angleX += cloud.velX;
      cloud.velY = lerp(cloud.velY, 0.0028, 0.02);
      cloud.velX = lerp(cloud.velX, 0.0012, 0.02);
    }

    const cosY = Math.cos(cloud.angleY), sinY = Math.sin(cloud.angleY);
    const cosX = Math.cos(cloud.angleX), sinX = Math.sin(cloud.angleX);

    for (const p of cloud.points) {
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const X = x1 * cloud.rx, Y = y2 * cloud.ry, Z = z2 * cloud.rx;
      const scale = fov / (fov + Z);

      p.el.style.left = (cx + X * scale) + 'px';
      p.el.style.top  = (cy + Y * scale) + 'px';
      p.el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      p.el.style.zIndex = Math.round(scale * 200);
      if (!p.el.classList.contains('dim')) {
        const depth = clamp01((scale - 0.5) / 0.85);
        p.el.style.opacity = (0.12 + 0.88 * depth * depth).toFixed(3);
      }
    }
  }

  (function cloudInput() {
    stage.addEventListener('pointerdown', e => {
      if (cloud.flat) return;
      cloud.dragging = true;
      cloud.lastX = e.clientX; cloud.lastY = e.clientY;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
      if (!cloud.dragging) return;
      const dx = e.clientX - cloud.lastX, dy = e.clientY - cloud.lastY;
      cloud.lastX = e.clientX; cloud.lastY = e.clientY;
      cloud.angleY += dx * 0.005;
      cloud.angleX -= dy * 0.005;
      cloud.velY = dx * 0.0016;
      cloud.velX = -dy * 0.0016;
    });
    const stop = () => { cloud.dragging = false; };
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);
    stage.addEventListener('pointerleave', stop);
  })();

  document.querySelectorAll('.skills-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.skills-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      tags.forEach(tag => {
        const matches = cat === 'all' || tag.dataset.cat === cat;
        tag.classList.toggle('dim', !matches);
        tag.classList.toggle('match', matches && cat !== 'all');
      });
    });
  });
