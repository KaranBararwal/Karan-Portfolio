 /* ---------------------------------------------------------
     Shared state: one scroll value, one rAF loop.
     --------------------------------------------------------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const state = {
    scrollY: 0,
    progress: 0,
    launchT: -1,    // <0 waiting on the pad, 0 → 1 the launch, >1 in orbit
    clutter: 1,
    mouseX: 0,
    mouseY: 0
  };

  const root = document.documentElement;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const range = (v, from, to) => clamp01((v - from) / (to - from));

  /* ---------------------------------------------------------
     Inertia scrolling.
     We still move the real scroll position, so position:sticky,
     anchor links and the scrollbar all keep working.
     --------------------------------------------------------- */
  const smooth = {
    enabled: finePointer && !reduceMotion,
    target: 0, current: 0, ease: 0.09, lastSet: -1, running: false
  };

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function smoothTick() {
    const diff = smooth.target - smooth.current;
    if (Math.abs(diff) < 0.35) { smooth.current = smooth.target; smooth.running = false; }
    else smooth.current += diff * smooth.ease;
    smooth.lastSet = Math.round(smooth.current);
    window.scrollTo(0, smooth.current);
    if (smooth.running) requestAnimationFrame(smoothTick);
  }

  function startSmooth() {
    if (!smooth.running) { smooth.running = true; requestAnimationFrame(smoothTick); }
  }

  if (smooth.enabled) {
    smooth.target = smooth.current = window.scrollY;
    window.addEventListener('wheel', e => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? window.innerHeight : 1;
      smooth.target = Math.min(maxScroll(), Math.max(0, smooth.target + e.deltaY * unit));
      startSmooth();
    }, { passive: false });

    window.addEventListener('scroll', () => {
      if (Math.abs(window.scrollY - smooth.lastSet) > 2) {
        smooth.target = smooth.current = window.scrollY;
      }
    }, { passive: true });
  }

  function scrollToY(y) {
    const dest = Math.min(maxScroll(), Math.max(0, y));
    if (smooth.enabled) { smooth.target = dest; startSmooth(); }
    else window.scrollTo({ top: dest, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const el = document.querySelector(a.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      scrollToY(el.getBoundingClientRect().top + window.scrollY - 10);
    });
  });

  /* ---------------------------------------------------------
     Cursor: a reticle that snaps onto whatever you point at.
     The dot tracks the pointer exactly (no lag at all); the
     brackets chase it fast, then lock onto a target's box.
     --------------------------------------------------------- */
  if (finePointer) {
    const dot = document.getElementById('cursor-dot');
    const ret = document.getElementById('reticle');

    const R = { x: 0, y: 0, w: 26, h: 26 };     // current
    const T = { x: 0, y: 0, w: 26, h: 26 };     // target
    let locked = null;

    window.addEventListener('pointermove', e => {
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      document.body.classList.add('cursor-on');
      if (!locked) { T.x = e.clientX; T.y = e.clientY; T.w = 26; T.h = 26; }
    });

    document.addEventListener('pointerover', e => {
      const hit = e.target.closest('a, button');
      if (!hit) return;
      locked = hit;
      ret.classList.add('locked');
    });

    document.addEventListener('pointerout', e => {
      if (locked && !e.relatedTarget?.closest?.('a, button')) {
        locked = null;
        ret.classList.remove('locked');
      }
    });

    document.addEventListener('pointerleave', () => document.body.classList.remove('cursor-on'));

    (function reticleTick() {
      if (locked) {
        // re-read every frame so it tracks elements that move or scroll
        const b = locked.getBoundingClientRect();
        T.x = b.left + b.width / 2;
        T.y = b.top + b.height / 2;
        T.w = b.width + 16;
        T.h = b.height + 16;
      }
      // fast: 0.34 reads as responsive, not floaty
      R.x = lerp(R.x, T.x, 0.34);
      R.y = lerp(R.y, T.y, 0.34);
      R.w = lerp(R.w, T.w, 0.28);
      R.h = lerp(R.h, T.h, 0.28);

      ret.style.width = R.w + 'px';
      ret.style.height = R.h + 'px';
      ret.style.transform = `translate(${R.x - R.w / 2}px, ${R.y - R.h / 2}px)`;
      requestAnimationFrame(reticleTick);
    })();
  }

  window.addEventListener('pointermove', e => {
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---------------------------------------------------------
     Hero name, one letter at a time out of the dark
     --------------------------------------------------------- */
  const heroName = document.getElementById('hero-name');
  (function buildName() {
    heroName.dataset.text.split('').forEach((c, i) => {
      const span = document.createElement('span');
      span.className = c === ' ' ? 'sp' : 'ch';
      span.textContent = c === ' ' ? ' ' : c;
      span.style.transitionDelay = (i * 0.045).toFixed(3) + 's';
      heroName.appendChild(span);
    });
  })();

  /* ---------------------------------------------------------
     A satellite in orbit around the name. It passes behind the
     letters on the far half of the ellipse.
     --------------------------------------------------------- */
  const nameWrap = document.getElementById('hero-name-wrap');
  const nameSat = document.getElementById('name-sat');

  function renderNameSat(t) {
    if (!nameWrap.offsetWidth) return;
    const w = nameWrap.offsetWidth, h = nameWrap.offsetHeight;
    const a = t * 0.5;
    const depth = (Math.cos(a) + 1) / 2;              // 1 = nearest the viewer
    const x = w / 2 + Math.sin(a) * (w * 0.56);
    const y = h / 2 + Math.cos(a) * (h * 0.62);
    const scale = 0.65 + depth * 0.5;

    nameSat.style.transform =
      `translate(${x}px, ${y}px) scale(${scale.toFixed(3)}) rotate(${(Math.sin(a) * 16).toFixed(2)}deg)`;
    nameSat.style.zIndex = depth > 0.5 ? 3 : 1;       // 1 = behind the letters
    nameSat.style.filter = `brightness(${(0.55 + depth * 0.45).toFixed(2)})`;
  }

  if (finePointer) {
    const wrap = document.getElementById('porthole-wrap');
    const port = document.getElementById('porthole');
    wrap.addEventListener('pointermove', e => {
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      port.style.transform = `rotateX(${(-py * 13).toFixed(2)}deg) rotateY(${(px * 13).toFixed(2)}deg)`;
    });
    wrap.addEventListener('pointerleave', () => { port.style.transform = ''; });
  }

  /* ---------------------------------------------------------
     Reveal on scroll.
     An IntersectionObserver only fires on threshold crossings: a fast
     scroll can move an element from below the viewport to above it between
     two checks, so it never intersects, never fires, and stays invisible
     for good. A sweep can't miss.
     --------------------------------------------------------- */
  let pendingReveals = Array.from(document.querySelectorAll('.reveal'));

  function sweepReveals() {
    if (!pendingReveals.length) return;
    const line = window.innerHeight * 0.88;
    pendingReveals = pendingReveals.filter(el => {
      if (el.getBoundingClientRect().top > line) return true;
      el.classList.add('show');
      return false;
    });
  }


// Experience logic moved to js/experience.js



  /* ---------------------------------------------------------
     The one scroll loop
     --------------------------------------------------------- */
  const heroPin = document.getElementById('hero-pin');
  const skillsSection = document.getElementById('skills');
  let skyUpdate = null;

  function tick() {
    state.scrollY = window.scrollY;
    const max = maxScroll();
    state.progress = max > 0 ? clamp01(state.scrollY / max) : 0;
    root.style.setProperty('--p', state.progress.toFixed(4));

    const hp = heroPin.getBoundingClientRect();
    root.style.setProperty('--hero-out',
      clamp01(-hp.top / (hp.height - window.innerHeight || 1)).toFixed(4));

    // clear the scenery out before Skills so it doesn't fight the tag sphere
    const skillsTop = skillsSection.getBoundingClientRect().top + state.scrollY;
    state.clutter = 1 - range(state.scrollY,
                              skillsTop - window.innerHeight * 1.4,
                              skillsTop - window.innerHeight * 0.35);

    renderNameSat(performance.now() * 0.00042);
    renderConstellation();
    sweepReveals();
    renderCloud();
    if (skyUpdate) skyUpdate(state);

    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => {
    sizeCloud();
    setFormation(formIndex);
  }, { passive: true });

  /* ---------------------------------------------------------
     Launch sequence. The loading screen is the blast off: the counter
     runs on real load progress, then we ignite and fly, and the site is
     revealed as we make orbit.
     --------------------------------------------------------- */
  const preloader = document.getElementById('preloader');
  const preFill = document.getElementById('pre-bar-fill');
  const preCount = document.getElementById('pre-count');
  const preStatus = document.getElementById('pre-status');

  let loaded = 0, shown = 0;
  const bump = () => { loaded = Math.min(100, loaded + 100 / 3); };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(bump);
  Promise.all(
    Array.from(document.images).map(img =>
      img.complete ? Promise.resolve() : new Promise(res => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      })
    )
  ).then(bump);
  window.addEventListener('sky-ready', bump, { once: true });
  setTimeout(() => { loaded = 100; }, 6000);   // never trap anyone behind a hung CDN

  const LAUNCH_MS = 2600;
  let counting = true;

  function beginLaunch() {
    counting = false;
    const t0 = performance.now();
    preCount.textContent = '100';
    preStatus.textContent = 'Ignition';

    requestAnimationFrame(function fly(now) {
      const t = Math.min(1, (now - t0) / LAUNCH_MS);
      state.launchT = t;
      if (t > 0.12 && preStatus.textContent !== 'Liftoff') preStatus.textContent = 'Liftoff';
      if (t > 0.5) {
        preloader.classList.add('done');
        document.body.classList.remove('loading');
        // start the name assembling while we're still climbing, so the
        // two motions overlap instead of queuing up
        heroName.classList.add('lit');
      }
      if (t < 1) requestAnimationFrame(fly);
      else { state.launchT = 1; preloader.style.display = 'none'; }
    });
  }

  (function preTick() {
    if (!counting) return;
    shown = lerp(shown, loaded, 0.08);
    if (loaded >= 100 && shown > 99) shown = 100;
    preFill.style.right = (100 - shown) + '%';
    // the load counter doubles as the countdown
    preCount.textContent = String(Math.min(99, Math.round(shown))).padStart(2, '0');
    if (shown >= 99.5) setTimeout(beginLaunch, 220);
    else requestAnimationFrame(preTick);
  })();

//   FORMATIONS.forEach(f => { const i = new Image(); i.src = ART + f.art; });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    buildCloud();
    setFormation(0);
    tick();
  });