
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = { visits: [], events: [], search: "", minutes: 30 };
  let liveRefreshTimer = null;
  let openingPanel = false;

  const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const timestamp = (item) =>
    item.timestamp || item.time || item.created_at || item.date || "";

  const ipOf = (item) => item.ip || item.ip_address || "Не определён";
  const pathOf = (item) => item.path || item.url || "/";
  const uaOf = (item) => item.user_agent || item.userAgent || item.ua || "";

  function dateText(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? esc(value)
      : date.toLocaleString("ru-RU");
  }

  function deviceInfo(ua) {
    const s = String(ua).toLowerCase();

    const device = /ipad|tablet/.test(s) ? "Планшет" :
      /iphone|android.*mobile|mobile/.test(s) ? "Телефон" :
      ua ? "Компьютер / тип не уточнён" : "Нет данных";

    const os = /windows/.test(s) ? "Windows" :
      /iphone|ipad/.test(s) ? "iOS / iPadOS" :
      /macintosh|mac os/.test(s) ? "macOS" :
      /android/.test(s) ? "Android" :
      /linux/.test(s) ? "Linux" :
      ua ? "Не определена" : "Нет данных";

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
      #systemAdminTrigger,
      #systemAdminTrigger:hover,
      #systemAdminTrigger:active,
      #systemAdminTrigger:focus,
      #systemAdminTrigger:focus-visible {
        appearance:none!important;
        -webkit-appearance:none!important;
        border:0!important;
        outline:none!important;
        box-shadow:none!important;
        background:transparent!important;
        border-radius:0!important;
        text-decoration:none!important;
        padding:0!important;
        cursor:pointer!important;
      }

      #darkAdminOverlay {
        display:none;position:fixed;inset:0;z-index:999999;
        align-items:center;justify-content:center;padding:12px;
        background:#030407ed;backdrop-filter:blur(12px);
        color:#eee;font-family:Inter,Arial,sans-serif
      }
      #darkAdminOverlay.da-open{display:flex}
      #darkAdminOverlay *{box-sizing:border-box}
      .da-window {
        width:min(1200px,100%);max-height:96vh;overflow:auto;
        background:#0c0d12;border:1px solid #39232c;
        border-radius:12px;box-shadow:0 20px 90px #000
      }
      .da-head {
        display:flex;align-items:center;justify-content:space-between;
        gap:15px;padding:20px 24px;border-bottom:1px solid #29212a
      }
      .da-red{color:#ff3048}
      .da-kicker{font:11px monospace;letter-spacing:2px;color:#ff5265}
      .da-title{font-size:23px;font-weight:800;margin-top:6px}
      .da-sub{font-size:12px;color:#968c9a;margin-top:6px}
      .da-content{padding:22px}
      .da-btn {
        background:#17131a;border:1px solid #49303a;color:#eee;
        border-radius:6px;padding:10px 14px;cursor:pointer;font:12px monospace
      }
      .da-btn:hover{border-color:#ff3048}
      .da-red-btn{background:#a9152a;border-color:#ff3048}
      .da-login{max-width:420px;margin:30px auto 45px}
      .da-login h3{margin:0 0 8px}
      .da-field{display:block;margin-top:17px}
      .da-field span {
        display:block;font:11px monospace;color:#a99daa;margin-bottom:7px
      }
      .da-field input,.da-search,.da-select {
        width:100%;padding:12px;background:#08090d;color:#eee;
        border:1px solid #3a2c37;border-radius:6px;outline:none
      }
      .da-field input:focus,.da-search:focus,.da-select:focus {
        border-color:#ff3048
      }
      .da-login button{width:100%;margin-top:20px}
      .da-error{margin-top:14px;color:#ff6677;font-size:13px}
      .da-hidden{display:none!important}
      .da-stats {
        display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;margin:20px 0
      }
      .da-stat {
        padding:15px;border:1px solid #30232d;
        border-radius:8px;background:#ffffff04
      }
      .da-stat-label{font:10px monospace;letter-spacing:1px;color:#a69ba8}
      .da-stat-value{font-size:27px;font-weight:800;margin-top:10px}
      .da-note{font-size:11px;color:#8c8190;margin-top:6px;line-height:1.5}
      .da-section{margin-top:26px}
      .da-section-head {
        display:flex;align-items:center;justify-content:space-between;
        gap:12px;flex-wrap:wrap;margin-bottom:12px
      }
      .da-section h3{font-size:15px;margin:0}
      .da-tools{display:flex;gap:8px;flex-wrap:wrap}
      .da-search{width:240px}
      .da-select{width:auto}
      .da-table-wrap {
        overflow:auto;border:1px solid #30232d;border-radius:8px;background:#08090d
      }
      .da-table{width:100%;border-collapse:collapse;min-width:620px}
      .da-table th,.da-table td {
        text-align:left;padding:12px;border-bottom:1px solid #211a23;
        font-size:12px;vertical-align:top;overflow-wrap:anywhere
      }
      .da-table th {
        font:10px monospace;color:#a69ba8;letter-spacing:1px;
        background:#ffffff05;white-space:nowrap
      }
      .da-table tbody tr:hover{background:#ffffff05}
      .da-table tbody tr:last-child td{border-bottom:0}
      .da-empty{text-align:center!important;color:#8d8290!important;padding:25px!important}
      .da-rank {
        display:inline-block;border:1px solid #54303b;
        color:#ff5265;border-radius:5px;padding:5px 8px
      }
      .da-pill {
        border:1px solid #49303a;border-radius:5px;
        padding:4px 7px;color:#e7cdd5;font-size:10px
      }
      .da-foot{font-size:11px;line-height:1.6;color:#837887;margin-top:24px}

      #daDeniedScreen {
        display:none;position:fixed;inset:0;z-index:2147483647;
        overflow:auto;align-items:center;justify-content:center;
        padding:20px;background:#050204;color:#f8e9ec;
        font-family:monospace
      }
      #daDeniedScreen.da-denied-visible {
        display:flex;animation:daDeniedFlicker .18s steps(2) 3
      }
      .da-denied-noise {
        position:fixed;inset:0;pointer-events:none;opacity:.18;
        background:repeating-linear-gradient(
          transparent 0,transparent 3px,#ff183322 4px
        );
        animation:daNoise .14s steps(2) infinite
      }
      .da-denied-frame {
        position:relative;width:min(760px,100%);
        border:1px solid #ff3048;background:#0a0508;
        box-shadow:0 0 60px #ff10252b,inset 0 0 40px #ff10250a
      }
      .da-denied-top,.da-denied-bottom {
        display:flex;justify-content:space-between;gap:12px;
        flex-wrap:wrap;padding:14px 18px;color:#ff6478;
        font-size:10px;letter-spacing:1.5px;border-bottom:1px solid #68202f
      }
      .da-denied-top span{color:white;background:#a20c27;padding:4px 8px}
      .da-denied-content {
        padding:clamp(25px,6vw,60px) 20px;text-align:center
      }
      .da-denied-warning {
        font-size:46px;color:#ff3048;text-shadow:0 0 30px #ff3048
      }
      .da-denied-code {
        margin-top:15px;color:#ff5268;font-size:10px;letter-spacing:3px
      }
      .da-denied-content h1 {
        margin:18px 0;font-size:clamp(27px,6vw,48px);
        overflow-wrap:anywhere;color:#ff3048;text-shadow:3px 0 #6b0015
      }
      .da-denied-content p{font-size:11px;line-height:1.9;color:#c8aeb6}
      .da-denied-line {
        height:1px;margin:25px 0;
        background:linear-gradient(90deg,transparent,#ff3048,transparent)
      }
      .da-denied-status{color:#ff5268;font-size:11px;letter-spacing:2px}
      .da-denied-dot {
        display:inline-block;width:7px;height:7px;margin-right:7px;
        border-radius:50%;background:#ff3048;box-shadow:0 0 12px #ff3048
      }
      .da-denied-content .da-denied-small {
        margin:20px auto;max-width:440px;color:#887780
      }
      #daDeniedReturn {
        margin-top:15px;padding:14px 22px;border:1px solid #ff3048;
        background:#18070d;color:#ff6478;font:11px monospace;
        letter-spacing:2px;cursor:pointer
      }
      #daDeniedReturn:hover{background:#7e1024;color:white}
      .da-denied-bottom {
        border-top:1px solid #68202f;border-bottom:0;color:#8b3548
      }
      @keyframes daDeniedFlicker {
        0%,100%{opacity:1}50%{opacity:.65}
      }
      @keyframes daNoise {
        0%{transform:translateY(-2px)}100%{transform:translateY(2px)}
      }
      @media(max-width:700px) {
        .da-content{padding:14px}
        .da-head{padding:15px}
        .da-title{font-size:19px}
        .da-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
        .da-stat-value{font-size:23px}
        .da-search{width:100%}
      }
    `;

    document.head.appendChild(style);
  }

  function makeDeniedScreen() {
    if ($("#daDeniedScreen")) return;

    const screen = document.createElement("div");
    screen.id = "daDeniedScreen";
    screen.innerHTML = `
      <div class="da-denied-noise"></div>
      <div class="da-denied-frame">
        <div class="da-denied-top">
          DARK.exe // SECURITY MONITOR
          <span>CRITICAL</span>
        </div>
        <div class="da-denied-content">
          <div class="da-denied-warning">⚠</div>
          <div class="da-denied-code">SECURITY EVENT 0x0001</div>
          <h1>ADMIN ACCESS DENIED</h1>
          <p>ПОПЫТКА ВХОДА В ПАНЕЛЬ АДМИНИСТРАТОРА ОТКЛОНЕНА</p>
          <div class="da-denied-line"></div>
          <div class="da-denied-status">
            <span class="da-denied-dot"></span>
            AUTHENTICATION FAILED
          </div>
          <p class="da-denied-small">
            ДОСТУП К АДМИНИСТРАТИВНОМУ ИНТЕРФЕЙСУ НЕ ПРЕДОСТАВЛЕН.
          </p>
          <button id="daDeniedReturn" type="button">RETURN TO SYSTEM</button>
        </div>
        <div class="da-denied-bottom">
          DARK.exe SECURITY PROTOCOL // ACCESS REJECTED
        </div>
      </div>
    `;

    document.body.appendChild(screen);
    $("#daDeniedReturn").addEventListener("click", () => {
      screen.classList.remove("da-denied-visible");
    });
  }

  function showDeniedScreen() {
    makeDeniedScreen();
    const screen = $("#daDeniedScreen");
    screen.classList.add("da-denied-visible");

    window.setTimeout(() => {
      screen.classList.remove("da-denied-visible");
    }, 7000);
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
            <label class="da-field">
              <span>ЛОГИН</span>
              <input id="daUsername" autocomplete="username" required maxlength="100">
            </label>
            <label class="da-field">
              <span>ПАРОЛЬ</span>
              <input id="daPassword" type="password" autocomplete="current-password" required maxlength="200">
            </label>
            <button class="da-btn da-red-btn" id="daLoginButton" type="submit">ВОЙТИ В СИСТЕМУ</button>
            <div id="daLoginError" class="da-error da-hidden" role="alert"></div>
          </form>

          <div id="daDashboard" class="da-hidden">
            <div class="da-section-head">
              <div>
                <div class="da-kicker">LIVE MONITOR</div>
                <div class="da-title">Обзор системы</div>
              </div>
              <div class="da-tools">
                <button class="da-btn" id="daRefresh" type="button">↻ ОБНОВИТЬ</button>
                <button class="da-btn" id="daLogout" type="button">ВЫЙТИ</button>
              </div>
            </div>

            <div class="da-stats">
              <div class="da-stat"><div class="da-stat-label">ВСЕГО ПОСЕЩЕНИЙ</div><div class="da-stat-value" id="daTotal">0</div><div class="da-note">Записи в доступном журнале</div></div>
              <div class="da-stat"><div class="da-stat-label">ЗА 30 МИНУТ</div><div class="da-stat-value" id="daRecent">0</div><div class="da-note">По времени записей</div></div>
              <div class="da-stat"><div class="da-stat-label">УНИКАЛЬНЫЕ IP</div><div class="da-stat-value" id="daIPs">0</div><div class="da-note">В доступном журнале</div></div>
              <div class="da-stat"><div class="da-stat-label">СОБЫТИЯ</div><div class="da-stat-value" id="daEventCount">0</div><div class="da-note">Записи серверного журнала</div></div>
            </div>

            <section class="da-section">
              <div class="da-section-head"><h3>01 / ТОП АКТИВНОСТИ</h3><select class="da-select" id="daRange"><option value="30">30 минут</option><option value="60">1 час</option><option value="1440">24 часа</option><option value="0">Весь журнал</option></select></div>
              <p class="da-note">Количество записей с IP-адреса не равно числу уникальных людей онлайн.</p>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>МЕСТО</th><th>IP</th><th>ЗАПИСИ</th><th>ПОСЛЕДНЯЯ АКТИВНОСТЬ</th></tr></thead><tbody id="daTop"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>02 / ПОПУЛЯРНЫЕ СТРАНИЦЫ</h3></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>МЕСТО</th><th>СТРАНИЦА</th><th>ПОСЕЩЕНИЯ</th></tr></thead><tbody id="daPages"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>03 / УСТРОЙСТВА И БРАУЗЕРЫ</h3></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>ТИП</th><th>ОС</th><th>БРАУЗЕР</th><th>ЗАПИСИ</th></tr></thead><tbody id="daDevices"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>04 / ЖУРНАЛ ПОСЕЩЕНИЙ</h3><input id="daSearch" class="da-search" type="search" placeholder="Поиск по IP или странице"></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>ВРЕМЯ</th><th>IP</th><th>СТРАНИЦА</th><th>USER-AGENT / УСТРОЙСТВО</th></tr></thead><tbody id="daVisits"></tbody></table></div>
            </section>

            <section class="da-section">
              <div class="da-section-head"><h3>05 / СИСТЕМНЫЕ СОБЫТИЯ</h3></div>
              <div class="da-table-wrap"><table class="da-table"><thead><tr><th>ВРЕМЯ</th><th>ТИП</th><th>СООБЩЕНИЕ</th></tr></thead><tbody id="daEvents"></tbody></table></div>
            </section>

            <p class="da-foot">
              IP и User-Agent отображаются только если сервер действительно записал их.
              Тип устройства определяется приблизительно по User-Agent; точную модель
              устройства браузер обычно не раскрывает. История зависит от серверного хранилища.
            </p>
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
      if (event.key === "Escape" && $("#darkAdminOverlay")?.classList.contains("da-open")) {
        closePanel();
      }
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

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(data.detail || data.message || `Ошибка ${response.status}`);
    }

    return data;
  }

  function loginError(message) {
    const node = $("#daLoginError");
    node.textContent = message;
    node.classList.remove("da-hidden");
  }

  async function openPanel() {
    if (openingPanel) return;
    openingPanel = true;

    const overlay = $("#darkAdminOverlay");
    if (!overlay) {
      openingPanel = false;
      return;
    }

    overlay.classList.add("da-open");
    document.body.style.overflow = "hidden";
    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daLoginError").classList.add("da-hidden");
    $("#daPassword").value = "";

    try {
      // Удаляем прежнюю сессию: при каждом открытии нужен новый вход.
      await api("/api/admin/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (error) {
      console.error("Не удалось завершить предыдущую сессию", error);
    } finally {
      $("#daUsername").focus();
      openingPanel = false;
    }
  }

  async function closePanel() {
    stopLiveRefresh();

    try {
      await api("/api/admin/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (error) {
      console.error("Ошибка выхода из админ-панели", error);
    }

    $("#darkAdminOverlay")?.classList.remove("da-open");
    document.body.style.overflow = "";
    $("#daDashboard")?.classList.add("da-hidden");
    $("#daLogin")?.classList.remove("da-hidden");

    if ($("#daPassword")) $("#daPassword").value = "";
    $("#daLoginError")?.classList.add("da-hidden");
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
      startLiveRefresh();
    } catch (error) {
      $("#daPassword").value = "";

      if (/invalid credentials|unauthorized|неверн|401/i.test(error.message)) {
        $("#daLoginError").classList.add("da-hidden");
        showDeniedScreen();
      } else {
        loginError(error.message || "Не удалось войти. Проверь настройки сервера.");
      }
    } finally {
      button.disabled = false;
      button.textContent = "ВОЙТИ В СИСТЕМУ";
    }
  }

  async function logout() {
    stopLiveRefresh();

    try {
      await api("/api/admin/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (error) {
      console.error("Ошибка выхода", error);
    }

    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daPassword").value = "";
    $("#daLoginError").classList.add("da-hidden");
  }

  function startLiveRefresh() {
    stopLiveRefresh();

    liveRefreshTimer = window.setInterval(() => {
      const overlay = $("#darkAdminOverlay");
      const dashboard = $("#daDashboard");

      if (
        overlay?.classList.contains("da-open") &&
        dashboard &&
        !dashboard.classList.contains("da-hidden")
      ) {
        loadData();
      }
    }, 10000);
  }

  function stopLiveRefresh() {
    if (liveRefreshTimer !== null) {
      window.clearInterval(liveRefreshTimer);
      liveRefreshTimer = null;
    }
  }

  function arrayFrom(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  async function loadData() {
    const button = $("#daRefresh");
    if (!button) return;

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
        stopLiveRefresh();
        $("#daDashboard").classList.add("da-hidden");
        $("#daLogin").classList.remove("da-hidden");
        loginError("Сессия завершена. Войди снова.");
      } else {
        $("#daVisits").innerHTML =
          `<tr><td colspan="4" class="da-empty">${esc(error.message)}</td></tr>`;
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
      item,
      time: new Date(timestamp(item)).getTime()
    }));

    const recent = valid.filter(({ time }) =>
      Number.isFinite(time) && now - time >= 0 && now - time <= 1800000
    );

    const ips = new Set(
      state.visits.map(ipOf).filter((ip) => ip !== "Не определён")
    );

    $("#daTotal").textContent = state.visits.length;
    $("#daRecent").textContent = recent.length;
    $("#daIPs").textContent = ips.size;
    $("#daEventCount").textContent = state.events.length;

    const cutoff = state.minutes ? now - state.minutes * 60000 : -Infinity;
    const filtered = valid.filter(({ time }) =>
      Number.isFinite(time)
        ? time >= cutoff && time <= now
        : state.minutes === 0
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
      <tr>
        <td><span class="da-rank">${i + 1}</span></td>
        <td>${esc(ip)}</td>
        <td><span class="da-pill">${entry.count}</span></td>
        <td>${entry.latest ? dateText(entry.latest) : "—"}</td>
      </tr>`).join("") : rowEmpty(4, "Нет записей за выбранный период");

    const popular = [...pages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    $("#daPages").innerHTML = popular.length ? popular.map(([path, count], i) => `
      <tr>
        <td><span class="da-rank">${i + 1}</span></td>
        <td>${esc(path)}</td>
        <td>${count}</td>
      </tr>`).join("") : rowEmpty(3, "Нет данных о страницах");

    const deviceRows = [...devices.values()].sort((a, b) => b.count - a.count);

    $("#daDevices").innerHTML = deviceRows.length ? deviceRows.map((item) => `
      <tr>
        <td>${esc(item.device)}</td>
        <td>${esc(item.os)}</td>
        <td>${esc(item.browser)}</td>
        <td>${item.count}</td>
      </tr>`).join("") : rowEmpty(4, "Нет данных об устройствах");
  }

  function renderVisits() {
    const visits = state.visits.slice().reverse().filter((item) =>
      `${ipOf(item)} ${pathOf(item)} ${uaOf(item)} ${timestamp(item)}`
        .toLowerCase().includes(state.search)
    );

    $("#daVisits").innerHTML = visits.length ? visits.map((item) => {
      const info = deviceInfo(uaOf(item));
      const ua = uaOf(item);

      return `<tr>
        <td>${dateText(timestamp(item))}</td>
        <td>${esc(ipOf(item))}</td>
        <td>${esc(pathOf(item))}</td>
        <td title="${esc(ua)}">${esc(ua || "User-Agent не записан")}
          ${ua ? `<div class="da-note">${esc(info.device)} · ${esc(info.os)} · ${esc(info.browser)}</div>` : ""}
        </td>
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
