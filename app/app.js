/* SK Home: a home screen for Steve's Samsung TV, run as a TizenBrew app module (17 Nov 2026).
   Tiles that need the Fire TV Cube or a different TV input call the helper on Jarvis's PC (tvhome.py);
   TizenTube is another TizenBrew module, so it's opened right here through TizenBrew's own service. */
(function () {
  var PC = 'http://10.0.1.17:8802';
  var TILES = [
    { id: 'cube', name: 'Fire Cube', sub: 'Home screen', icon: '⌂', c: '#e47911', go: 'cube' },
    { id: 'tizentube', name: 'TizenTube', sub: 'YouTube, no ads', icon: '▶', c: '#c8102e', module: 'npm/@foxreis/tizentube' },
    { id: 'netflix', name: 'Netflix', sub: 'on the Fire Cube', icon: 'N', c: '#b20710', go: 'app:netflix' },
    { id: 'prime', name: 'Prime Video', sub: 'on the Fire Cube', icon: '◆', c: '#0f79af', go: 'app:prime' },
    { id: 'disney', name: 'Disney+', sub: 'on the Fire Cube', icon: '✦', c: '#1a3fa8', go: 'app:disney' }
  ];
  var COLS = 4, focus = 0, busy = false;
  var grid = document.getElementById('grid'), statusEl = document.getElementById('status');

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.getElementById('stage').style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit); fit();

  function setStatus(text, err) { statusEl.textContent = text; statusEl.className = err ? 'err' : ''; }

  function draw() {
    grid.innerHTML = '';
    TILES.forEach(function (t, i) {
      var d = document.createElement('div');
      d.className = 'tile' + (i === focus ? ' focus' : '') + (busy && i === focus ? ' busy' : '');
      d.style.setProperty('--c', t.c);
      d.innerHTML = '<span class="big"></span><b></b><small></small>';
      d.querySelector('.big').textContent = t.icon;
      d.querySelector('b').textContent = t.name;
      d.querySelector('small').textContent = t.sub;
      d.onclick = function () { focus = i; draw(); open(t); };
      grid.appendChild(d);
    });
  }

  function pc(method, path, body, cb) {
    var x = new XMLHttpRequest();
    x.open(method, PC + path, true);
    x.timeout = method === 'GET' ? 6000 : 70000;
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) { /* not json */ } cb(x.status, j); };
    x.onerror = x.ontimeout = function () { cb(0, null); };
    x.send(body ? JSON.stringify(body) : null);
  }

  // Another TizenBrew module (TizenTube): ask TizenBrew's service for it, then go, the same way TizenBrew's own menu does.
  function openModule(fullName) {
    var ws;
    try { ws = new WebSocket('ws://localhost:8081'); } catch (e) { return done('TizenBrew is not answering.'); }
    var t = setTimeout(function () { done('TizenBrew is not answering.'); try { ws.close(); } catch (e) { /* */ } }, 15000);
    ws.onopen = function () { ws.send(JSON.stringify({ type: 4, payload: true })); };
    ws.onmessage = function (e) {
      var d; try { d = JSON.parse(e.data); } catch (er) { return; }
      if (d.type !== 4 || !d.payload) return;
      var m = null;
      for (var i = 0; i < d.payload.length; i++) if (d.payload[i].fullName === fullName) m = d.payload[i];
      clearTimeout(t);
      if (!m) return done('TizenTube is not installed in TizenBrew.');
      (m.keys || []).forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (er) { /* */ } });
      ws.send(JSON.stringify({ type: 5, payload: m }));
      if (!m.evaluateScriptOnDocumentStart) setTimeout(function () { location.href = m.appPath; }, 400);
    };
    ws.onerror = function () { clearTimeout(t); done('TizenBrew is not answering.'); };
  }

  function done(err) { busy = false; draw(); setStatus(err || 'Arrows to move, OK to open', !!err); }

  function open(t) {
    if (busy) return;
    busy = true; draw(); setStatus('Opening ' + t.name + '…');
    if (t.module) return openModule(t.module);
    pc('POST', '/tv/go', { to: t.go }, function (code, j) {
      done(code === 200 ? '' : (j && j.error ? t.name + ': ' + j.error : 'The PC (Jarvis) is not answering.'));
    });
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode, n = TILES.length;
    if (k === 37) focus = Math.max(0, focus - 1);
    else if (k === 39) focus = Math.min(n - 1, focus + 1);
    else if (k === 38) focus = focus - COLS >= 0 ? focus - COLS : focus;
    else if (k === 40) focus = Math.min(n - 1, focus + COLS < n ? focus + COLS : focus);
    else if (k === 13) { open(TILES[focus]); return; }
    else if (k === 10009) { e.preventDefault(); history.back(); return; }   // Back: to TizenBrew's menu (settings, modules)
    else return;
    e.preventDefault(); draw();
  });

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function tick() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    document.getElementById('clock').textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    document.getElementById('date').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  setInterval(tick, 5000); tick();

  function chip(id, text, on) {
    var el = document.getElementById(id);
    el.querySelector('span').textContent = text;
    el.className = 'chip' + (on ? ' on' : '');
  }
  function refresh() {
    pc('GET', '/tv/state', null, function (code, j) {
      if (code !== 200 || !j) { chip('weather', 'Weather: PC not answering'); chip('heating', 'Heating: PC not answering'); return; }
      if (j.open === 'tizentube' && !busy) { busy = true; draw(); setStatus('Opening TizenTube…'); openModule('npm/@foxreis/tizentube'); }
      var w = j.weather || {}, h = j.heating || {};
      chip('weather', w.temp == null ? 'Weather unavailable' : w.temp + '° ' + (w.text || '') + '  ·  H ' + w.high + '° L ' + w.low + '°');
      chip('heating', h.current == null ? 'Heating unavailable' :
        'Home ' + h.current + '°  ·  ' + (h.boost ? 'Boost to ' + h.target + '°' : h.heating ? 'Heating on' : 'Heating off'), h.heating);
    });
  }
  setInterval(refresh, 60000); refresh();
  // Brought back to the front by the PC (SK Home button, TV switched on): read the PC again straight away, so a
  // waiting "open TizenTube" from the phone happens now and the weather and heating are fresh.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { busy = false; draw(); refresh(); } });

  draw();
})();
