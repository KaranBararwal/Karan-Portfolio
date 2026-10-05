  /* ---------------------------------------------------------
     Experience: five real star formations you can swipe between.
     Points are normalised 0-1 inside the stage; `path` is the order the
     joining line runs through them.
     --------------------------------------------------------- */

// const lerp = (a, b, t) => a + (b - a) * t;

const JOBS = [
    {
      org: 'Hero MotoCorp',
      role: 'Software Engineer',
      when: 'July 2026 – Present'
    },
    {
      org: 'Samsung Research',
      role: 'Software Engineering Intern',
      when: 'Jan 2026 – June 2026'
    },
    {
      org: 'Hero MotoCorp',
      role: 'D&IT Intern',
      when: 'Jun 2025 – Jul 2025'
    }
  ];

  

  /* Real star positions, from RA/Dec normalised into the stage box (north
     up, east left, the way you'd actually see them). `jobs` picks which of
     those stars carry the five roles; the rest are drawn as faint
     companions so the pattern is the true constellation, not just five
     dots. `fig` is stylised line art sitting behind it all. */
  /* Absolute, resolved against the document. A relative url() inside a
     custom property is resolved against the stylesheet that consumes the
     var(), not the page — which prefixed every path with the CSS folder. */
  const ART = new URL('main site/img/constellations/', document.baseURI).href;

const FORMATIONS = [
  {
    name: 'Hero MotoCorp',
    art: 'orion.png',
    stars: [
        [0.15, 0.20],
        [0.50, 0.45],
        [0.82, 0.25]
      ],
    lines: [[0,1],[1,2]],
    jobs: [0, 1, 2]
  },
  {
    name: 'Samsung Research',
    art: 'cassiopeia.png',
    stars: [
        [0.15, 0.25],
        [0.50, 0.55],
        [0.82, 0.30]
      ],
    lines: [[0,1],[1,2]],
    jobs: [0, 1, 2]
  },
  {
    name: 'Hero MotoCorp',
    art: 'ursamajor.png',
    stars: [
        [0.18, 0.30],
        [0.52, 0.20],
        [0.80, 0.55]
      ],
    lines: [[0,1],[1,2]],
    jobs: [0, 1, 2]
  }
];


  const constStage = document.getElementById('const-stage');
  const constLines = document.getElementById('const-lines');
  const constTies = document.getElementById('const-ties');
  const constMinor = document.getElementById('const-minor');
  const constFig = document.getElementById('const-fig');
  const constNameEl = document.getElementById('const-name');
  const constSubEl = document.getElementById('const-sub');
  const constDots = document.getElementById('const-dots');
  const SVGNS = 'http://www.w3.org/2000/svg';

  let formIndex = 0;
  let figTimer = 0;
  const stars = [];
  const pos = JOBS.map(() => ({ x: 0, y: 0, tx: 0, ty: 0 }));
  const labelOff = JOBS.map(() => ({ dx: 16, dy: -20, w: 0, h: 0 }));
  let minorPos = [];      // the companion stars, in stage px

  JOBS.forEach((job, i) => {
    const star = document.createElement('div');
    star.className = 'star';
    star.innerHTML =
      '<button class="star-hit" aria-label="' + job.org + '"></button>' +
      '<span class="star-dot"></span>' +
      '<span class="star-label"><span class="star-org"></span>' +
      '<span class="star-role"></span><span class="star-when"></span></span>';
    star.querySelector('.star-org').textContent = job.org;
    star.querySelector('.star-role').textContent = job.role;
    star.querySelector('.star-when').textContent = job.when;
    const hit = star.querySelector('.star-hit');
    const on = () => stars.forEach((s, n) => s.classList.toggle('on', n === i));
    hit.addEventListener('pointerenter', on);
    hit.addEventListener('focus', on);
    constStage.appendChild(star);
    stars.push(star);
  });

  FORMATIONS.forEach((f, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', f.name);
    d.addEventListener('click', () => setFormation(i));
    constDots.appendChild(d);
  });

  /* The stars are laid out inside a fixed 4:3 box fitted into the stage,
     not stretched to the stage itself. That keeps every constellation the
     same shape on a phone and on a widescreen monitor — and it means the
     figure art, which is drawn over the same box, never distorts. */
  function constBox() {
    const r = constStage.getBoundingClientRect();
    const padX = Math.min(170, r.width * 0.17);
    const padY = Math.min(70, r.height * 0.11);
    const availW = Math.max(60, r.width - padX * 2);
    const availH = Math.max(60, r.height - padY * 2);
    let w = availW, h = w * 0.75;
    if (h > availH) { h = availH; w = h / 0.75; }
    return { x: (r.width - w) / 2, y: (r.height - h) / 2, w, h, sw: r.width, sh: r.height };
  }

  /* Greedy placement: try each side of the star, then progressively larger
     vertical offsets, and take the first spot that is inside the stage and
     clear of every label already placed. Without this the labels collide
     at narrow widths. */
  function layoutLabels(box) {
    const placed = [];
    const order = stars.map((_, i) => i).sort((a, b) => pos[a].ty - pos[b].ty);

    for (const i of order) {
      const el = stars[i].querySelector('.star-label');
      const lw = el.offsetWidth, lh = el.offsetHeight;
      const sx = pos[i].tx, sy = pos[i].ty;
      const gap = 16;
      const sides = sx > box.sw / 2 ? ['left', 'right'] : ['right', 'left'];

      const cands = [];
      // beside the star first, walking outward in both directions
      for (const side of sides) {
        for (const dy of [0, -0.55, 0.55, -1.05, 1.05, -1.6, 1.6, -2.2, 2.2, -2.9, 2.9]) {
          cands.push({
            side,
            lx: side === 'right' ? sx + gap : sx - gap - lw,
            ly: sy - lh / 2 + dy * lh
          });
        }
      }
      // then stacked directly above or below, nudged sideways if need be
      for (const dx of [0, -0.3, 0.3]) {
        cands.push({ side: 'right', lx: sx - lw / 2 + dx * lw, ly: sy - lh - 20 });
        cands.push({ side: 'right', lx: sx - lw / 2 + dx * lw, ly: sy + 20 });
      }

      const overlapArea = c => placed.reduce((sum, p) => {
        const ox = Math.min(c.lx + lw, p.x + p.w) - Math.max(c.lx, p.x);
        const oy = Math.min(c.ly + lh, p.y + p.h) - Math.max(c.ly, p.y);
        return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
      }, 0);

      let best = null, bestScore = Infinity;
      for (const c of cands) {
        if (c.lx < 2 || c.lx + lw > box.sw - 2 || c.ly < 2 || c.ly + lh > box.sh - 2) continue;
        const score = overlapArea(c);
        if (score === 0) { best = c; break; }        // clear spot, take it
        if (score < bestScore) { bestScore = score; best = c; }
      }
      // nothing fits cleanly: keep the least-overlapping option rather than
      // whatever happened to be first
      if (!best) {
        best = { ...cands[0] };
        best.lx = Math.max(2, Math.min(best.lx, box.sw - lw - 2));
        best.ly = Math.max(2, Math.min(best.ly, box.sh - lh - 2));
      }

      placed.push({ x: best.lx, y: best.ly, w: lw, h: lh });
      stars[i].dataset.side = best.side;
      el.style.setProperty('--lx', (best.lx - sx).toFixed(1) + 'px');
      el.style.setProperty('--ly', (best.ly - sy).toFixed(1) + 'px');
      labelOff[i] = { dx: best.lx - sx, dy: best.ly - sy, w: lw, h: lh };
    }
  }

  function setFormation(i) {
    formIndex = (i + FORMATIONS.length) % FORMATIONS.length;
    const f = FORMATIONS[formIndex];
    constNameEl.textContent = f.name;
    constSubEl.textContent = (formIndex + 1) + ' of ' + FORMATIONS.length;
    Array.from(constDots.children).forEach((d, n) =>
      d.setAttribute('aria-current', n === formIndex ? 'true' : 'false'));
    // cross-fade the plate: masks can't be transitioned, so fade out,
    // swap, fade back
    constFig.style.opacity = '0';
    clearTimeout(figTimer);
    figTimer = setTimeout(() => {
      constFig.style.setProperty('--art', 'url("' + ART + f.art + '")');
      constFig.style.opacity = '';
    }, 220);

    const box = constBox();
    // the plate sits on the star box, expanded a little so the figure
    // surrounds the stars rather than being boxed in by them
    const grow = 0.22;
    constFig.style.left = (box.x - box.w * grow / 2) + 'px';
    constFig.style.top = (box.y - box.h * grow / 2) + 'px';
    constFig.style.width = (box.w * (1 + grow)) + 'px';
    constFig.style.height = (box.h * (1 + grow)) + 'px';

    f.jobs.forEach((si, n) => {
      pos[n].tx = box.x + f.stars[si][0] * box.w;
      pos[n].ty = box.y + f.stars[si][1] * box.h;
    });

    // companion stars: every star in the pattern that isn't carrying a role
    constMinor.replaceChildren();
    f.stars.forEach((pt, si) => {
      if (f.jobs.includes(si)) return;
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', box.x + pt[0] * box.w);
      c.setAttribute('cy', box.y + pt[1] * box.h);
      c.setAttribute('r', 2.6);
      c.setAttribute('class', 'const-minor-star');
      constMinor.appendChild(c);
    });

    // one leader line per star, so a label that had to be nudged away still
    // reads as belonging to its star
    constTies.replaceChildren();
    stars.forEach(() => {
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('class', 'const-tie');
      constTies.appendChild(l);
    });

    // one <line> per asterism segment, endpoints refreshed each frame
    constLines.replaceChildren();
    f.lines.forEach(() => {
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('class', 'const-line');
      constLines.appendChild(l);
    });

    constStage.dataset.box = JSON.stringify(box);
    layoutLabels(box);
  }

  function starXY(f, si, box) {
    const j = f.jobs.indexOf(si);
    if (j >= 0) return [pos[j].x, pos[j].y];              // animated position
    return [box.x + f.stars[si][0] * box.w, box.y + f.stars[si][1] * box.h];
  }

  function renderConstellation() {
    if (!constStage.offsetWidth) return;
    for (const p of pos) {
      p.x = lerp(p.x, p.tx, 0.09);
      p.y = lerp(p.y, p.ty, 0.09);
    }
    stars.forEach((s, i) => { s.style.transform = `translate(${pos[i].x}px, ${pos[i].y}px)`; });

    const f = FORMATIONS[formIndex];
    const box = constStage.dataset.box ? JSON.parse(constStage.dataset.box) : constBox();

    const ties = constTies.children;
    stars.forEach((_, i) => {
      const t = ties[i];
      if (!t) return;
      const o = labelOff[i];
      const sx = pos[i].x, sy = pos[i].y;
      // aim at whichever edge of the label box faces the star
      const cx = Math.max(sx + o.dx, Math.min(sx, sx + o.dx + o.w));
      const cy = Math.max(sy + o.dy, Math.min(sy, sy + o.dy + o.h));
      const far = Math.hypot(cx - sx, cy - sy) > 13;
      t.setAttribute('x1', sx); t.setAttribute('y1', sy);
      t.setAttribute('x2', cx); t.setAttribute('y2', cy);
      t.style.opacity = far ? 1 : 0;      // no stub when the label is adjacent
    });

    const segs = constLines.children;
    f.lines.forEach((seg, n) => {
      const a = starXY(f, seg[0], box), b = starXY(f, seg[1], box);
      const l = segs[n];
      if (!l) return;
      l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]);
      l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
    });
  }

  document.getElementById('const-prev').addEventListener('click', () => setFormation(formIndex - 1));
  document.getElementById('const-next').addEventListener('click', () => setFormation(formIndex + 1));

  // swipe / drag horizontally to change constellation
  (function swipe() {
    let startX = null, startY = null, done = false;
    constStage.addEventListener('pointerdown', e => { startX = e.clientX; startY = e.clientY; done = false; });
    constStage.addEventListener('pointermove', e => {
      if (startX === null || done) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      // ignore mostly-vertical drags so the page can still be scrolled
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
        setFormation(formIndex + (dx < 0 ? 1 : -1));
        done = true;
      }
    });
    const end = () => { startX = null; };
    constStage.addEventListener('pointerup', end);
    constStage.addEventListener('pointercancel', end);
    constStage.addEventListener('pointerleave', end);
    constStage.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') setFormation(formIndex - 1);
      if (e.key === 'ArrowRight') setFormation(formIndex + 1);
    });
  })();
