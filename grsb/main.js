document.addEventListener('DOMContentLoaded', function () {
  initNav();
  initSiteContent();
  initPlayer();
  initConcerts();
});

function initNav() {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  links.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function fetchJson(path) {
  return fetch(path, { cache: 'no-store' }).then(function (res) {
    if (!res.ok) throw new Error('Could not load ' + path);
    return res.json();
  });
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function textNode(tag, text, className) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text || '';
  return el;
}

function initSiteContent() {
  var sections = document.querySelectorAll('[data-content-section]');
  if (!sections.length) return;

  fetchJson('content/site.json')
    .then(function (data) { renderSiteContent(data || {}); })
    .catch(function () {});
}

function renderSiteContent(data) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-content-section]'), function (section) {
    var key = section.getAttribute('data-content-section');
    var content = data[key];
    if (!content) return;

    Array.prototype.forEach.call(section.querySelectorAll('[data-content-field]'), function (field) {
      var name = field.getAttribute('data-content-field');
      if (name === 'button') {
        if (content.buttonText) field.textContent = content.buttonText;
        if (content.buttonLink) field.setAttribute('href', content.buttonLink);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(content, name)) field.textContent = content[name] || '';
    });
  });
}

function fallbackConcertsFromTemplate() {
  var source = document.getElementById('concert-source');
  if (!source) return [];

  return Array.prototype.map.call(source.content.querySelectorAll('.concert-item'), function (el) {
    return {
      date: el.getAttribute('data-date') || '',
      title: el.getAttribute('data-title') || '',
      time: el.getAttribute('data-when') || '',
      link: el.getAttribute('data-href') || '',
      cta: el.getAttribute('data-cta') || 'Details'
    };
  });
}

function parseLocalDate(value) {
  var p = String(value || '').split('-');
  return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
}

function initConcerts() {
  var upWrap = document.getElementById('upcoming-list');
  var pastWrap = document.getElementById('past-list');
  if (!upWrap || !pastWrap) return;

  fetchJson('content/concerts.json')
    .then(function (data) { renderConcerts(data.concerts || []); })
    .catch(function () { renderConcerts(fallbackConcertsFromTemplate()); });
}

function renderConcerts(items) {
  var upWrap = document.getElementById('upcoming-list');
  var pastWrap = document.getElementById('past-list');
  var ue = document.getElementById('upcoming-empty');
  var pe = document.getElementById('past-empty');
  if (!upWrap || !pastWrap) return;

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var concerts = (items || []).filter(function (c) { return c && c.date && c.title; }).map(function (c) {
    return {
      date: parseLocalDate(c.date),
      title: c.title,
      when: c.time || c.when || '',
      link: c.link || c.href || '',
      cta: c.cta || 'Details'
    };
  });

  function card(c, past) {
    var d = c.date;
    var root = c.link ? document.createElement('a') : document.createElement('div');
    root.className = 'concert' + (past ? ' is-past' : '');
    if (c.link) {
      root.href = c.link;
      root.target = '_blank';
      root.rel = 'noopener';
    }

    var date = document.createElement('div');
    date.className = 'concert-date';
    date.appendChild(textNode('div', MON[d.getMonth()], 'mon'));
    date.appendChild(textNode('div', d.getDate(), 'day'));
    date.appendChild(textNode('div', d.getFullYear(), 'yr'));

    var body = document.createElement('div');
    body.className = 'concert-body';
    body.appendChild(textNode('h3', c.title));
    body.appendChild(textNode('div', c.when, 'when'));
    body.appendChild(textNode('span', c.link ? c.cta : (past ? 'Program' : 'Details coming soon'), 'tag'));

    root.appendChild(date);
    root.appendChild(body);
    return root;
  }

  var upcoming = concerts.filter(function (c) { return c.date >= today; }).sort(function (a, b) { return a.date - b.date; });
  var past = concerts.filter(function (c) { return c.date < today; }).sort(function (a, b) { return b.date - a.date; });

  clearNode(upWrap);
  clearNode(pastWrap);
  upcoming.forEach(function (c) { upWrap.appendChild(card(c, false)); });
  past.forEach(function (c) { pastWrap.appendChild(card(c, true)); });

  if (ue) ue.style.display = upcoming.length ? 'none' : '';
  upWrap.style.display = upcoming.length ? '' : 'none';
  if (pe) pe.style.display = past.length ? 'none' : '';
  pastWrap.style.display = past.length ? '' : 'none';
}

function fallbackTracksFromMarkup(root) {
  return Array.prototype.slice.call(root.querySelectorAll('.playlist-item')).map(function (el) {
    var name = el.querySelector('.pl-name');
    return {
      title: name ? name.textContent : '',
      file: el.getAttribute('data-src') || '',
      remote: el.getAttribute('data-remote') || ''
    };
  }).filter(function (track) { return track.title && (track.file || track.remote); });
}

function renderPlaylist(root, tracks) {
  var list = document.getElementById('playlist');
  if (!list || !tracks.length) return;

  clearNode(list);
  tracks.forEach(function (track, index) {
    var li = document.createElement('li');
    li.className = 'playlist-item' + (index === 0 ? ' is-active' : '');
    li.setAttribute('data-src', track.file || '');
    li.setAttribute('data-remote', track.remote || '');
    li.appendChild(document.createElement('span')).className = 'pl-ico';
    li.appendChild(textNode('span', track.title, 'pl-name'));
    list.appendChild(li);
  });
}

function initPlayer() {
  var root = document.getElementById('player');
  if (!root) return;

  var fallbackTracks = fallbackTracksFromMarkup(root);
  fetchJson('content/audio.json')
    .then(function (data) {
      renderPlaylist(root, data.tracks || fallbackTracks);
      wirePlayer(root);
    })
    .catch(function () {
      renderPlaylist(root, fallbackTracks);
      wirePlayer(root);
    });
}

function wirePlayer(root) {
  var audio = document.getElementById('pl-audio');
  var items = Array.prototype.slice.call(root.querySelectorAll('.playlist-item'));
  var playBtn = document.getElementById('pl-play');
  var prevBtn = document.getElementById('pl-prev');
  var nextBtn = document.getElementById('pl-next');
  var titleEl = document.getElementById('pl-title');
  var curEl = document.getElementById('pl-cur');
  var durEl = document.getElementById('pl-dur');
  var fill = document.getElementById('pl-fill');
  var progress = document.getElementById('pl-progress');
  var volSlider = document.getElementById('pl-vol');
  var muteBtn = document.getElementById('pl-mute');

  if (!audio || !items.length || !playBtn || !prevBtn || !nextBtn || !titleEl || !curEl || !durEl || !fill || !progress) return;

  var icPlay = playBtn.querySelector('.ic-play');
  var icPause = playBtn.querySelector('.ic-pause');
  var icVol = muteBtn ? muteBtn.querySelector('.ic-vol') : null;
  var icMuted = muteBtn ? muteBtn.querySelector('.ic-muted') : null;
  var index = 0;
  var seeking = false;
  var lastVol = 1;
  var triedRemote = false;

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function play() { audio.play().catch(function () {}); }
  function pause() { audio.pause(); }

  function load(i, autoplay) {
    index = (i + items.length) % items.length;
    items.forEach(function (el, n) {
      el.classList.toggle('is-active', n === index);
      if (n !== index) el.classList.remove('is-playing');
    });
    var li = items[index];
    var name = li.querySelector('.pl-name');
    triedRemote = false;
    audio.src = li.getAttribute('data-src') || li.getAttribute('data-remote') || '';
    titleEl.textContent = name ? name.textContent : '';
    curEl.textContent = '0:00';
    durEl.textContent = '0:00';
    fill.style.width = '0%';
    if (autoplay) play();
  }

  audio.addEventListener('error', function () {
    var li = items[index];
    var remote = li && li.getAttribute('data-remote');
    if (!triedRemote && remote && audio.src !== remote) {
      triedRemote = true;
      var wasPlaying = !audio.paused;
      audio.src = remote;
      audio.load();
      if (wasPlaying) play();
    }
  });

  function setPlayingUI(on) {
    if (icPlay) icPlay.style.display = on ? 'none' : '';
    if (icPause) icPause.style.display = on ? '' : 'none';
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    items[index].classList.toggle('is-playing', on);
  }

  playBtn.addEventListener('click', function () { audio.paused ? play() : pause(); });
  prevBtn.addEventListener('click', function () { load(index - 1, !audio.paused); });
  nextBtn.addEventListener('click', function () { load(index + 1, !audio.paused); });

  items.forEach(function (el, n) {
    el.addEventListener('click', function () {
      if (n === index) audio.paused ? play() : pause();
      else load(n, true);
    });
  });

  audio.addEventListener('play', function () { setPlayingUI(true); });
  audio.addEventListener('pause', function () { setPlayingUI(false); });
  audio.addEventListener('ended', function () { load(index + 1, true); });
  audio.addEventListener('loadedmetadata', function () { durEl.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', function () {
    if (seeking) return;
    curEl.textContent = fmt(audio.currentTime);
    if (audio.duration) {
      var pct = (audio.currentTime / audio.duration) * 100;
      fill.style.width = pct + '%';
      progress.setAttribute('aria-valuenow', Math.round(pct));
    }
  });

  function seekFromEvent(e) {
    var rect = progress.getBoundingClientRect();
    var point = e.touches ? e.touches[0] : e;
    var x = point.clientX - rect.left;
    var ratio = Math.min(1, Math.max(0, x / rect.width));
    fill.style.width = (ratio * 100) + '%';
    if (audio.duration) audio.currentTime = ratio * audio.duration;
  }

  progress.addEventListener('mousedown', function (e) { seeking = true; seekFromEvent(e); });
  document.addEventListener('mousemove', function (e) { if (seeking) seekFromEvent(e); });
  document.addEventListener('mouseup', function () { seeking = false; });
  progress.addEventListener('touchstart', function (e) { seeking = true; seekFromEvent(e); }, { passive: true });
  progress.addEventListener('touchmove', function (e) { if (seeking) seekFromEvent(e); }, { passive: true });
  progress.addEventListener('touchend', function () { seeking = false; });
  progress.addEventListener('keydown', function (e) {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
  });

  function reflectVolume() {
    var v = audio.muted ? 0 : audio.volume;
    if (volSlider) volSlider.value = v;
    if (icVol && icMuted) {
      var off = audio.muted || audio.volume === 0;
      icVol.style.display = off ? 'none' : '';
      icMuted.style.display = off ? '' : 'none';
    }
    if (muteBtn) muteBtn.setAttribute('aria-label', (audio.muted || audio.volume === 0) ? 'Unmute' : 'Mute');
  }

  if (volSlider) {
    volSlider.addEventListener('input', function () {
      audio.volume = parseFloat(volSlider.value);
      audio.muted = false;
      if (audio.volume > 0) lastVol = audio.volume;
      reflectVolume();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', function () {
      if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        audio.volume = lastVol > 0 ? lastVol : 1;
      } else {
        lastVol = audio.volume;
        audio.muted = true;
      }
      reflectVolume();
    });
  }

  audio.addEventListener('volumechange', reflectVolume);
  load(0, false);
  reflectVolume();
}
