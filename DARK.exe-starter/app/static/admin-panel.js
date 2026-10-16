
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = { visits: [], events: [], search: "", minutes: 30 };

  const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const dateText = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleString("ru-RU");
  };

  const timestamp = (item) => item.timestamp || item.time || item.created_at || item.date || "";
  const ipOf = (item) => item.ip || item.ip_address || "Не определён";
  const pathOf = (item) => item.path || item.url || "/";
  const uaOf = (item) => item.user_agent || item.userAgent || item.ua || "";

  function deviceInfo(ua) {
    const s = String(ua).toLowerCase();
    const device = /ipad|tablet/.test(s) ? "Планшет" :
      /iphone|android|mobile/.test(s) ? "Телефон" : "Компьютер";
    const os = /windows/.test(s) ? "Windows" :
      /iphone|ipad/.test(s) ? "iOS" :
      /macintosh|mac os/.test(s) ? "macOS" :
      /android/.test(s) ? "Android" :
      /linux/.test(s) ? "Linux" : "Не определена";
    const browser = /edg\//.test(s) ? "Edge" :
      /opr\/|opera/.test(s) ? "Opera" :
      /firefox\//.test(s) ? "Firefox" :
      /chrome\//.test(s) ? "Chrome" :
      /safari\//.test(s) ? "Safari" : "Не определён";
    return { device, os, browser };
  }

  function installStyles() {
    if ($("#darkAdminStyles")) return;
    const style = document.createElement("style");
    style.id = "darkAdminStyles";
    style.textContent = `
      #systemAdminTrigger{cursor:pointer}
      #darkAdminOverlay{display:none;position:fixed;inset:0;z-index:999999;align-items:center;justify-content:center;padding:12px;background:#030407ed;backdrop-filter:blur(12px);color:#eee;font-family:Inter,Arial,sans-serif}
      #darkAdminOverlay.da-open{display:flex}
      #darkAdminOverlay *{box-sizing:border-box}
      .da-window{width:min(1200px,100%);max-height:96vh;overflow:auto;background:#0c0d12;border:1px solid #39232c;border-radius:12px;box-shadow:0 20px 90px #000}
      .da-head{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:20px 24px;border-bottom:1px solid #29212a}
      .da-red{color:#ff3048}
      .da-kicker{font:11px monospace;letter-spacing:2px;color:#ff5265}
      .da-title{font-size:23px;font-weight:800;margin-top:6px}
      .da-sub{font-size:12px;color:#968c9a;margin-top:6px}
      .da-content{padding:22px}
      .da-btn{background:#17131a;border:1px solid #49303a;color:#eee;border-radius:6px;padding:10px 14px;cursor:pointer;font:12px monospace}
      .da-btn:hover{border-color:#ff3048}
      .da-red-btn{background:#a9152a;border-color:#ff3048}
      .da-login{max-width:420px;margin:30px auto 45px}
      .da-login h3{margin:0 0 8px}
      .da-field{display:block;margin-top:17px}
      .da-field span{display:block;font:11px monospace;color:#a99daa;margin-bottom:7px}
      .da-field input,.da-search,.da-select{width:100%;padding:12px;background:#08090d;color:#eee;border:1px solid #3a2c37;border-radius:6px;outline:none}
      .da-field input:focus,.da-search:focus,.da-select:focus{border-color:#ff3048}
      .da-login button{width:100%;margin-top:20px}
      .da-error{margin-top:14px;color:#ff6677;font-size:13px}
      .da-hidden{display:none!important}
      .da-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:20px 0}
      .da-stat{padding:15px;border:1px solid #30232d;border-radius:8px;background:#ffffff04}
      .da-stat-label{font:10px monospace;letter-spacing:1px;color:#a69ba8}
      .da-stat-value{font-size:27px;font-weight:800;margin-top:10px}
      .da-note{font-size:11px;color:#8c8190;margin-top:6px;line-height:1.5}
      .da-section{margin-top:26px}
      .da-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
      .da-section h3{font-size:15px;margin:0}
      .da-tools{display:flex;gap:8px;flex-wrap:wrap}
      .da-search{width:240px}
      .da-select{width:auto}
      .da-table-wrap{overflow:auto;border:1px solid #30232d;border-radius:8px;background:#08090d}
      .da-table{width:100%;border-collapse:collapse;min-width:620px}
      .da-table th,.da-table td{text-align:left;padding:12px;border-bottom:1px solid #211a23;font-size:12px;vertical-align:top;overflow-wrap:anywhere}
      .da-table th{font:10px monospace;color:#a69ba8;letter-spacing:1px;background:#ffffff05;white-space:nowrap}
      .da-table tbody tr:hover{background:#ffffff05}
      .da-table tbody tr:last-child td{border-bottom:0}
      .da-empty{text-align:center!important;color:#8d8290!important;padding:25px!important}
      .da-rank{display:inline-block;border:1px solid #54303b;color:#ff5265;border-radius:5px;padding:5px 8px}
      .da-pill{border:1px solid #49303a;border-radius:5px;padding:4px 7px;color:#e7cdd5;font-size:10px}
      .da-foot{font-size:11px;line-height:1.6;color:#837887;margin-top:24px}
      @media(max-width:700px){.da-content{padding:14px}.da-head{padding:15px}.da-title{font-size:19px}.da-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.da-stat-value{font-size:23px}.da-search{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function makePanel() {
    if ($("#darkAdminOverlay")) return;

    const trigger = $("#systemAdminTrigger");
    if (!trigger) {
      console.error("DARK Admin: #systemAdminTrigger не найден в index.html");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "darkAdminOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="da-window">
        <header class="da-head">
          <div>
            <div class="da-kicker">DARK.exe // RESTRICTED ACCESS</div>
            <div class="da-title">ADMIN <span class="da-red">CONTROL</span></div>
            <div class="da-sub">Мониторинг сайта и журнал событий</div>
          </div>
          <button class="da-btn" id="daClose" type="button">ЗАКРЫТЬ ✕</button>
        </header>
        <div class="da-content">
          <form id="daLogin" class="da-login">
            <h3>Авторизация администратора</h3>
            <p class="da-sub">Введи учётные данные для доступа к панели.</p>
            <label class="da-field"><span>ЛОГИН</span><input id="daUsername" autocomplete="username" required maxlength="100"></label>
            <label class="da-field"><span>ПАРОЛЬ</span><input id="daPassword" type="password" autocomplete="current-password" required maxlength="200"></label>
            <button class="da-btn da-red-btn" id="daLoginButton" type="submit">ВОЙТИ В СИСТЕМУ</button>
            <div id="daLoginError" class="da-error da-hidden" role="alert"></div>
          </form>

          <div id="daDashboard" class="da-hidden">
            <div class="da-section-head">
              <div><div class="da-kicker">LIVE MONITOR</div><div class="da-title">Обзор системы</div></div>
              <div class="da-tools"><button class="da-btn" id="daRefresh" type="button">↻ ОБНОВИТЬ</button><button class="da-btn" id="daLogout" type="button">ВЫЙТИ</button></div>
            </div>

            <div class="da-stats">
              <div class="da-stat"><div class="da-stat-label">ВСЕГО ПОСЕЩЕНИЙ</div><div class="da-stat-value" id="daTotal">0</div><div class="da-note">Записи в доступном журнале</div></div>
              <div class="da-stat"><div class="da-stat-label">ЗА 30 МИНУТ</div><div class="da-stat-value" id="daRecent">0</div><div class="da-note">По времени записей</div></div>
              <div class="da-stat"><div class="da-stat-label">УНИКАЛЬНЫЕ IP</div><div class="da-stat-value" id="daIPs">0</div><div class="da-note">В доступном журнале</div></div>
              <div class="da-stat"><div class="da-stat-label">СОБЫТИЯ</div><div class="da-stat-value" id="daEventCount">0</div><div class="da-note">Записи серверного журнала</div></div>
            </div>

            <section class="da-section">
              <div class="da-section-head"><h3>01 / ТОП АКТИВНОСТИ</h3><select class="da-select" id="daRange"><option value="30">30 минут</option><option value="60">1 час</option><option value="1440">24 часа</option><option value="0">Весь журнал</option></select></div>
              <p class="da-note">Рейтинг по числу записей с IP-адреса. Это не гарантирует подсчёт уникальных людей, находящихся онлайн.</p>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>МЕСТО</th><th>IP</th><th>ЗАПИСИ</th><th>ПОСЛЕДНЯЯ АКТИВНОСТЬ</th></tr></thead><tbody id="daTop"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>02 / ПОПУЛЯРНЫЕ СТРАНИЦЫ</h3></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>МЕСТО</th><th>СТРАНИЦА</th><th>ПОСЕЩЕНИЯ</th></tr></thead><tbody id="daPages"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>03 / УСТРОЙСТВА И БРАУЗЕРЫ</h3></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>УСТРОЙСТВО</th><th>ОС</th><th>БРАУЗЕР</th><th>ЗАПИСИ</th></tr></thead><tbody id="daDevices"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>04 / ЖУРНАЛ ПОСЕЩЕНИЙ</h3><input id="daSearch" class="da-search" type="search" placeholder="Поиск по IP или странице"></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>ВРЕМЯ</th><th>IP</th><th>СТРАНИЦА</th><th>УСТРОЙСТВО / БРАУЗЕР</th></tr></thead><tbody id="daVisits"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>05 / СИСТЕМНЫЕ СОБЫТИЯ</h3></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>ВРЕМЯ</th><th>ТИП</th><th>СООБЩЕНИЕ</th></tr></thead><tbody id="daEvents"></tbody></table></div>
            </section>
            <p class="da-foot">Журнал может содержать IP-адрес, путь страницы, время и User-Agent. Тип устройства и браузер определяются приблизительно. Текущая серверная реализация может хранить историю временно.</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    trigger.addEventListener("click", openPanel);
    $("#daClose").addEventListener("click", closePanel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePanel();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePanel();
    });
    $("#daLogin").addEventListener("submit", login);
    $("#daRefresh").addEventListener("click", loadData);
    $("#daLogout").addEventListener("click", logout);
    $("#daRange").addEventListener("change", (event) => {
      state.minutes = Number(event.target.value);
      renderStats();
    });
    $("#daSearch").addEventListener("input", (event) => {
      state.search = event.target.value.toLowerCase().trim();
      renderVisits();
    });
  }

  function openPanel() {
    $("#darkAdminOverlay").classList.add("da-open");
    document.body.style.overflow = "hidden";
    checkSession();
  }

  function closePanel() {
    $("#darkAdminOverlay")?.classList.remove("da-open");
    document.body.style.overflow = "";
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.detail || data.message || `Ошибка ${response.status}`);
    return data;
  }

  function loginError(message) {
    const node = $("#daLoginError");
    node.textContent = message;
    node.classList.remove("da-hidden");
  }

  async function login(event) {
    event.preventDefault();
    const button = $("#daLoginButton");
    $("#daLoginError").classList.add("da-hidden");
    button.disabled = true;
    button.textContent = "ПРОВЕРКА…";
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("#daUsername").value.trim(),
          password: $("#daPassword").value
        })
      });
      $("#daPassword").value = "";
      $("#daLogin").classList.add("da-hidden");
      $("#daDashboard").classList.remove("da-hidden");
      await loadData();
    } catch (error) {
      loginError(error.message || "Не удалось войти. Проверь логин и пароль.");
    } finally {
      button.disabled = false;
      button.textContent = "ВОЙТИ В СИСТЕМУ";
    }
  }

  async function checkSession() {
    try {
      const result = await api("/api/admin/me");
      if (result.authenticated) {
        $("#daLogin").classList.add("da-hidden");
        $("#daDashboard").classList.remove("da-hidden");
        await loadData();
      }
    } catch {}
  }

  async function logout() {
    try {
      await api("/api/admin/logout", { method: "POST", body: "{}" });
    } catch {}
    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daPassword").value = "";
    $("#daLoginError").classList.add("da-hidden");
  }

  function arrayFrom(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  async function loadData() {
    const button = $("#daRefresh");
    button.disabled = true;
    button.textContent = "ЗАГРУЗКА…";
    try {
      const [visits, events] = await Promise.all([
        api("/api/admin/visits"),
        api("/api/admin/events")
      ]);
      state.visits = arrayFrom(visits, "visits");
      state.events = arrayFrom(events, "events");
      renderStats();
      renderVisits();
      renderEvents();
    } catch (error) {
      if (/401|403/i.test(error.message)) {
        $("#daDashboard").classList.add("da-hidden");
        $("#daLogin").classList.remove("da-hidden");
        loginError("Сессия закончилась. Войди снова.");
      } else {
        $("#daVisits").innerHTML = `<tr><td colspan="4" class="da-empty">${esc(error.message)}</td></tr>`;
      }
    } finally {
      button.disabled = false;
      button.textContent = "↻ ОБНОВИТЬ";
    }
  }

  function rowEmpty(columns, message) {
    return `<tr><td colspan="${columns}" class="da-empty">${esc(message)}</td></tr>`;
  }

  function renderStats() {
    const now = Date.now();
    const valid = state.visits.map((item) => ({
      item, time: new Date(timestamp(item)).getTime()
    }));
    const recent = valid.filter(({ time }) =>
      Number.isFinite(time) && now - time >= 0 && now - time <= 1800000
    );
    const ips = new Set(state.visits.map(ipOf).filter((ip) => ip !== "Не определён"));

    $("#daTotal").textContent = state.visits.length;
    $("#daRecent").textContent = recent.length;
    $("#daIPs").textContent = ips.size;
    $("#daEventCount").textContent = state.events.length;

    const cutoff = state.minutes ? now - state.minutes * 60000 : -Infinity;
    const filtered = valid.filter(({ time }) =>
      Number.isFinite(time) ? time >= cutoff && time <= now : state.minutes === 0
    );

    const activity = new Map();
    const pages = new Map();
    const devices = new Map();

    for (const { item, time } of filtered) {
      const ip = ipOf(item);
      const entry = activity.get(ip) || { count: 0, latest: 0 };
      entry.count++;
      if (Number.isFinite(time)) entry.latest = Math.max(entry.latest, time);
      activity.set(ip, entry);

      const path = pathOf(item);
      pages.set(path, (pages.get(path) || 0) + 1);

      const info = deviceInfo(uaOf(item));
      const key = `${info.device}|${info.os}|${info.browser}`;
      const device = devices.get(key) || { ...info, count: 0 };
      device.count++;
      devices.set(key, device);
    }

    const top = [...activity.entries()]
      .sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest)
      .slice(0, 10);
    $("#daTop").innerHTML = top.length ? top.map(([ip, entry], i) => `
      <tr><td><span class="da-rank">${i + 1}</span></td>
      <td>${esc(ip)}</td><td><span class="da-pill">${entry.count}</span></td>
      <td>${entry.latest ? dateText(entry.latest) : "—"}</td></tr>`).join("") :
      rowEmpty(4, "Нет записей за выбранный период");

    const popular = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $("#daPages").innerHTML = popular.length ? popular.map(([path, count], i) => `
      <tr><td><span class="da-rank">${i + 1}</span></td><td>${esc(path)}</td><td>${count}</td></tr>`).join("") :
      rowEmpty(3, "Нет данных о страницах");

    const deviceRows = [...devices.values()].sort((a, b) => b.count - a.count);
    $("#daDevices").innerHTML = deviceRows.length ? deviceRows.map((item) => `
      <tr><td>${esc(item.device)}</td><td>${esc(item.os)}</td><td>${esc(item.browser)}</td><td>${item.count}</td></tr>`).join("") :
      rowEmpty(4, "Нет данных об устройствах");
  }

  function renderVisits() {
    const visits = state.visits.slice().reverse().filter((item) =>
      `${ipOf(item)} ${pathOf(item)} ${uaOf(item)} ${timestamp(item)}`.toLowerCase().includes(state.search)
    );
    $("#daVisits").innerHTML = visits.length ? visits.map((item) => {
      const info = deviceInfo(uaOf(item));
      return `<tr>
        <td>${dateText(timestamp(item))}</td>
        <td>${esc(ipOf(item))}</td>
        <td>${esc(pathOf(item))}</td>
        <td title="${esc(uaOf(item))}">${esc(uaOf(item) ? `${info.device} · ${info.os} · ${info.browser}` : "Не передано")}</td>
      </tr>`;
    }).join("") : rowEmpty(4, state.search ? "Ничего не найдено" : "Посещений пока нет");
  }

  function renderEvents() {
    const events = state.events.slice().reverse();
    $("#daEvents").innerHTML = events.length ? events.map((item) => `
      <tr>
        <td>${dateText(timestamp(item))}</td>
        <td><span class="da-pill">${esc(item.type || item.level || item.category || "EVENT")}</span></td>
        <td>${esc(item.message || item.detail || item.description || JSON.stringify(item))}</td>
      </tr>`).join("") : rowEmpty(3, "Событий пока нет");
  }

  function init() {
    installStyles();
    makePanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
