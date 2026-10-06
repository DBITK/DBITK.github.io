/* =============================================================
   MUSEUM.EXE — engine. Renders rooms on a fixed 860×480 stage,
   wires hotspots, the docent, panels, custom tour links, and the
   staged exhibits. Content and room layouts live in exhibits.js;
   design notes in docs/MUSEUM.md. Everything here is scripted:
   no live services.
   ============================================================= */
(function () {
  const D = window.MUSEUM_DATA;
  const W = 860, H = 480;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     Custom tour links: #tour=<base64url JSON { to, note, ex }>.
     Kept in the URL fragment, which is never sent to a server.
     --------------------------------------------------------------- */
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  function readTour() {
    const m = location.hash.match(/(?:^#|&)tour=([A-Za-z0-9_-]+)/);
    let raw = m ? m[1] : null;
    try {
      if (raw) sessionStorage.setItem('museumTour', raw);   // survives the hash changing later
      else raw = sessionStorage.getItem('museumTour');
    } catch (_) {}
    if (!raw) return null;
    try {
      const t = JSON.parse(b64urlDecode(raw));
      const ex = (Array.isArray(t.ex) ? t.ex : []).filter(id => D.exhibits[id]).slice(0, 6);
      return {
        to: String(t.to || '').slice(0, 60),
        note: String(t.note || '').slice(0, 600),
        ex: ex.length ? ex : D.defaultTour.slice(),
      };
    } catch (_) {
      return null;
    }
  }
  window.MUSEUM_TOUR = readTour();

  /* Build a tour link from the browser console:
     museumTourLink({ to: 'Acme', note: 'Start with the Canary Lab.', ex: ['canary-lab', 'eli5'] }) */
  window.museumTourLink = function (opts) {
    opts = opts || {};
    const payload = { to: opts.to || '', note: opts.note || '', ex: opts.ex || D.defaultTour };
    return 'https://derekbartlett.com/#tour=' + b64urlEncode(JSON.stringify(payload));
  };

  const tourExhibits = () => (window.MUSEUM_TOUR ? window.MUSEUM_TOUR.ex : D.defaultTour);

  /* ---------------------------------------------------------------
     Docent: pixel-art Derek (12×24 grid)
     --------------------------------------------------------------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DOCENT = [
    '....hhhh....', '..hhhhhhhh..', '..hhhhhhhh..', '..hssssssh..', '..ssessess..', '..ssssssss..',
    '..sssmmsss..', '...ssssss...', '....ssss....', '..rrrrrrrr..', '.rrrrrrrrrr.', 'rrrrrrrrrrrr',
    'rrrrrrrrrrrr', 'srrrrrrrrrrs', 's.rrrrrrrr.s', '..rrrrrrrr..', '..bbbbbbbb..', '..bbbbbbbb..',
    '..bbb..bbb..', '..bbb..bbb..', '..bbb..bbb..', '..bbb..bbb..', '..kkk..kkk..', '.kkkk..kkkk.',
  ];
  const DOCENT_COLORS = { h: '#5a3a1e', s: '#f1c27d', e: '#222', m: '#a0522d', r: '#c4202c', b: '#2f4f8f', k: '#222' };
  function docentSvg(px) {
    const rects = [];
    DOCENT.forEach((row, y) => [...row].forEach((ch, x) => {
      if (DOCENT_COLORS[ch]) rects.push('<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + DOCENT_COLORS[ch] + '"/>');
    }));
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + 12 * px + '" height="' + 24 * px +
           '" viewBox="0 0 12 24" shape-rendering="crispEdges">' + rects.join('') + '</svg>';
  }

  /* ---------------------------------------------------------------
     Rooms: art + hotspots from exhibits.js. The lobby's entrances
     depend on the tour; every other room is fixed.
     --------------------------------------------------------------- */
  function sceneHotspots(id) {
    const sc = D.scenes[id];
    if (id !== 'lobby') return sc.hotspots || [];
    const spots = [];
    tourExhibits().forEach(exId => {
      const e = sc.entrances[exId];
      if (e) spots.push(Object.assign({}, e, { action: { go: D.exhibits[exId].scene } }));
    });
    spots.push(...sc.always);
    if (!window.MUSEUM_TOUR) {
      sc.soon.forEach(s => spots.push(Object.assign({}, s, {
        closed: true, label: s.title + ' (coming soon)',
        action: { say: 'The ' + s.title + ' is still being built. Check back soon!' },
      })));
    }
    return spots;
  }

  function runAction(a) {
    if (a.go) go(a.go);
    else if (a.sim === 'canary') openCanarySim();
    else if (a.placard) openPlacard(a.placard);
    else if (a.eli5) openEli5(a.eli5);
    else if (a.eli5Index) openEli5Index();
    else if (a.window) openWindow(a.window);   // the real desktop window opens on top
    else if (a.resume) openResume();
    else if (a.say) say(a.say);
  }

  /* ---------------------------------------------------------------
     Engine
     --------------------------------------------------------------- */
  let host, fitEl, stage, artEl, hotEl, statusRoom, statusLabel, layerEl;
  let built = false, current = null, panelClose = null;

  function build() {
    host = document.getElementById('museum-host');
    host.innerHTML =
      '<div class="museum-fit"><div class="museum-stage">' +
      '<div class="m-art"></div><div class="m-hotspots"></div><div class="m-layer"></div>' +
      '<div class="m-status"><span class="m-room"></span><span class="m-label"></span></div>' +
      '</div></div>';
    fitEl = host.querySelector('.museum-fit');
    stage = host.querySelector('.museum-stage');
    artEl = host.querySelector('.m-art');
    hotEl = host.querySelector('.m-hotspots');
    layerEl = host.querySelector('.m-layer');
    statusRoom = host.querySelector('.m-room');
    statusLabel = host.querySelector('.m-label');
    if (window.ResizeObserver) new ResizeObserver(fitStage).observe(host);
    fitStage();
    built = true;
  }

  /* Scale the 860×480 stage to fit the window, letterboxed */
  function fitStage() {
    const s = Math.min(host.clientWidth / W, host.clientHeight / H);
    if (!(s > 0)) return;
    fitEl.style.width = (W * s) + 'px';
    fitEl.style.height = (H * s) + 'px';
    stage.style.transform = 'scale(' + s + ')';
  }

  function setLabel(text) { statusLabel.textContent = text || ''; }

  function go(sceneId) {
    const sc = D.scenes[sceneId];
    if (!sc) return;
    closePanel();
    current = sceneId;
    artEl.innerHTML = sc.art
      ? '<img alt="" src="' + esc(sc.art) + '">'
      : '<div class="m-noart">' + esc(sc.title) + '</div>';
    layerEl.innerHTML = '';
    hotEl.innerHTML = '';

    sceneHotspots(sceneId).forEach(h => {
      const b = document.createElement('button');
      b.className = 'm-hotspot' + (h.closed ? ' m-closed' : '');
      b.style.cssText = 'left:' + h.x + 'px;top:' + h.y + 'px;width:' + h.w + 'px;height:' + h.h + 'px;';
      b.setAttribute('aria-label', h.label);
      b.addEventListener('mouseenter', () => setLabel(h.label));
      b.addEventListener('focus', () => setLabel(h.label));
      b.addEventListener('mouseleave', () => setLabel(''));
      b.addEventListener('click', () => runAction(h.action));
      hotEl.appendChild(b);
      if (h.sign) {   // neon sign over the storefront
        const s = document.createElement('div');
        s.className = 'm-sign' + (h.closed ? ' m-sign-off' : '');
        s.style.cssText = 'left:' + h.sign.x + 'px;top:' + h.sign.y + 'px;';
        s.textContent = h.sign.text;
        layerEl.appendChild(s);
      }
    });

    if (sceneId !== 'lobby') {
      const back = document.createElement('button');
      back.className = 'm-btn m-nav';
      back.textContent = '◄ LOBBY';
      back.setAttribute('aria-label', 'Back to the lobby');
      back.addEventListener('click', () => go('lobby'));
      layerEl.appendChild(back);
    }

    statusRoom.textContent = '■ ' + sc.title;
    setLabel('');
    if (sceneId === 'lobby') { placeDocent(sc.docent); greet(); }
  }

  /* ---- Docent ---- */
  let docentPos = { x: 548, y: 338 };
  function placeDocent(pos) {
    docentPos = pos || docentPos;
    const d = document.createElement('div');
    d.className = 'm-docent';
    d.style.cssText = 'left:' + docentPos.x + 'px;top:' + docentPos.y + 'px;';
    d.innerHTML = docentSvg(4);
    layerEl.appendChild(d);
    const talk = document.createElement('button');
    talk.className = 'm-hotspot';
    talk.style.cssText = 'left:' + (docentPos.x - 4) + 'px;top:' + (docentPos.y - 4) + 'px;width:56px;height:104px;';
    talk.setAttribute('aria-label', 'Talk to the docent');
    talk.addEventListener('mouseenter', () => setLabel('Talk to the docent'));
    talk.addEventListener('mouseleave', () => setLabel(''));
    talk.addEventListener('click', greet);
    hotEl.appendChild(talk);
  }

  function say(text, heading) {
    if (current !== 'lobby') return;
    let b = layerEl.querySelector('.m-bubble');
    if (!b) {
      b = document.createElement('div');
      b.className = 'm-bubble';
      b.style.cssText = 'left:' + (docentPos.x + 62) + 'px;top:' + (docentPos.y - 12) + 'px;max-width:236px;max-height:118px;overflow:auto;';
      layerEl.appendChild(b);
    }
    b.innerHTML = '';
    const x = document.createElement('button');
    x.className = 'm-bubble-close';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '✕';
    x.addEventListener('click', () => b.remove());
    b.appendChild(x);
    if (heading) {
      const h = document.createElement('span');
      h.className = 'm-bubble-to';
      h.textContent = heading;
      b.appendChild(h);
    }
    b.appendChild(document.createTextNode(text));   // plain text only, never HTML
  }

  function greet() {
    const t = window.MUSEUM_TOUR;
    if (t && (t.note || t.to)) {
      say((t.note ? t.note + '\n\n' : '') + 'I lit up the exhibits I think you\'ll like most. ' +
          'My résumé is up the escalator in the Front Office.',
          t.to ? 'Hi ' + t.to + '!' : 'Welcome!');
    } else {
      say('Every exhibit is hands-on: click a lit storefront, then push all the buttons. ' +
          'My résumé is up the escalator in the Front Office.', 'Welcome to my museum!');
    }
  }

  /* ---- Panels: Win98-style windows inside the stage ---- */
  function openPanel(title, body, onClose) {
    closePanel();
    const back = document.createElement('div');
    back.className = 'm-panel-backdrop';
    back.innerHTML = '<div class="m-panel" role="dialog" aria-label="' + esc(title) + '">' +
      '<div class="m-panel-title"><span>' + esc(title) + '</span><button class="m-panel-x" aria-label="Close">✕</button></div>' +
      '<div class="m-panel-body"></div></div>';
    back.querySelector('.m-panel-body').appendChild(body);
    back.querySelector('.m-panel-x').addEventListener('click', closePanel);
    back.addEventListener('mousedown', e => { if (e.target === back) closePanel(); });
    stage.appendChild(back);
    panelClose = () => { back.remove(); if (onClose) onClose(); };
  }
  function closePanel() {
    if (panelClose) { const f = panelClose; panelClose = null; f(); }
  }

  /* Esc closes an open museum panel before anything else */
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panelClose) {
      closePanel();
      e.stopPropagation();
    }
  }, true);

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'text') n.textContent = v;
      else if (k === 'on') Object.entries(v).forEach(([ev, fn]) => n.addEventListener(ev, fn));
      else n.setAttribute(k, v);
    });
    (children || []).forEach(c => n.appendChild(c));
    return n;
  }

  function openPlacard(id) {
    const ex = D.exhibits[id];
    const p = ex.placard;
    const body = el('div', {}, [
      el('h3', { text: p.title }),
      ...p.text.map(t => el('p', { text: t })),
      el('div', { class: 'm-tags' }, p.tags.map(t => el('span', { class: 'm-tag', text: t }))),
      el('div', { class: 'm-links' }, [
        ...ex.evidence.map(l => el('a', { href: l.href, target: '_blank', rel: 'noopener', text: l.label + ' ↗' })),
        el('button', { class: 'm-btn m-primary', text: '▶ Try it', on: { click: openCanarySim } }),
        el('button', { class: 'm-btn', text: 'ELI5 →', on: { click: () => openEli5(ex.eli5) } }),
      ]),
    ]);
    openPanel('Placard — ' + ex.title, body);
  }

  function openEli5(key) {
    const c = D.eli5[key];
    if (!c) return;
    const kids = [el('h3', { text: c.title }), el('div', { class: 'e5-card' }, c.text.map(t => el('p', { text: t })))];
    if (c.exhibit && D.exhibits[c.exhibit] && current !== D.exhibits[c.exhibit].scene) {
      kids.push(el('div', { class: 'm-links', style: 'margin-top:10px' }, [
        el('button', { class: 'm-btn', text: 'See the real thing: ' + D.exhibits[c.exhibit].title + ' →',
                       on: { click: () => go(D.exhibits[c.exhibit].scene) } }),
      ]));
    }
    openPanel('ELI5 tape — ' + c.title, el('div', {}, kids));
  }

  function openEli5Index() {
    const keys = Object.keys(D.eli5);
    openPanel('ELI5 tapes', el('div', {}, [
      el('h3', { text: 'ELI5 tapes' }),
      el('p', { text: 'Plain-language explanations of the ideas behind each exhibit. More tapes coming soon.' }),
      el('div', { class: 'm-links' }, keys.map(k =>
        el('button', { class: 'm-btn', text: '▶ ' + D.eli5[k].title, on: { click: () => openEli5(k) } }))),
    ]));
  }

  /* The résumé, cloned from the page's print résumé so there's one source of truth */
  function openResume() {
    const src = document.getElementById('resume-print');
    const doc = el('div', { class: 'm-resume' });
    doc.innerHTML = src ? src.innerHTML : '';
    openPanel('Résumé — Derek Bartlett', el('div', {}, [
      el('div', { class: 'm-links', style: 'margin-bottom:8px' }, [
        el('button', { class: 'm-btn m-primary', text: 'Print / Save as PDF', on: { click: () => window.print() } }),
        el('button', { class: 'm-btn', text: 'contact.txt', on: { click: () => openWindow('contact') } }),
      ]),
      doc,
    ]));
  }

  /* ---------------------------------------------------------------
     Canary Lab: a staged canary analysis. Samples come from a seeded
     random generator, so the same settings always give the same
     result; the judge is a real Mann-Whitney U test plus Cliff's
     delta, mirroring Golden Path's rules.
     --------------------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    let u = 0;
    while (!u) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
  function erf(x) {   // Abramowitz & Stegun 7.1.26
    const s = Math.sign(x); x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const phi = z => 0.5 * (1 + erf(z / Math.SQRT2));

  /* One-sided Mann-Whitney U (is b larger than a?), tie and continuity corrected */
  function mannWhitney(a, b) {
    const all = a.map(v => [v, 0]).concat(b.map(v => [v, 1])).sort((x, y) => x[0] - y[0]);
    const n = all.length;
    let rankB = 0, tie = 0;
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && all[j + 1][0] === all[i][0]) j++;
      const rank = (i + j + 2) / 2, t = j - i + 1;
      tie += t * t * t - t;
      for (let k = i; k <= j; k++) if (all[k][1]) rankB += rank;
      i = j + 1;
    }
    const n1 = a.length, n2 = b.length;
    const U = rankB - n2 * (n2 + 1) / 2;
    const mu = n1 * n2 / 2;
    const sigma = Math.sqrt(n1 * n2 / 12 * ((n + 1) - tie / (n * (n - 1))));
    const z = (U - mu - 0.5) / sigma;
    return 1 - phi(z);
  }
  /* Cliff's delta: +1 means every canary sample is larger */
  function cliffsDelta(a, b) {
    let gt = 0, lt = 0;
    for (const x of b) for (const y of a) { if (x > y) gt++; else if (x < y) lt++; }
    return (gt - lt) / (a.length * b.length);
  }
  const median = arr => { const s = arr.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  const BASE = { v: 'v1.4.2', p50: 120, err: 0.3 };
  const CAN = 'v1.5.0';
  const N_LAT = 200, N_REQ = 4000;

  function judge(addMs, errPct) {
    const rng = mulberry32(1000003 + addMs * 7919 + Math.round(errPct * 100) * 104729);
    const base = [], can = [];
    for (let i = 0; i < N_LAT; i++) base.push(BASE.p50 * Math.exp(0.32 * gauss(rng)));
    for (let i = 0; i < N_LAT; i++) can.push((BASE.p50 + addMs) * Math.exp(0.32 * gauss(rng)));
    let eB = 0, eC = 0;
    for (let i = 0; i < N_REQ; i++) { if (rng() < BASE.err / 100) eB++; if (rng() < errPct / 100) eC++; }

    const pLat = mannWhitney(base, can), dLat = cliffsDelta(base, can);
    // Latency: must be significant AND materially different to fail
    const latRes = pLat < 0.05 && dLat >= 0.33 ? 'fail' : pLat < 0.05 && dLat >= 0.147 ? 'marginal' : 'pass';

    // Error rate (critical): one-sided two-proportion z-test plus a 0.2-point tolerance
    const p1 = eB / N_REQ, p2 = eC / N_REQ, pool = (eB + eC) / (2 * N_REQ);
    const se = Math.sqrt(pool * (1 - pool) * 2 / N_REQ) || 1;
    const pErr = 1 - phi((p2 - p1) / se);
    const errRes = pErr < 0.05 && (p2 - p1) * 100 >= 0.2 ? 'fail' : 'pass';

    const verdict = errRes === 'fail' || latRes === 'fail' ? 'rollback' : latRes === 'marginal' ? 'marginal' : 'promote';
    return { base, can, pLat, dLat, latRes, eB, eC, p1, p2, pErr, errRes, verdict };
  }

  function openCanarySim() {
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, reduceMotion ? 0 : ms));

    const lat = el('input', { type: 'range', min: '0', max: '120', step: '5', value: '10' });
    const err = el('input', { type: 'range', min: '0', max: '3', step: '0.1', value: '0.3' });
    const latVal = el('span', { class: 'cl-val' });
    const errVal = el('span', { class: 'cl-val' });
    const sync = () => {
      latVal.textContent = '+' + lat.value + ' ms';
      errVal.textContent = Number(err.value).toFixed(1) + '%';
    };
    lat.addEventListener('input', sync);
    err.addEventListener('input', sync);
    sync();

    const screen = el('div', { class: 'cl-screen', 'aria-live': 'polite' });
    screen.textContent = '> Ready. Set up the canary, then press Run.';
    const run = el('button', { class: 'm-btn m-primary cl-run', text: '▶ Run canary' });

    const controls = el('div', { class: 'cl-controls' }, [
      el('label', {}, [document.createTextNode('Canary latency '), latVal]), lat,
      el('label', {}, [document.createTextNode('Canary error rate '), errVal]), err,
      el('div', { class: 'cl-baseline', text: 'Baseline ' + BASE.v + ': p50 ' + BASE.p50 + ' ms, ' + BASE.err + '% errors. ' +
        'Slow the canary down or make it flaky, and see what the judge does.' }),
      run,
    ]);

    function line(text, cls) {
      const d = el('div', { text });
      if (cls) d.className = cls;
      screen.appendChild(d);
      return d;
    }

    run.addEventListener('click', () => {
      timers.forEach(t => { clearTimeout(t); clearInterval(t); });
      timers = [];
      run.disabled = true;
      screen.innerHTML = '';
      const r = judge(Number(lat.value), Number(err.value));
      line('> deploy baseline ' + BASE.v + ' (fresh) ......... ok');
      later(() => line('> deploy canary ' + CAN + ' ................ ok'), 350);
      later(() => {
        line('> driving identical load through both:');
        const lanes = el('div', { class: 'cl-lanes' }, [
          el('div', { class: 'cl-lane base' }, [el('span', { text: 'baseline ' + BASE.v })]),
          el('div', { class: 'cl-lane can' }, [el('span', { text: 'canary ' + CAN })]),
        ]);
        screen.appendChild(lanes);
        const counter = line('  samples 0/' + N_LAT);
        let n = 0;
        const tick = setInterval(() => {
          n = Math.min(N_LAT, n + 9);
          counter.textContent = '  samples ' + n + '/' + N_LAT;
          lanes.querySelectorAll('.cl-lane').forEach(l => {
            const d = el('i', { class: 'cl-dot' });
            l.appendChild(d);
            setTimeout(() => d.remove(), 1100);
          });
          if (n >= N_LAT) clearInterval(tick);
        }, reduceMotion ? 0 : 70);
        timers.push(tick);
      }, 700);
      later(() => { line('> judging...'); showResults(r); }, 2500);
    });

    function showResults(r) {
      screen.querySelectorAll('.cl-lanes').forEach(n => n.remove());
      const c = el('canvas', { class: 'cl-hist', width: '320', height: '70' });
      screen.appendChild(c);
      drawHist(c, r.base, r.can);

      const cls = res => res === 'fail' ? 'cl-fail' : res === 'marginal' ? 'cl-warn' : 'cl-pass';
      const fmtP = p => p < 0.001 ? '<0.001' : p.toFixed(3);
      const table = el('table', { class: 'cl-table' });
      table.innerHTML = '<tr><th>metric</th><th>baseline</th><th>canary</th><th>p</th><th>effect</th><th></th></tr>';
      const rows = [
        ['latency', Math.round(median(r.base)) + 'ms', Math.round(median(r.can)) + 'ms', fmtP(r.pLat), 'δ ' + r.dLat.toFixed(2), r.latRes],
        ['errors★', (r.p1 * 100).toFixed(2) + '%', (r.p2 * 100).toFixed(2) + '%', fmtP(r.pErr), (r.p2 > r.p1 ? '+' : '') + ((r.p2 - r.p1) * 100).toFixed(2) + 'pt', r.errRes],
      ];
      rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach((v, i) => {
          const td = document.createElement('td');
          td.textContent = i === 5 ? v.toUpperCase() : v;
          if (i === 5) td.className = cls(v);
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      screen.appendChild(table);
      line('★ critical: fails the canary on its own, whatever else looks good');

      const v = el('div', { class: 'cl-verdict' });
      if (r.verdict === 'promote') {
        v.className += ' cl-pass';
        v.textContent = '✔ PROMOTE — red/black switch: 100% of traffic → ' + CAN + '. ' + BASE.v + ' stays warm for instant rollback.';
      } else if (r.verdict === 'rollback') {
        v.className += ' cl-fail';
        v.textContent = '✘ ROLLBACK — canary destroyed. Traffic never moved, so no user ever saw ' + CAN + '.';
      } else {
        v.className += ' cl-warn';
        v.textContent = '? MARGINAL — slower, but only a little. This is the one case that pages a human. That\'s you:';
        const human = el('div', { class: 'cl-human' }, [
          el('button', { class: 'm-btn', text: 'Promote anyway', on: { click: () => decide('promote') } }),
          el('button', { class: 'm-btn', text: 'Reject', on: { click: () => decide('reject') } }),
        ]);
        v.appendChild(human);
        function decide(choice) {
          human.remove();
          line(choice === 'promote'
            ? '> human approved: traffic → ' + CAN + ' (and the decision is on the record)'
            : '> human rejected: canary destroyed, traffic never moved', choice === 'promote' ? 'cl-pass' : 'cl-fail');
        }
      }
      screen.appendChild(v);
      const scroller = screen.closest('.m-panel-body');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      run.disabled = false;
      run.textContent = '↻ Run again';
    }

    openPanel('Canary Analysis — Golden Path judge',
      el('div', { class: 'cl-grid' }, [controls, screen]),
      () => timers.forEach(t => { clearTimeout(t); clearInterval(t); }));
  }

  function drawHist(canvas, base, can) {
    const ctx = canvas.getContext('2d');
    const lo = 40, hi = 420, bins = 38, bw = canvas.width / bins;
    const count = arr => {
      const h = new Array(bins).fill(0);
      arr.forEach(v => { const i = Math.floor((v - lo) / (hi - lo) * bins); if (i >= 0 && i < bins) h[i]++; });
      return h;
    };
    const hb = count(base), hc = count(can);
    const max = Math.max(...hb, ...hc, 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hb.forEach((v, i) => {
      ctx.fillStyle = 'rgba(61,255,61,0.55)';
      ctx.fillRect(i * bw, canvas.height - (v / max) * 60 - 10, bw - 1, (v / max) * 60);
    });
    hc.forEach((v, i) => {
      ctx.strokeStyle = '#ffe14d';
      ctx.strokeRect(i * bw + 0.5, canvas.height - (v / max) * 60 - 10 + 0.5, bw - 2, (v / max) * 60);
    });
    ctx.fillStyle = '#9dff9d';
    ctx.font = '9px Courier New';
    ctx.fillText('latency (ms) →   ■ baseline   □ canary', 4, canvas.height - 1);
  }

  /* ---------------------------------------------------------------
     Splash + entry point (called by openWindow('museum'))
     --------------------------------------------------------------- */
  let splashShown = false;
  function splash() {
    splashShown = true;
    // Warm the cache for the room art while the splash plays
    Object.values(D.scenes).forEach(sc => { if (sc.art) { const i = new Image(); i.src = sc.art; } });
    const s = document.createElement('div');
    s.className = 'm-splash';
    s.innerHTML = '<div class="m-cd"></div><div class="m-logo">Derek\'s Museum<br>of Technology</div>' +
      '<div class="m-edition">CD-ROM EDITION · DISC 1 OF 1</div>' +
      '<div class="m-loadbar"><div></div></div><div class="m-msg"></div>';
    stage.appendChild(s);
    const bar = s.querySelector('.m-loadbar > div');
    const msg = s.querySelector('.m-msg');
    const steps = ['Checking CD-ROM drive...', 'Loading exhibits...', 'Polishing the floors...', 'Waking up the docent...'];
    let i = 0;
    const iv = setInterval(() => {
      msg.textContent = steps[Math.min(i, steps.length - 1)];
      bar.style.width = Math.min(100, (i + 1) * 25) + '%';
      if (++i > steps.length) {
        clearInterval(iv);
        s.querySelector('.m-loadbar').remove();
        msg.remove();
        const c = document.createElement('div');
        c.className = 'm-click';
        c.textContent = '[ CLICK ANYWHERE TO ENTER ]';
        s.appendChild(c);
        s.style.cursor = 'pointer';
        s.addEventListener('click', () => { s.remove(); go('lobby'); }, { once: true });
      }
    }, reduceMotion ? 60 : 420);
  }

  window.museumOnOpen = function () {
    if (!built) build();
    fitStage();
    if (!splashShown) splash();
  };
})();
