
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = { visits: [], events: [], search: "", minutes: 30 };
  let liveRefreshTimer = null;
  let loading = false;

  const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const timeOf = (item) =>
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

    return {
      device: /ipad|tablet/.test(s) ? "Планшет" :
        /iphone|android.*mobile|mobile/.test(s) ? "Телефон" :
        s ? "Компьютер / не уточнён" : "Нет данных",
      os: /windows/.test(s) ? "Windows" :
        /iphone|ipad/.test(s) ? "iOS / iPadOS" :
        /macintosh|mac os/.test(s) ? "macOS" :
        /android/.test(s) ? "Android" :
        /linux/.test(s) ? "Linux" :
        s ? "Не определена" : "Нет данных",
      browser: /edg\//.test(s) ? "Edge" :
        /opr\/|opera/.test(s) ? "Opera" :
        /firefox\//.test(s) ? "Firefox" :
        /chrome\//.test(s) ? "Chrome" :
        /safari\//.test(s) ? "Safari" : "Не определён"
    };
  }

  function installStyles() {
    if ($("#darkAdminStyles")) return;

    const style = document.createElement("style");
    style.id = "darkAdminStyles";
    style.textContent = `
      /* SYSTEM ONLINE: сохраняем внешний вид обычного текста футера */
      footer button#systemAdminTrigger,
      button#systemAdminTrigger.system-admin-trigger,
      #systemAdminTrigger,
      #systemAdminTrigger:hover,
      #systemAdminTrigger:active,
      #systemAdminTrigger:focus,
      #systemAdminTrigger:focus-visible {
        all: unset !important;
        display: inline !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        background: transparent !important;
        background-color: transparent !important;
        color: inherit !important;
        font: inherit !important;
        letter-spacing: inherit !important;
        text-transform: inherit !important;
        text-decoration: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        filter: none !important;
        transform: none !important;
        opacity: 1 !important;
        padding: 0 !important;
        margin: 0 !important;
        cursor: pointer !important;
        transition: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      #systemAdminTrigger .pulse,
      #systemAdminTrigger::before,
      #systemAdminTrigger::after {
        display: none !important;
        content: none !important;
        box-shadow: none !important;
      }

      #darkAdminOverlay {
        display:none;position:fixed;inset:0;z-index:999999;
        align-items:center;justify-content:center;padding:clamp(8px,2vw,24px);
        background:rgba(3,4,8,.88);backdrop-filter:blur(16px);
        -webkit-backdrop-filter:blur(16px);
        color:#eee;font-family:Inter,Arial,sans-serif
      }
      #darkAdminOverlay.da-open{display:flex}
      #darkAdminOverlay *{box-sizing:border-box}
      .da-window {
        width:min(1320px,100%);height:min(900px,96dvh);
        overflow:auto;background:#090a0f;
        border:1px solid #34222b;border-radius:14px;
        box-shadow:0 30px 100px #000c,0 0 45px #ff30480a
      }
      .da-head {
        position:sticky;top:0;z-index:3;
        display:flex;align-items:center;justify-content:space-between;
        gap:15px;padding:18px 24px;
        background:#0b0c12ed;backdrop-filter:blur(12px);
        border-bottom:1px solid #28202a
      }
      .da-brand{display:flex;align-items:center;gap:13px;min-width:0}
      .da-brand-mark {
        display:grid;place-items:center;flex:0 0 42px;height:42px;
        border:1px solid #632637;border-radius:10px;
        color:#ff4058;font:bold 19px monospace;
        background:linear-gradient(145deg,#291019,#0b0c12)
      }
      .da-kicker{font:10px monospace;letter-spacing:2px;color:#ff536b}
      .da-title{font-size:21px;font-weight:800;letter-spacing:-.5px;margin-top:4px}
      .da-sub{font-size:12px;line-height:1.6;color:#918795;margin-top:5px}
      .da-red{color:#ff4058}
      .da-btn {
        display:inline-flex;align-items:center;justify-content:center;gap:8px;
        min-height:38px;padding:9px 13px;border:1px solid #352b37;
        border-radius:7px;background:#121219;color:#e8e2e9;
        cursor:pointer;font:11px monospace;letter-spacing:.4px;
        transition:border-color .15s,background .15s
      }
      .da-btn:hover{border-color:#a33b50;background:#1b1018}
      .da-btn:disabled{opacity:.5;cursor:wait}
      .da-primary{background:#951b30;border-color:#ff4058;color:white}
      .da-primary:hover{background:#b3223a}
      .da-content{padding:clamp(14px,2.5vw,28px)}
      .da-hidden{display:none!important}

      .da-login {
        width:min(440px,100%);margin:clamp(35px,8vh,90px) auto;
        padding:clamp(20px,4vw,34px);
        border:1px solid #33242f;border-radius:12px;
        background:linear-gradient(145deg,#101016,#090a0f);
        box-shadow:0 20px 70px #0008
      }
      .da-login-icon {
        display:grid;place-items:center;width:48px;height:48px;
        margin-bottom:22px;border:1px solid #733044;
        border-radius:12px;color:#ff4058;font-size:23px
      }
      .da-login h3{margin:0;font-size:20px}
      .da-field{display:block;margin-top:19px}
      .da-field span {
        display:block;margin-bottom:8px;color:#a69aa9;
        font:10px monospace;letter-spacing:1.2px
      }
      .da-field input,.da-search,.da-select {
        width:100%;min-height:42px;padding:11px 12px;
        border:1px solid #352b39;border-radius:7px;
        outline:none;background:#07080c;color:#f4edf4;
        font:13px Inter,Arial,sans-serif
      }
      .da-field input:focus,.da-search:focus,.da-select:focus {
        border-color:#b83b52;box-shadow:0 0 0 3px #ff304814
      }
      .da-login button{width:100%;margin-top:23px}
      .da-error {
        margin-top:14px;padding:11px 12px;border:1px solid #743042;
        border-radius:7px;background:#260b12;color:#ff8b9a;
        font-size:12px;line-height:1.5
      }

      .da-toolbar {
        display:flex;justify-content:space-between;align-items:center;
        flex-wrap:wrap;gap:15px;margin-bottom:23px
      }
      .da-toolbar-actions{display:flex;flex-wrap:wrap;gap:8px}
      .da-section-label {
        margin-bottom:7px;color:#ff536b;
        font:10px monospace;letter-spacing:1.8px
      }
      .da-page-title{font-size:clamp(22px,3vw,30px);font-weight:800;letter-spacing:-1px}
      .da-page-sub{margin-top:6px;color:#938796;font-size:12px;line-height:1.6}
      .da-live {
        display:inline-flex;align-items:center;gap:8px;
        padding:8px 10px;border:1px solid #253e34;border-radius:7px;
        background:#0c1712;color:#90d8ae;font:10px monospace
      }
      .da-live-dot {
        width:7px;height:7px;border-radius:50%;background:#54d88c;
        box-shadow:0 0 10px #54d88c
      }
      .da-stats {
        display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;margin:20px 0 28px
      }
      .da-stat {
        min-width:0;padding:17px;border:1px solid #29232e;
        border-radius:10px;background:linear-gradient(145deg,#111118,#0a0b10)
      }
      .da-stat-top {
        display:flex;align-items:center;justify-content:space-between;
        gap:8px;color:#a69baa;font:10px monospace;letter-spacing:.6px
      }
      .da-stat-icon {
        display:grid;place-items:center;width:30px;height:30px;
        border:1px solid #392631;border-radius:8px;
        color:#ff6478;background:#190e15;font-size:14px
      }
      .da-stat-value {
        margin-top:15px;font-size:clamp(24px,3vw,34px);
        font-weight:800;letter-spacing:-1px;overflow-wrap:anywhere
      }
      .da-stat-foot{margin-top:7px;color:#827889;font-size:11px;line-height:1.5}
      .da-grid-two {
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
        gap:16px;margin-top:18px
      }
      .da-card {
        min-width:0;border:1px solid #29232e;border-radius:10px;
        background:#0b0c11;overflow:hidden
      }
      .da-card-head {
        display:flex;align-items:center;justify-content:space-between;
        flex-wrap:wrap;gap:12px;padding:16px 17px;
        border-bottom:1px solid #26202a
      }
      .da-card-title{font-size:13px;font-weight:700}
      .da-card-desc{margin-top:5px;color:#837889;font-size:11px;line-height:1.5}
      .da-card-body{padding:15px 17px}
      .da-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .da-search{width:min(260px,100%);min-height:38px;font-size:12px}
      .da-select{width:auto;min-height:38px;padding:8px 10px;font-size:12px}
      .da-table-wrap{width:100%;overflow:auto}
      .da-table{width:100%;border-collapse:collapse;min-width:520px}
      .da-table th,.da-table td {
        padding:12px 14px;text-align:left;vertical-align:top;
        border-bottom:1px solid #201b24;font-size:12px;
        line-height:1.55;overflow-wrap:anywhere
      }
      .da-table th {
        background:#ffffff03;color:#988b9c;
        font:10px monospace;letter-spacing:.7px;white-space:nowrap
      }
      .da-table tbody tr:hover{background:#ffffff04}
      .da-table tbody tr:last-child td{border-bottom:0}
      .da-empty{text-align:center!important;padding:27px!important;color:#847a8a!important}
      .da-rank {
        display:inline-grid;place-items:center;min-width:25px;height:25px;
        border:1px solid #49303a;border-radius:6px;color:#ff687d;
        font:11px monospace
      }
      .da-pill {
        display:inline-block;padding:4px 7px;border:1px solid #3a303e;
        border-radius:5px;color:#d7cbdc;font:10px monospace
      }
      .da-note{margin-top:8px;color:#827889;font-size:11px;line-height:1.6}
      .da-event-message{min-width:180px;max-width:520px;overflow-wrap:anywhere}
      .da-footer-note {
        margin-top:22px;padding:13px 15px;border:1px solid #29232e;
        border-radius:8px;background:#ffffff02;color:#877d8d;
        font-size:11px;line-height:1.7
      }
      .da-loading-line {
        height:2px;background:linear-gradient(90deg,transparent,#ff4058,transparent);
        animation:daLoad 1.2s linear infinite
      }
      @keyframes daLoad{from{transform:translateX(-100%)}to{transform:translateX(100%)}}

      /* Локальный экран отказа в доступе */
      #daDeniedScreen {
        display:none;position:fixed;inset:0;z-index:2147483647;
        overflow:auto;align-items:center;justify-content:center;
        padding:20px;background:#050204;color:#f8e9ec;
        font-family:"Space Mono",monospace
      }
      #daDeniedScreen.da-denied-visible{display:flex}
      .da-denied-noise {
        position:fixed;inset:-20%;pointer-events:none;opacity:.18;
        background:repeating-linear-gradient(
          transparent 0,transparent 3px,#ff183322 4px
        );
        animation:daNoise .13s steps(2) infinite
      }
      .da-denied-frame {
        position:relative;width:min(760px,100%);
        border:1px solid #ff3048;background:#0a0508;
        box-shadow:0 0 60px #ff102533,inset 0 0 40px #ff10250a;
        animation:daGlitch .22s steps(2) 5
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
      @keyframes daGlitch {
        0%,100%{transform:translateX(0);filter:none}
        25%{transform:translateX(-3px);filter:hue-rotate(20deg)}
        50%{transform:translateX(3px);filter:contrast(1.4)}
        75%{transform:translateX(-1px)}
      }
      @keyframes daNoise {
        0%{transform:translate(0,-2px)}
        100%{transform:translate(0,2px)}
      }

      @media(max-width:800px) {
        .da-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
        .da-grid-two{grid-template-columns:1fr}
        .da-head{padding:14px}
        .da-content{padding:13px}
        .da-stat{padding:13px}
        .da-card-head{padding:13px}
        .da-card-body{padding:12px}
      }
      @media(max-width:420px) {
        .da-brand-mark{display:none}
        .da-title{font-size:18px}
        .da-toolbar{align-items:flex-start}
        .da-toolbar-actions{width:100%}
        .da-toolbar-actions .da-btn{flex:1}
        .da-stat-top{font-size:9px}
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
          <p>ПОПЫТКА ДОСТУПА К ПАНЕЛИ АДМИНИСТРАТОРА ОТКЛОНЕНА</p>
          <div class="da-denied-line"></div>
          <div class="da-denied-status">
            <span class="da-denied-dot"></span>
            AUTHENTICATION FAILED
          </div>
          <p class="da-denied-small">
            ДОСТУП НЕ ПРЕДОСТАВЛЕН. СОЕДИНЕНИЕ С АДМИНИСТРАТИВНЫМ
            ИНТЕРФЕЙСОМ ЗАБЛОКИРОВАНО В ЭТОМ ОКНЕ.
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
    $("#daDeniedScreen").classList.add("da-denied-visible");
    $("#daDeniedReturn").focus();
  }

  function makePanel() {
    if ($("#darkAdminOverlay")) return;

    const trigger = $("#systemAdminTrigger");
    if (!trigger) {
      console.error("DARK Admin: #systemAdminTrigger не найден.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "darkAdminOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.innerHTML = `
      <div class="da-window">
        <header class="da-head">
          <div class="da-brand">
            <div class="da-brand-mark">D</div>
            <div>
              <div class="da-kicker">DARK.exe / RESTRICTED ACCESS</div>
              <div class="da-title">ADMIN <span class="da-red">CONTROL</span></div>
              <div class="da-sub">Мониторинг посещений и системных событий</div>
            </div>
          </div>
          <button class="da-btn" id="daClose" type="button">ЗАКРЫТЬ ✕</button>
        </header>

        <div class="da-content">
          <form id="daLogin" class="da-login">
            <div class="da-login-icon">⌑</div>
            <div class="da-kicker">IDENTITY VERIFICATION</div>
            <h3 style="margin-top:9px">Вход администратора</h3>
            <p class="da-sub">Подтверди учётные данные для открытия панели управления.</p>

            <label class="da-field">
              <span>ИМЯ ПОЛЬЗОВАТЕЛЯ</span>
              <input id="daUsername" autocomplete="username" required maxlength="100">
            </label>
            <label class="da-field">
              <span>ПАРОЛЬ</span>
              <input id="daPassword" type="password" autocomplete="current-password" required maxlength="200">
            </label>
            <button class="da-btn da-primary" id="daLoginButton" type="submit">
              ПРОВЕРИТЬ ДОСТУП ↗
            </button>
            <div id="daLoginError" class="da-error da-hidden" role="alert"></div>
          </form>

          <div id="daDashboard" class="da-hidden">
            <div class="da-toolbar">
              <div>
                <div class="da-section-label">01 / OVERVIEW</div>
                <div class="da-page-title">Обзор системы</div>
                <div class="da-page-sub">Реальные записи, полученные от серверного API.</div>
              </div>
              <div class="da-toolbar-actions">
                <span class="da-live"><span class="da-live-dot"></span> LIVE MONITOR</span>
                <button class="da-btn" id="daRefresh" type="button">↻ ОБНОВИТЬ</button>
                <button class="da-btn" id="daLogout" type="button">ВЫЙТИ</button>
              </div>
            </div>

            <div id="daLoadingLine" class="da-loading-line da-hidden"></div>

            <div class="da-stats">
              <div class="da-stat">
                <div class="da-stat-top"><span>ВСЕГО ПОСЕЩЕНИЙ</span><span class="da-stat-icon">↗</span></div>
                <div class="da-stat-value" id="daTotal">0</div>
                <div class="da-stat-foot">Записи в доступном журнале</div>
              </div>
              <div class="da-stat">
                <div class="da-stat-top"><span>ЗА 30 МИНУТ</span><span class="da-stat-icon">◷</span></div>
                <div class="da-stat-value" id="daRecent">0</div>
                <div class="da-stat-foot">По времени записей</div>
              </div>
              <div class="da-stat">
                <div class="da-stat-top"><span>УНИКАЛЬНЫЕ IP</span><span class="da-stat-icon">◎</span></div>
                <div class="da-stat-value" id="daIPs">0</div>
                <div class="da-stat-foot">В доступном журнале</div>
              </div>
              <div class="da-stat">
                <div class="da-stat-top"><span>СОБЫТИЯ</span><span class="da-stat-icon">≡</span></div>
                <div class="da-stat-value" id="daEventCount">0</div>
                <div class="da-stat-foot">Записи API событий</div>
              </div>
            </div>

            <div class="da-grid-two">
              <section class="da-card">
                <div class="da-card-head">
                  <div>
                    <div class="da-card-title">Активность по IP</div>
                    <div class="da-card-desc">Число посещений в выбранном периоде</div>
                  </div>
                  <select class="da-select" id="daRange" aria-label="Период активности">
                    <option value="30">30 минут</option>
                    <option value="60">1 час</option>
                    <option value="1440">24 часа</option>
                    <option value="0">Весь журнал</option>
                  </select>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>#</th><th>IP</th><th>ЗАПИСИ</th><th>ПОСЛЕДНИЙ РАЗ</th></tr></thead>
                    <tbody id="daTop"></tbody>
                  </table>
                </div>
              </section>

              <section class="da-card">
                <div class="da-card-head">
                  <div>
                    <div class="da-card-title">Популярные страницы</div>
                    <div class="da-card-desc">Страницы с наибольшим числом записей</div>
                  </div>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>#</th><th>СТРАНИЦА</th><th>ПОСЕЩЕНИЯ</th></tr></thead>
                    <tbody id="daPages"></tbody>
                  </table>
                </div>
              </section>
            </div>

            <section class="da-card" style="margin-top:16px">
              <div class="da-card-head">
                <div>
                  <div class="da-card-title">Журнал посещений</div>
                  <div class="da-card-desc">Время, IP, страница и данные User-Agent</div>
                </div>
                <div class="da-tools">
                  <input id="daSearch" class="da-search" type="search" placeholder="Поиск по IP, странице…" aria-label="Поиск посещений">
                </div>
              </div>
              <div class="da-table-wrap">
                <table class="da-table">
                  <thead><tr><th>ВРЕМЯ</th><th>IP</th><th>СТРАНИЦА</th><th>УСТРОЙСТВО / БРАУЗЕР</th></tr></thead>
                  <tbody id="daVisits"></tbody>
                </table>
              </div>
            </section>

            <div class="da-grid-two">
              <section class="da-card">
                <div class="da-card-head">
                  <div>
                    <div class="da-card-title">Устройства и браузеры</div>
                    <div class="da-card-desc">Определяются приблизительно по User-Agent</div>
                  </div>
                </div>
                <div class="da-table-wrap">
                  <table class="da-table">
                    <thead><tr><th>ТИП</th><th>ОС</th><th>БРАУЗЕР</th><th>ЗАПИСИ</th></tr></thead>
                    <tbody id="daDevices"></tbody>
                  </table>
                </div>
              </section>

              <section class="da-card">
                <div class="da-card-head">
                  <div>
                    <div class="da-card-title">Системные события</div>
                    <div class="da-card-desc">Последние записи событий API</div>
                  </div>
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
              Автообновление выполняется раз в 10 секунд, пока панель открыта.
              IP-адреса не равны количеству уникальных людей: несколько человек могут
              использовать один IP. Модель устройства не выдумывается — браузер часто
              не передаёт её в User-Agent. История и её сохранность зависят от серверного
              хранилища.
            </div>
          </div>
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
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      const error = new Error(
        data.detail || data.message || `Ошибка сервера ${response.status}`
      );
      error.status = response.status;
      throw error;
    }

    return data;
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

    stopLiveRefresh();
    overlay.classList.add("da-open");
    document.body.style.overflow = "hidden";

    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daLoginError").classList.add("da-hidden");
    $("#daUsername").value = "";
    $("#daPassword").value = "";

    try {
      // Закрываем старую серверную сессию при каждом открытии панели.
      await api("/api/admin/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn("Не удалось сбросить прежнюю сессию", error);
    }

    $("#daUsername").focus();
  }

  async function closePanel() {
    stopLiveRefresh();

    try {
      await api("/api/admin/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn("Ошибка завершения сессии", error);
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
    button.textContent = "ПРОВЕРКА ДОСТУПА…";
    $("#daLoginError").classList.add("da-hidden");

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

      const message = String(error.message || "");
      const deniedStatus = error.status === 400 ||
        error.status === 401 ||
        error.status === 403;

      const deniedMessage =
        /invalid|credential|password|username|unauthori|forbidden|невер|парол|логин|доступ|401|403/i
          .test(message);

      if (deniedStatus || deniedMessage) {
        $("#daLoginError").classList.add("da-hidden");
        showDeniedScreen();
      } else {
        loginError(
          "Не удалось связаться с сервером авторизации. Попробуй ещё раз."
        );
        console.error("Ошибка авторизации DARK.exe:", error);
      }
    } finally {
      button.disabled = false;
      button.textContent = "ПРОВЕРИТЬ ДОСТУП ↗";
    }
  }

  async function logout() {
    stopLiveRefresh();

    try {
      await api("/api/admin/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn("Ошибка выхода", error);
    }

    $("#daDashboard").classList.add("da-hidden");
    $("#daLogin").classList.remove("da-hidden");
    $("#daUsername").value = "";
    $("#daPassword").value = "";
    $("#daLoginError").classList.add("da-hidden");
    $("#daUsername").focus();
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

  function asArray(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  async function loadData() {
    if (loading) return;
    loading = true;

    const button = $("#daRefresh");
    const line = $("#daLoadingLine");

    if (button) {
      button.disabled = true;
      button.textContent = "↻ ЗАГРУЗКА";
    }
    line?.classList.remove("da-hidden");

    try {
      const [visits, events] = await Promise.all([
        api("/api/admin/visits"),
        api("/api/admin/events")
      ]);

      state.visits = asArray(visits, "visits");
      state.events = asArray(events, "events");

      renderStats();
      renderVisits();
      renderEvents();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        stopLiveRefresh();
        $("#daDashboard").classList.add("da-hidden");
        $("#daLogin").classList.remove("da-hidden");
        loginError("Сессия завершена. Войди в панель снова.");
      } else {
        $("#daVisits").innerHTML =
          `<tr><td colspan="4" class="da-empty">${esc(error.message || "Ошибка загрузки данных")}</td></tr>`;
      }
      console.error("Не удалось обновить аналитику:", error);
    } finally {
      loading = false;
      if (button) {
        button.disabled = false;
        button.textContent = "↻ ОБНОВИТЬ";
      }
      line?.classList.add("da-hidden");
    }
  }

  function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="da-empty">${esc(message)}</td></tr>`;
  }

  function renderStats() {
    const now = Date.now();

    const visits = state.visits.map((item) => ({
      item,
      time: new Date(timeOf(item)).getTime()
    }));

    const recent = visits.filter(({ time }) =>
      Number.isFinite(time) && now - time >= 0 && now - time <= 30 * 60000
    );

    const ips = new Set(
      state.visits.map(ipOf).filter((ip) => ip !== "Не определён")
    );

    $("#daTotal").textContent = state.visits.length;
    $("#daRecent").textContent = recent.length;
    $("#daIPs").textContent = ips.size;
    $("#daEventCount").textContent = state.events.length;

    const cutoff = state.minutes ? now - state.minutes * 60000 : -Infinity;
    const filtered = visits.filter(({ time }) =>
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

    $("#daTop").innerHTML = top.length ? top.map(([ip, entry], index) => `
      <tr>
        <td><span class="da-rank">${index + 1}</span></td>
        <td>${esc(ip)}</td>
        <td><span class="da-pill">${entry.count}</span></td>
        <td>${entry.latest ? dateText(entry.latest) : "—"}</td>
      </tr>
    `).join("") : emptyRow(4, "Нет посещений за выбранный период");

    const popular = [...pages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    $("#daPages").innerHTML = popular.length ? popular.map(([path, count], index) => `
      <tr>
        <td><span class="da-rank">${index + 1}</span></td>
        <td>${esc(path)}</td>
        <td>${count}</td>
      </tr>
    `).join("") : emptyRow(3, "Нет данных о страницах");

    const deviceRows = [...devices.values()].sort((a, b) => b.count - a.count);

    $("#daDevices").innerHTML = deviceRows.length ? deviceRows.map((item) => `
      <tr>
        <td>${esc(item.device)}</td>
        <td>${esc(item.os)}</td>
        <td>${esc(item.browser)}</td>
        <td>${item.count}</td>
      </tr>
    `).join("") : emptyRow(4, "Нет данных об устройствах");
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
          <td>${dateText(timeOf(item))}</td>
          <td>${esc(ipOf(item))}</td>
          <td>${esc(pathOf(item))}</td>
          <td title="${esc(ua)}">
            ${esc(ua || "User-Agent не записан")}
            ${ua ? `<div class="da-note">${esc(info.device)} · ${esc(info.os)} · ${esc(info.browser)}</div>` : ""}
          </td>
        </tr>
      `;
    }).join("") : emptyRow(4, state.search ? "Совпадений нет" : "Посещений пока нет");
  }

  function renderEvents() {
    const events = state.events.slice().reverse();

    $("#daEvents").innerHTML = events.length ? events.map((item) => `
      <tr>
        <td>${dateText(timeOf(item))}</td>
        <td><span class="da-pill">${esc(item.type || item.level || item.category || "EVENT")}</span></td>
        <td><div class="da-event-message">${esc(item.message || item.detail || item.description || JSON.stringify(item))}</div></td>
      </tr>
    `).join("") : emptyRow(3, "Событий пока нет");
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
