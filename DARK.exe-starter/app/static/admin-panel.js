
(() => {
  "use strict";

  if (window.__DARK_ADMIN_INITIALIZED__) return;
  window.__DARK_ADMIN_INITIALIZED__ = true;

  const $ = (selector) => document.querySelector(selector);
  const state = {
    visits: [],
    events: [],
    search: "",
    minutes: 30,
    authenticated: false,
    loading: false
  };

  let refreshTimer = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const timeOf = (item) =>
    item?.timestamp ?? item?.time ?? item?.created_at ?? item?.date ?? "";

  // Отсутствующий IP — пустое значение, а не выдуманный адрес.
  const ipOf = (item) => {
    const value = item?.ip ?? item?.ip_address ?? "";
    return typeof value === "string" && value.trim() ? value.trim() : "";
  };

  const pathOf = (item) => {
    const value = item?.path ?? item?.url;
    return typeof value === "string" && value.trim() ? value : "Не записана";
  };

  const uaOf = (item) =>
    item?.user_agent ?? item?.userAgent ?? item?.ua ?? "";

  function dateText(value) {
    if (!value) return "Не записано";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Некорректная дата"
      : date.toLocaleString("ru-RU");
  }

  function deviceInfo(ua) {
    if (typeof ua !== "string" || !ua.trim()) {
      return {
        device: "Не определено",
        os: "Не определена",
        browser: "Не определён"
      };
    }

    const s = ua.toLowerCase();

    const device =
      /ipad|tablet/.test(s) ? "Планшет" :
      /iphone|android.*mobile|mobile/.test(s) ? "Телефон" :
      /windows|macintosh|mac os|linux|x11/.test(s) ? "Компьютер" :
      "Не определено";

    const os =
      /windows/.test(s) ? "Windows" :
      /iphone|ipad/.test(s) ? "iOS / iPadOS" :
      /macintosh|mac os/.test(s) ? "macOS" :
      /android/.test(s) ? "Android" :
      /linux|x11/.test(s) ? "Linux" :
      "Не определена";

    const browser =
      /edg\//.test(s) ? "Edge" :
      /opr\/|opera/.test(s) ? "Opera" :
      /firefox\//.test(s) ? "Firefox" :
      /chrome\//.test(s) ? "Chrome" :
      /safari\//.test(s) ? "Safari" :
      "Не определён";

    return { device, os, browser };
  }

  function installStyles() {
    if ($("#darkAdminStyles")) {
      $("#darkAdminStyles").remove();
    }

    const style = document.createElement("style");
    style.id = "darkAdminStyles";

    style.textContent = `
      #systemAdminTrigger,
      #systemAdminTrigger:hover,
      #systemAdminTrigger:focus,
      #systemAdminTrigger:active,
      #systemAdminTrigger:focus-visible {
        all: unset !important;
        display: inline !important;
        background: transparent !important;
        background-image: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        outline: none !important;
        box-shadow: none !important;
        color: inherit !important;
        font: inherit !important;
        letter-spacing: inherit !important;
        text-transform: inherit !important;
        text-decoration: none !important;
        padding: 0 !important;
        margin: 0 !important;
        filter: none !important;
        transform: none !important;
        cursor: pointer !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      #systemAdminTrigger::before,
      #systemAdminTrigger::after,
      #systemAdminTrigger .pulse {
        display: none !important;
        content: none !important;
        box-shadow: none !important;
      }

      #darkAdminOverlay, #daDeniedScreen {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 999999;
        overflow: auto;
        align-items: center;
        justify-content: center;
        padding: 16px;
        color: #eee;
        background: rgba(3,4,8,.94);
        font-family: Inter, Arial, sans-serif;
      }

      #darkAdminOverlay.da-open,
      #daDeniedScreen.da-denied-visible {
        display: flex;
      }

      .da-window {
        width: min(1200px, 100%);
        max-height: 94dvh;
        overflow: auto;
        background: #090a0f;
        border: 1px solid #49303b;
        border-radius: 12px;
        box-shadow: 0 25px 90px #000;
      }

      .da-head {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px;
        background: #0d0d14;
        border-bottom: 1px solid #30232e;
      }

      .da-title { font-size: 21px; font-weight: 800; }
      .da-kicker { color: #ff526b; font: 11px monospace; letter-spacing: 2px; }
      .da-red { color: #ff4058; }
      .da-content { padding: 18px; }
      .da-sub { color: #948997; font-size: 12px; line-height: 1.6; }

      .da-btn {
        padding: 10px 13px;
        color: #eee;
        background: #121219;
        border: 1px solid #3b2d3a;
        border-radius: 6px;
        cursor: pointer;
        font: 11px monospace;
      }

      .da-btn:hover { border-color: #ff4058; }
      .da-btn:disabled { opacity: .5; cursor: wait; }
      .da-primary { background: #8c1930; border-color: #ff4058; }

      .da-login {
        width: min(420px, 100%);
        margin: 30px auto;
        padding: 25px;
        background: #101016;
        border: 1px solid #3b2935;
        border-radius: 10px;
      }

      .da-login h3 { margin: 10px 0; }
      .da-field { display: block; margin-top: 18px; }
      .da-field span {
        display: block;
        margin-bottom: 8px;
        color: #ad9eaf;
        font: 10px monospace;
      }

      .da-field input, .da-search, .da-select {
        width: 100%;
        box-sizing: border-box;
        padding: 11px;
        color: #eee;
        background: #07080c;
        border: 1px solid #3b2d3a;
        border-radius: 6px;
      }

      .da-login button { width: 100%; margin-top: 20px; }
      .da-error {
        margin-top: 13px;
        padding: 12px;
        color: #ff9aa8;
        background: #260b12;
        border: 1px solid #743042;
        font-size: 12px;
      }

      .da-hidden { display: none !important; }
      .da-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }

      .da-toolbar-actions, .da-tools {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      .da-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin: 20px 0;
      }

      .da-stat, .da-card {
        min-width: 0;
        background: #0d0d13;
        border: 1px solid #302531;
        border-radius: 8px;
      }

      .da-stat { padding: 16px; }
      .da-stat-label { color: #a89bad; font: 10px monospace; }
      .da-stat-value { margin-top: 12px; font-size: 28px; font-weight: 800; overflow-wrap: anywhere; }
      .da-stat-foot { margin-top: 6px; color: #827889; font-size: 11px; }

      .da-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-top: 14px;
      }

      .da-card-head { padding: 14px; border-bottom: 1px solid #302531; }
      .da-card-title { font-size: 13px; font-weight: 700; }
      .da-card-desc { margin-top: 5px; color: #918395; font-size: 11px; }

      .da-table-wrap { overflow-x: auto; }
      .da-table { width: 100%; border-collapse: collapse; }
      .da-table th, .da-table td {
        padding: 11px;
        border-bottom: 1px solid #27212b;
        text-align: left;
        vertical-align: top;
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      .da-table th { color: #a596aa; font: 10px monospace; }
      .da-empty { padding: 20px !important; color: #9c91a2; text-align: center !important; }
      .da-note { margin-top: 5px; color: #948697; font-size: 11px; }
      .da-footer-note { margin-top: 18px; color: #948697; font-size: 11px; line-height: 1.7; }
      .da-live { color: #8cdbac; font: 10px monospace; }
      .da-loading { color: #ff7183; margin: 12px 0; font-size: 12px; }

      #daDeniedScreen {
        background: #050204;
        color: #ff4058;
        font-family: monospace;
      }

      .da-denied-frame {
        width: min(720px, 100%);
        padding: 24px;
        text-align: center;
        border: 1px solid #ff3048;
        background: #0b0509;
        box-shadow: 0 0 60px #ff102533;
      }

      .da-denied-frame h1 {
        font-size: clamp(28px, 6vw, 48px);
        overflow-wrap: anywhere;
      }

      .da-denied-frame p { color: #d0b3bd; line-height: 1.8; }
      .da-denied-frame button {
        margin-top: 18px;
        padding: 13px 20px;
        color: #ff6478;
        background: #18070d;
        border: 1px solid #ff3048;
        cursor: pointer;
      }

      @media(max-width: 760px) {
        .da-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .da-grid { grid-template-columns: 1fr; }
        .da-content { padding: 12px; }
      }
    `;

    document.head.appendChild(style);
  }

  function makeDeniedScreen() {
    if ($("#daDeniedScreen")) return;

    const screen = document.createElement("div");
    screen.id = "daDeniedScreen";
    screen.setAttribute("role", "alertdialog");
    screen.setAttribute("aria-modal", "true");

    screen.innerHTML = `
      <div class="da-denied-frame">
        <div>DARK.exe // SECURITY MONITOR</div>
        <h1>ADMIN ACCESS DENIED</h1>
        <p>ПОПЫТКА ВХОДА ОТКЛОНЕНА</p>
        <p>Доступ к панели администратора не предоставлен.</p>
        <button id="daDeniedReturn" type="button">RETURN TO SYSTEM</button>
      </div>
    `;

    document.body.appendChild(screen);

    $("#daDeniedReturn").addEventListener("click", () => {
      screen.classList.remove("da-denied-visible");
    });
  }

  function showDeniedScreen() {
    makeDeniedScreen();
    $("#daDeniedScreen").classList.add("da-denied-visible");
    $("#daDeniedReturn").focus();
  }

  function makePanel() {
    const trigger = $("#systemAdminTrigger");

    if (!trigger) {
      console.error("DARK Admin: не найден #systemAdminTrigger");
      return;
    }

    if ($("#darkAdminOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "darkAdminOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.innerHTML = `
      <div class="da-window">
        <header class="da-head">
          <div>
            <div class="da-kicker">DARK.exe / RESTRICTED ACCESS</div>
            <div class="da-title">ADMIN <span class="da-red">CONTROL</span></div>
            <div class="da-sub">Журнал посещений и системных событий</div>
          </div>
          <button class="da-btn" id="daClose" type="button">ЗАКРЫТЬ ✕</button>
        </header>

        <div class="da-content">
          <form id="daLogin" class="da-login">
            <div class="da-kicker">IDENTITY VERIFICATION</div>
            <h3>Вход администратора</h3>
            <p class="da-sub">Введи учётные данные для продолжения.</p>

            <label class="da-field">
              <span>ИМЯ ПОЛЬЗОВАТЕЛЯ</span>
              <input id="daUsername" autocomplete="username" maxlength="100" required>
            </label>

            <label class="da-field">
              <span>ПАРОЛЬ</span>
              <input id="daPassword" type="password" autocomplete="current-password" maxlength="200" required>
            </label>

            <button class="da-btn da-primary" id="daLoginButton" type="submit">ПРОВЕРИТЬ ДОСТУП</button>
            <div id="daLoginError" class="da-error da-hidden" role="alert"></div>
          </form>

          <section id="daDashboard" class="da-hidden">
            <div class="da-toolbar">
              <div>
                <div class="da-kicker">01 / OVERVIEW</div>
                <h2>Обзор системы</h2>
                <div class="da-sub">Показываются только записи серверного API.</div>
              </div>
              <div class="da-toolbar-actions">
                <span class="da-live">● LIVE MONITOR</span>
                <button class="da-btn" id="daRefresh" type="button">↻ ОБНОВИТЬ</button>
                <button class="da-btn" id="daLogout" type="button">ВЫЙТИ</button>
              </div>
            </div>

            <div id="daStatus" class="da-loading" role="status">Ожидание данных…</div>

            <div class="da-stats">
              <div class="da-stat">
                <div class="da-stat-label">ВСЕГО ПОСЕЩЕНИЙ</div>
                <div class="da-stat-value" id="daTotal">—</div>
                <div class="da-stat-foot">Записи API</div>
              </div>
              <div class="da-stat">
                <div class="da-stat-label">ЗА 30 МИНУТ</div>
                <div class="da-stat-value" id="daRecent">—</div>
                <div class="da-stat-foot">По записанному времени</div>
              </div>
              <div class="da-stat">
                <div class="da-stat-label">УНИКАЛЬНЫЕ IP</div>
                <div class="da-stat-value" id="daIPs">—</div>
                <div class="da-stat-foot">Только записанные IP</div>
              </div>
              <div class="da-stat">
                <div class="da-stat-label">СОБЫТИЯ</div>
                <div class="da-stat-value" id="daEventCount">—</div>
                <div class="da-stat-foot">Записи API событий</div>
              </div>
            </div>

            <div class="da-grid">
              <section class="da-card">
                <div class="da-card-head">
                  <div class="da-card-title">Активность по IP</div>
                  <div class="da-card-desc">Период подсчёта</div>
                  <select class="da-select" id="daRange" aria-label="Период">
                    <option value="30">30 минут</option>
                    <option value="60">1 час</option>
                    <option value="1440">24 часа</option>
                    <option value="0">Весь журнал</option>
                  </select>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>IP</th><th>ЗАПИСИ</th><th>ПОСЛЕДНИЙ РАЗ</th></tr></thead>
                    <tbody id="daTop"></tbody>
                  </table>
                </div>
              </section>

              <section class="da-card">
                <div class="da-card-head">
                  <div class="da-card-title">Популярные страницы</div>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>СТРАНИЦА</th><th>ПОСЕЩЕНИЯ</th></tr></thead>
                    <tbody id="daPages"></tbody>
                  </table>
                </div>
              </section>
            </div>

            <section class="da-card" style="margin-top:14px">
              <div class="da-card-head">
                <div class="da-card-title">Журнал посещений</div>
                <div class="da-tools">
                  <input id="daSearch" class="da-search" type="search" placeholder="Поиск по IP или странице">
                </div>
              </div>
              <div class="da-table-wrap">
                <table class="da-table">
                  <thead><tr><th>ВРЕМЯ</th><th>IP</th><th>СТРАНИЦА</th><th>УСТРОЙСТВО / БРАУЗЕР</th></tr></thead>
                  <tbody id="daVisits"></tbody>
                </table>
              </div>
            </section>

            <div class="da-grid">
              <section class="da-card">
                <div class="da-card-head">
                  <div class="da-card-title">Устройства и браузеры</div>
                  <div class="da-card-desc">Приблизительное определение по User-Agent</div>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>УСТРОЙСТВО</th><th>ОС</th><th>БРАУЗЕР</th><th>ЗАПИСИ</th></tr></thead>
                    <tbody id="daDevices"></tbody>
                  </table>
                </div>
              </section>

              <section class="da-card">
                <div class="da-card-head">
                  <div class="da-card-title">Системные события</div>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>ВРЕМЯ</th><th>ТИП</th><th>СООБЩЕНИЕ</th></tr></thead>
                    <tbody id="daEvents"></tbody>
                  </table>
                </div>
              </section>
            </div>

            <div class="da-footer-note">
              Отсутствующие IP и User-Agent не восстанавливаются догадками.
              История ограничена теми данными, которые реально сохранил сервер.
              Если API недоступен или вернул неправильный формат, панель покажет ошибку.
            </div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    trigger.addEventListener("click", openPanel);
    $("#daClose").addEventListener("click", closePanel);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("da-open")) {
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
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(
        data?.detail || data?.message || `Ошибка сервера ${response.status}`
      );
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function getArray(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    if (data && Array.isArray(data.items)) return data.items;

    throw new Error(`API вернул данные без ожидаемого списка "${key}".`);
  }

  function loginError(message) {
    const node = $("#daLoginError");
    if (!node) return;
    node.textContent = message;
    node.classList.remove("da-hidden");
  }

  async function openPanel() {
    const overlay = $("#darkAdminOverlay");
    if (!overlay) return;

    stopRefresh();
    state.authenticated = false;
    overlay.classList.add("da-open");
    document.body.style.overflow = "hidden";

    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daLoginError").classList.add("da-hidden");
    $("#daUsername").value = "";
    $("#daPassword").value = "";

    try {
      await api("/api/admin/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (error) {
      console.warn("Не удалось сбросить старую сессию:", error);
    }

    $("#daUsername").focus();
  }

  async function closePanel() {
    stopRefresh();
    state.authenticated = false;

    try {
      await api("/api/admin/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (error) {
      console.warn("Ошибка завершения сессии:", error);
    }

    $("#darkAdminOverlay")?.classList.remove("da-open");
    document.body.style.overflow = "";
    $("#daDashboard")?.classList.add("da-hidden");
    $("#daLogin")?.classList.remove("da-hidden");

    if ($("#daUsername")) $("#daUsername").value = "";
    if ($("#daPassword")) $("#daPassword").value = "";

    $("#daLoginError")?.classList.add("da-hidden");
  }

  async function login(event) {
    event.preventDefault();

    const button = $("#daLoginButton");
    button.disabled = true;
    button.textContent = "ПРОВЕРКА…";
    $("#daLoginError").classList.add("da-hidden");

    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("#daUsername").value.trim(),
          password: $("#daPassword").value
        })
      });

      state.authenticated = true;
      $("#daPassword").value = "";
      $("#daLogin").classList.add("da-hidden");
      $("#daDashboard").classList.remove("da-hidden");

      await loadData();
      startRefresh();
    } catch (error) {
      state.authenticated = false;
      $("#daPassword").value = "";

      if ([400, 401, 403].includes(error.status)) {
        showDeniedScreen();
      } else {
        loginError("Не удалось подтвердить вход через сервер. Проверь соединение и попробуй ещё раз.");
        console.error("Ошибка входа:", error);
      }
    } finally {
      button.disabled = false;
      button.textContent = "ПРОВЕРИТЬ ДОСТУП";
    }
  }

  async function logout() {
    stopRefresh();
    state.authenticated = false;

    try {
      await api("/api/admin/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (error) {
      console.warn("Ошибка выхода:", error);
    }

    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daUsername").value = "";
    $("#daPassword").value = "";
    $("#daLoginError").classList.add("da-hidden");
    $("#daUsername").focus();
  }

  function startRefresh() {
    stopRefresh();

    refreshTimer = window.setInterval(() => {
      if (
        state.authenticated &&
        $("#darkAdminOverlay")?.classList.contains("da-open") &&
        !$("#daDashboard")?.classList.contains("da-hidden")
      ) {
        loadData();
      }
    }, 10000);
  }

  function stopRefresh() {
    if (refreshTimer !== null) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="da-empty">${esc(message)}</td></tr>`;
  }

  function showDataError(error) {
    const status = $("#daStatus");
    if (status) {
      status.textContent = `Ошибка загрузки: ${error.message || "неизвестная ошибка"}`;
    }

    for (const id of [
      "daTotal", "daRecent", "daIPs", "daEventCount"
    ]) {
      const node = $("#" + id);
      if (node) node.textContent = "—";
    }

    $("#daTop").innerHTML = emptyRow(3, "Нет подтверждённых данных");
    $("#daPages").innerHTML = emptyRow(2, "Нет подтверждённых данных");
    $("#daVisits").innerHTML = emptyRow(4, "Не удалось загрузить журнал");
    $("#daDevices").innerHTML = emptyRow(4, "Нет подтверждённых данных");
    $("#daEvents").innerHTML = emptyRow(3, "Не удалось загрузить события");
  }

  async function loadData() {
    if (state.loading || !state.authenticated) return;

    state.loading = true;
    const button = $("#daRefresh");
    if (button) {
      button.disabled = true;
      button.textContent = "ЗАГРУЗКА…";
    }

    const status = $("#daStatus");
    if (status) status.textContent = "Получение данных от сервера…";

    try {
      const [visitsResponse, eventsResponse] = await Promise.all([
        api("/api/admin/visits"),
        api("/api/admin/events")
      ]);

      // Не подменяем ошибочный ответ пустыми массивами.
      const visits = getArray(visitsResponse, "visits");
      const events = getArray(eventsResponse, "events");

      state.visits = visits;
      state.events = events;

      renderStats();
      renderVisits();
      renderEvents();

      if (status) {
        status.textContent = `Загружено записей: ${visits.length}; событий: ${events.length}.`;
      }
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        state.authenticated = false;
        stopRefresh();
        $("#daDashboard").classList.add("da-hidden");
        $("#daLogin").classList.remove("da-hidden");
        loginError("Сессия завершена. Войди снова.");
      } else {
        showDataError(error);
      }

      console.error("Ошибка загрузки аналитики:", error);
    } finally {
      state.loading = false;

      if (button) {
        button.disabled = false;
        button.textContent = "↻ ОБНОВИТЬ";
      }
    }
  }

  function renderStats() {
    const now = Date.now();

    const validTimes = state.visits.map((item) => ({
      item,
      time: new Date(timeOf(item)).getTime()
    }));

    const recent = validTimes.filter(({ time }) =>
      Number.isFinite(time) &&
      time <= now &&
      time >= now - 30 * 60 * 1000
    );

    // Считаем только непустые, реально записанные IP.
    const ips = new Set(
      state.visits.map(ipOf).filter(Boolean)
    );

    $("#daTotal").textContent = String(state.visits.length);
    $("#daRecent").textContent = String(recent.length);
    $("#daIPs").textContent = String(ips.size);
    $("#daEventCount").textContent = String(state.events.length);

    const cutoff = state.minutes ? now - state.minutes * 60000 : -Infinity;

    const filtered = validTimes.filter(({ time }) =>
      Number.isFinite(time)
        ? time <= now && time >= cutoff
        : state.minutes === 0
    );

    const activity = new Map();
    const pages = new Map();
    const devices = new Map();

    for (const { item, time } of filtered) {
      const ip = ipOf(item) || "IP не записан";
      const entry = activity.get(ip) || { count: 0, latest: 0 };
      entry.count++;

      if (Number.isFinite(time)) {
        entry.latest = Math.max(entry.latest, time);
      }

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
      .sort((a, b) =>
        b[1].count - a[1].count || b[1].latest - a[1].latest
      )
      .slice(0, 10);

    $("#daTop").innerHTML = top.length ? top.map(([ip, entry]) => `
      <tr>
        <td>${esc(ip)}</td>
        <td>${entry.count}</td>
        <td>${entry.latest ? dateText(entry.latest) : "Не записано"}</td>
      </tr>
    `).join("") : emptyRow(3, "Нет посещений за этот период");

    const popular = [...pages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    $("#daPages").innerHTML = popular.length ? popular.map(([path, count]) => `
      <tr><td>${esc(path)}</td><td>${count}</td></tr>
    `).join("") : emptyRow(2, "Нет записей о страницах");

    const deviceRows = [...devices.values()]
      .sort((a, b) => b.count - a.count);

    $("#daDevices").innerHTML = deviceRows.length ? deviceRows.map((item) => `
      <tr>
        <td>${esc(item.device)}</td>
        <td>${esc(item.os)}</td>
        <td>${esc(item.browser)}</td>
        <td>${item.count}</td>
      </tr>
    `).join("") : emptyRow(4, "Нет записей об устройствах");
  }

  function renderVisits() {
    const visits = state.visits.slice().reverse().filter((item) =>
      `${ipOf(item)} ${pathOf(item)} ${uaOf(item)} ${timeOf(item)}`
        .toLowerCase().includes(state.search)
    );

    $("#daVisits").innerHTML = visits.length ? visits.map((item) => {
      const ua = uaOf(item);
      const info = deviceInfo(ua);

      return `
        <tr>
          <td>${esc(dateText(timeOf(item)))}</td>
          <td>${esc(ipOf(item) || "Не записан")}</td>
          <td>${esc(pathOf(item))}</td>
          <td>
            ${esc(ua || "User-Agent не записан")}
            <div class="da-note">
              ${esc(info.device)} · ${esc(info.os)} · ${esc(info.browser)}
            </div>
          </td>
        </tr>
      `;
    }).join("") : emptyRow(4, state.search ? "Совпадений нет" : "Посещений нет");
  }

  function renderEvents() {
    const events = state.events.slice().reverse();

    $("#daEvents").innerHTML = events.length ? events.map((item) => `
      <tr>
        <td>${esc(dateText(timeOf(item)))}</td>
        <td>${esc(item?.type || item?.level || item?.category || "Не указан")}</td>
        <td>${esc(
          item?.message ??
          item?.detail ??
          item?.description ??
          "Сообщение не записано"
        )}</td>
      </tr>
    `).join("") : emptyRow(3, "Событий нет");
  }

  function init() {
    installStyles();
    makePanel();
    makeDeniedScreen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
