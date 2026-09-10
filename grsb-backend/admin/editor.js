(function () {
  var state = { concerts: [], tracks: [], site: {} };
  var status = document.getElementById('status');
  var settingsList = document.getElementById('settings-list');
  var concertsList = document.getElementById('concerts-list');
  var tracksList = document.getElementById('tracks-list');
  var tokenInput = document.getElementById('admin-token');
  var backendStatus = document.getElementById('backend-status');
  var backendDetails = document.getElementById('backend-details');
  var backendAvailable = false;
  var backendHealth = null;

  function setStatus(message) {
    status.textContent = message || '';
  }

  function backendSummary(health) {
    if (!health) return 'Health check unavailable. Save is disabled until a backend is configured.';
    if (health.backend === 'node') {
      return 'Node backend detected. Persistence: mounted content directory. Admin API: ' + (health.adminApiEnabled ? 'enabled.' : 'disabled until GRSB_ADMIN_TOKEN is set.');
    }
    if (health.persistence === 'github') {
      return 'Sites backend detected. Persistence: GitHub repository. Admin API: ' + (health.adminApiEnabled ? 'enabled.' : 'disabled until GRSB_ADMIN_TOKEN is set.');
    }
    return 'Sites static preview detected. Save is disabled until GitHub-backed secrets are configured.';
  }

  function hasAdminSaveApi(health) {
    return Boolean(health && health.adminApiEnabled);
  }

  function renderBackendDetails() {
    if (!backendDetails) return;
    backendDetails.innerHTML = '';
    var title = document.createElement('strong');
    title.textContent = 'Backend status';
    var body = document.createElement('span');
    body.textContent = backendSummary(backendHealth);
    backendDetails.appendChild(title);
    backendDetails.appendChild(body);
    if (!backendAvailable) {
      var link = document.createElement('a');
      link.href = '../backend.html';
      link.textContent = 'View backend setup plan';
      backendDetails.appendChild(link);
    }
  }

  function setBackendAvailable(available) {
    backendAvailable = available;
    Array.prototype.forEach.call(document.querySelectorAll('.backend-save'), function (button) {
      button.disabled = !available;
      button.setAttribute('aria-disabled', available ? 'false' : 'true');
    });
    if (tokenInput) tokenInput.disabled = !available;
    if (backendStatus) {
      backendStatus.textContent = available
        ? 'Backend save API detected. Enter the admin token to save changes directly.'
        : 'Save API is not available on this host yet. Use the download buttons, or configure the GitHub-backed Sites API or Node backend.';
    }
    renderBackendDetails();
  }

  function input(label, value, name, wide) {
    var wrap = document.createElement('div');
    wrap.className = 'form-field' + (wide ? ' wide' : '');
    var id = name + '-' + Math.random().toString(36).slice(2);
    var lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = label;
    var field = document.createElement('input');
    field.id = id;
    field.name = name;
    field.value = value || '';
    wrap.appendChild(lab);
    wrap.appendChild(field);
    return wrap;
  }

  function textarea(label, value, name, wide) {
    var wrap = document.createElement('div');
    wrap.className = 'form-field' + (wide ? ' wide' : '');
    var id = name + '-' + Math.random().toString(36).slice(2);
    var lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = label;
    var field = document.createElement('textarea');
    field.id = id;
    field.name = name;
    field.rows = 4;
    field.value = value || '';
    wrap.appendChild(lab);
    wrap.appendChild(field);
    return wrap;
  }

  function readFields(row) {
    var data = {};
    row.querySelectorAll('input, textarea').forEach(function (field) {
      data[field.name] = field.value.trim();
    });
    return data;
  }

  function renderSettings() {
    settingsList.innerHTML = '';
    settingsList.appendChild(settingsGroup('Homepage Announcement', 'announcement', [
      ['Eyebrow', 'eyebrow'],
      ['Title', 'title'],
      ['Body', 'body', 'textarea'],
      ['Button Text', 'buttonText'],
      ['Button Link', 'buttonLink']
    ]));
    settingsList.appendChild(settingsGroup('Donation Callout', 'donation', [
      ['Eyebrow', 'eyebrow'],
      ['Title', 'title'],
      ['Body', 'body', 'textarea'],
      ['Button Text', 'buttonText'],
      ['Button Link', 'buttonLink']
    ]));
    settingsList.appendChild(settingsGroup('Contact', 'contact', [
      ['Phone', 'phone'],
      ['Primary Email', 'email'],
      ['Info Email', 'infoEmail'],
      ['Facebook URL', 'facebook'],
      ['Mailing Address', 'address']
    ]));
    settingsList.appendChild(settingsGroup('Tickets', 'tickets', [
      ['Ticket URL', 'ticketUrl'],
      ['Voucher URL', 'voucherUrl']
    ]));
    settingsList.appendChild(settingsGroup('Support', 'support', [
      ['Givebutter URL', 'givebutterUrl'],
      ['Venmo', 'venmo']
    ]));
  }

  function settingsGroup(title, key, fields) {
    var row = document.createElement('div');
    row.className = 'editor-row';
    row.setAttribute('data-settings-key', key);
    row.appendChild(document.createElement('h3')).textContent = title;
    var wrap = document.createElement('div');
    wrap.className = 'editor-fields';
    fields.forEach(function (field) {
      var label = field[0];
      var name = field[1];
      var type = field[2];
      var value = (state.site[key] && state.site[key][name]) || '';
      wrap.appendChild(type === 'textarea' ? textarea(label, value, name, true) : input(label, value, name, true));
    });
    row.appendChild(wrap);
    return row;
  }

  function renderConcerts() {
    concertsList.innerHTML = '';
    state.concerts.forEach(function (concert, index) {
      var row = document.createElement('div');
      row.className = 'editor-row';
      var fields = document.createElement('div');
      fields.className = 'editor-fields';
      fields.appendChild(input('Date', concert.date, 'date'));
      fields.appendChild(input('Title', concert.title, 'title'));
      fields.appendChild(input('Time / Display Text', concert.time, 'time'));
      fields.appendChild(input('Button Text', concert.cta, 'cta'));
      fields.appendChild(input('Ticket or Program Link', concert.link, 'link', true));
      row.appendChild(fields);
      row.appendChild(removeButton(function () {
        state.concerts.splice(index, 1);
        renderConcerts();
      }));
      concertsList.appendChild(row);
    });
  }

  function renderTracks() {
    tracksList.innerHTML = '';
    state.tracks.forEach(function (track, index) {
      var row = document.createElement('div');
      row.className = 'editor-row';
      var fields = document.createElement('div');
      fields.className = 'editor-fields';
      fields.appendChild(input('Title', track.title, 'title', true));
      fields.appendChild(input('Local MP3 Path', track.file, 'file', true));
      fields.appendChild(input('Fallback Streaming URL', track.remote, 'remote', true));
      row.appendChild(fields);
      row.appendChild(removeButton(function () {
        state.tracks.splice(index, 1);
        renderTracks();
      }));
      tracksList.appendChild(row);
    });
  }

  function removeButton(onClick) {
    var actions = document.createElement('div');
    actions.className = 'editor-row-actions';
    var button = document.createElement('button');
    button.className = 'btn btn--ghost';
    button.type = 'button';
    button.textContent = 'Remove';
    button.addEventListener('click', onClick);
    actions.appendChild(button);
    return actions;
  }

  function collectConcerts() {
    state.concerts = Array.prototype.map.call(concertsList.querySelectorAll('.editor-row'), readFields).filter(function (concert) {
      return concert.date || concert.title || concert.time || concert.link || concert.cta;
    });
    state.concerts.forEach(function (concert) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(concert.date)) throw new Error('Each concert needs a date in YYYY-MM-DD format.');
      if (!concert.title) throw new Error('Each concert needs a title.');
    });
  }

  function collectTracks() {
    state.tracks = Array.prototype.map.call(tracksList.querySelectorAll('.editor-row'), readFields).filter(function (track) {
      return track.title || track.file || track.remote;
    });
    state.tracks.forEach(function (track) {
      if (!track.title) throw new Error('Each audio track needs a title.');
      if (!track.file && !track.remote) throw new Error('Each audio track needs a local path or remote URL.');
    });
  }

  function collectSettings() {
    var next = {};
    Array.prototype.forEach.call(settingsList.querySelectorAll('[data-settings-key]'), function (row) {
      next[row.getAttribute('data-settings-key')] = readFields(row);
    });
    if (!next.announcement.title) throw new Error('Homepage announcement needs a title.');
    if (!next.donation.title) throw new Error('Donation callout needs a title.');
    state.site = next;
  }

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function saveJson(name, data) {
    if (!backendAvailable) throw new Error('Backend save API is not available on this host. Use Download instead.');
    var token = tokenInput.value.trim();
    if (!token) throw new Error('Enter the admin save token first.');

    return fetch('../api/content/' + name, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || 'Save failed. If this is the static proposal host, use Download instead.');
        return body;
      });
    });
  }

  function loadJson(name, filename) {
    return fetch('../api/content/' + name, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('Backend content unavailable.');
      return res.json();
    }).catch(function () {
      return fetch('../content/' + filename, { cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('Static content unavailable.');
        return res.json();
      });
    });
  }

  function checkBackendHealth() {
    return fetch('../api/health', { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('Health check unavailable.');
      return res.json();
    }).then(function (health) {
      backendHealth = health;
      setBackendAvailable(hasAdminSaveApi(health));
    }).catch(function () {
      backendHealth = null;
      setBackendAvailable(false);
    });
  }

  function load() {
    var healthCheck = checkBackendHealth();
    var contentLoad = Promise.all([
      loadJson('concerts', 'concerts.json'),
      loadJson('audio', 'audio.json'),
      loadJson('site', 'site.json')
    ]);
    Promise.all([healthCheck, contentLoad]).then(function (results) {
      var loaded = results[1];
      state.concerts = loaded[0].concerts || [];
      state.tracks = loaded[1].tracks || [];
      state.site = loaded[2] || {};
      renderSettings();
      renderConcerts();
      renderTracks();
      setStatus('Loaded current content.');
    }).catch(function () {
      setStatus('Could not load current content. You can still add entries and export fresh files.');
      renderSettings();
      renderConcerts();
      renderTracks();
    });
  }

  function collectAll() {
    collectSettings();
    collectConcerts();
    collectTracks();
  }

  function allPayloads() {
    return [
      ['site', state.site],
      ['concerts', { concerts: state.concerts }],
      ['audio', { tracks: state.tracks }]
    ];
  }

  function saveAll() {
    return allPayloads().reduce(function (chain, item) {
      return chain.then(function () {
        return saveJson(item[0], item[1]);
      });
    }, Promise.resolve());
  }

  document.getElementById('add-concert').addEventListener('click', function () {
    state.concerts.push({ date: '', title: '', time: 'Sunday · 3:00 PM', link: '', cta: 'Details' });
    renderConcerts();
  });

  document.getElementById('add-track').addEventListener('click', function () {
    state.tracks.push({ title: '', file: '', remote: '' });
    renderTracks();
  });

  document.getElementById('download-concerts').addEventListener('click', function () {
    try {
      collectConcerts();
      downloadJson('concerts.json', { concerts: state.concerts });
      setStatus('Downloaded concerts.json.');
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('download-all').addEventListener('click', function () {
    try {
      collectAll();
      downloadJson('site.json', state.site);
      downloadJson('concerts.json', { concerts: state.concerts });
      downloadJson('audio.json', { tracks: state.tracks });
      setStatus('Downloaded site.json, concerts.json, and audio.json.');
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('save-all').addEventListener('click', function () {
    try {
      collectAll();
      saveAll().then(function () {
        setStatus('Saved all content through the backend.');
      }).catch(function (err) {
        setStatus(err.message);
      });
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('save-concerts').addEventListener('click', function () {
    try {
      collectConcerts();
      saveJson('concerts', { concerts: state.concerts }).then(function () {
        setStatus('Saved concerts.json through the backend.');
      }).catch(function (err) {
        setStatus(err.message);
      });
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('download-site').addEventListener('click', function () {
    try {
      collectSettings();
      downloadJson('site.json', state.site);
      setStatus('Downloaded site.json.');
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('save-site').addEventListener('click', function () {
    try {
      collectSettings();
      saveJson('site', state.site).then(function () {
        setStatus('Saved site.json through the backend.');
      }).catch(function (err) {
        setStatus(err.message);
      });
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('download-audio').addEventListener('click', function () {
    try {
      collectTracks();
      downloadJson('audio.json', { tracks: state.tracks });
      setStatus('Downloaded audio.json.');
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('save-audio').addEventListener('click', function () {
    try {
      collectTracks();
      saveJson('audio', { tracks: state.tracks }).then(function () {
        setStatus('Saved audio.json through the backend.');
      }).catch(function (err) {
        setStatus(err.message);
      });
    } catch (err) {
      setStatus(err.message);
    }
  });

  setBackendAvailable(false);
  load();
})();
