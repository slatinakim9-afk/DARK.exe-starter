
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    modules: {
      ghost_mode: false,
      auto_reply: false,
      specter: false,
      archive: false
    },
    events: [],
    sessionStarted: Date.now(),
    scans: 0,
    commandCount: 0
  };

  const MAX_EVENTS = 80;

  function now() {
    return new Date().toLocaleTimeString("ru-RU", { hour12: false });
  }

  function notify(message) {
    const notice = $("notice");
    if (!notice) return;

    notice.textContent = message;
    notice.classList.add("show");

    if (state.noticeTimer) clearTimeout(state.noticeTimer);
    state.noticeTimer = setTimeout(() => {
      notice.classList.remove("show");
    }, 3200);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function addEvent(type, message) {
    state.events.unshift({
      type,
      message,
      time: now()
    });

    state.events = state.events.slice(0, MAX_EVENTS);
    renderEvents();
  }

  function renderEvents() {
    const container = $("events");
    if (!container) return;

    if (!state.events.length) {
      container.innerHTML =
        '<div class="empty-state">ЖУРНАЛ ОЖИДАЕТ СОБЫТИЙ...</div>';
    } else {
      container.innerHTML = state.events.map((event) => `
        <div class="event-row">
          <span class="event-type">${escapeHTML(event.type)}</span>
          <span class="event-detail">${escapeHTML(event.message)}</span>
          <span class="event-time">${escapeHTML(event.time)}</span>
        </div>
      `).join("");
    }

    const count = $("eventCount");
    if (count) count.textContent = String(state.events.length).padStart(3, "0");

    const timestamp = $("eventTimestamp");
    if (timestamp) timestamp.textContent = `LAST EVENT // ${now()}`;

    const archiveCount = $("archiveCount");
    if (archiveCount) {
      archiveCount.textContent = `ЗАПИСЕЙ: ${state.events.length}`;
    }
  }

  function renderModules() {
    let active = 0;

    Object.entries(state.modules).forEach(([key, enabled]) => {
      const status = $(`${key}Status`);
      const button = $(`${key}Btn`);
      const card = document.querySelector(`[data-module="${key}"]`);

      if (enabled) active++;

      if (status) {
        status.textContent = enabled ? "ACTIVE" : "STANDBY";
        status.classList.toggle("active", enabled);
      }

      if (button) {
        button.classList.toggle("active", enabled);
        if (key === "ghost_mode" || key === "auto_reply") {
          button.textContent = enabled ? "ОТКЛЮЧИТЬ ↗" : "АКТИВИРОВАТЬ ↗";
        }
      }

      if (card) card.classList.toggle("active", enabled);
    });

    const activeModules = $("activeModules");
    if (activeModules) activeModules.textContent = String(active).padStart(2, "0");
  }

  function terminalLine(text, className = "terminal-output") {
    const output = $("terminalOutput");
    if (!output) return;

    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;

    const cursor = output.querySelector(".terminal-cursor");
    if (cursor && cursor.parentElement) {
      cursor.parentElement.remove();
    }

    output.appendChild(line);

    const prompt = document.createElement("div");
    prompt.innerHTML =
      '<span class="terminal-prompt">root@dark:~$</span> ' +
      '<span class="terminal-cursor">_</span>';
    output.appendChild(prompt);

    while (output.children.length > 35) {
      output.removeChild(output.firstElementChild);
    }

    output.scrollTop = output.scrollHeight;
  }

  function runScan() {
    state.scans++;

    const integrity = Math.max(91, 99 - Math.floor(Math.random() * 8));
    const link = 55 + Math.floor(Math.random() * 43);
    const load = 15 + Math.floor(Math.random() * 70);

    setMeter("integrity", integrity);
    setMeter("link", link);
    setMeter("load", load);

    if ($("specterStatus")) {
      $("specterStatus").textContent = "SCANNED";
    }

    if ($("heroState")) $("heroState").textContent = "SCAN COMPLETE";
    if ($("coreVisualState")) $("coreVisualState").textContent = "SCAN COMPLETE";
    if ($("signalStrength")) $("signalStrength").textContent = link > 75 ? "STABLE" : "UNSTABLE";

    addEvent("SPECTER_SCAN", `Сканирование №${state.scans} завершено.`);
    terminalLine(`scan complete // integrity ${integrity}% // link ${link}%`);

    notify("Сканирование завершено. Отчёт обновлён.");
  }

  function setMeter(name, value) {
    const valueEl = $(`${name}Value`);
    const meterEl = $(`${name}Meter`);

    if (valueEl) valueEl.textContent = `${value}%`;
    if (meterEl) meterEl.style.width = `${value}%`;
  }

  function runDiagnostics() {
    runScan();
    addEvent("DIAGNOSTICS", "Полная локальная диагностика завершена.");
    terminalLine("diagnostics --all // OK");
    notify("Диагностика интерфейса завершена.");
  }

  function toggleModule(key) {
    if (!(key in state.modules)) return;

    if (key === "specter" || key === "archive") {
      if (key === "specter") runScan();
      else openArchive();
      return;
    }

    state.modules[key] = !state.modules[key];
    renderModules();

    const label = key === "ghost_mode" ? "GHOST MODE" : "AUTO REPLY";
    const status = state.modules[key] ? "активирован" : "отключён";

    addEvent("MODULE_STATE", `${label}: ${status}.`);
    terminalLine(`${key} // ${state.modules[key] ? "ACTIVE" : "STANDBY"}`);
    notify(`${label}: ${status}. Демонстрационный режим.`);
  }

  function openArchive() {
    const section = $("archiveSection");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "center" });

    if ($("archiveStatus")) $("archiveStatus").textContent = "OPEN";
    addEvent("ARCHIVE", "Открыт локальный архив сессии.");
    terminalLine(`archive --open // ${state.events.length} records`);
  }

  function refreshSystem() {
    if ($("connectionLabel")) $("connectionLabel").textContent = "LINK REFRESHED";
    if ($("footerStatus")) $("footerStatus").textContent = "SYSTEM ONLINE";
    if ($("heroState")) $("heroState").textContent = "CORE SYNCHRONIZED";

    addEvent("SYNC", "Локальная панель синхронизирована.");
    terminalLine("sync --local // complete");
    notify("Данные интерфейса обновлены.");
  }

  function protocolInfo() {
    notify("ПРОТОКОЛ 09 // Демонстрационный режим. Внешние системы не подключены.");
    addEvent("PROTOCOL", "Запрошена информация о протоколе 09.");
    terminalLine("protocol 09 --info // local demo");
  }

  function revealFragment() {
    const content = $("revealContent");
    const button = $("revealBtn");

    if (!content) return;

    const opening = content.hidden;
    content.hidden = !opening;

    if (button) {
      button.textContent = opening ? "ЗАКРЫТЬ ФРАГМЕНТ ↗" : "РАСШИФРОВАТЬ ФРАГМЕНТ ↗";
    }

    addEvent("ARCHIVE_FRAGMENT", opening ? "Фрагмент DX-001 открыт." : "Фрагмент DX-001 закрыт.");
    terminalLine(`fragment DX-001 // ${opening ? "DECODED" : "SEALED"}`);
  }

  function executeCommand(raw) {
    const command = raw.trim().toLowerCase();
    if (!command) return;

    state.commandCount++;
    terminalLine(`command // ${raw}`, "terminal-prompt");

    switch (command) {
      case "help":
        terminalLine("commands: help, status, scan, events, modules, clear, time, about");
        break;

      case "status":
        terminalLine(`system online // modules ${Object.values(state.modules).filter(Boolean).length}/4`);
        break;

      case "scan":
        runScan();
        break;

      case "events":
        terminalLine(`event log // ${state.events.length} records`);
        state.events.slice(0, 5).forEach((event) => {
          terminalLine(`${event.time} [${event.type}] ${event.message}`);
        });
        break;

      case "modules":
        Object.entries(state.modules).forEach(([key, enabled]) => {
          terminalLine(`${key} // ${enabled ? "ACTIVE" : "STANDBY"}`);
        });
        break;

      case "clear":
        if ($("terminalOutput")) {
          $("terminalOutput").replaceChildren();
        }
        terminalLine("terminal cleared // local session");
        break;

      case "time":
        terminalLine(`local time // ${now()}`);
        break;

      case "about":
        terminalLine("DARK.exe // unknown system // demo build 1.0");
        break;

      default:
        terminalLine(`unknown command: ${raw}`);
        terminalLine("type help to list available demo commands");
    }

    addEvent("TERMINAL", `Выполнена команда: ${raw}`);
  }

  function updateClock() {
    const clock = $("systemClock");
    if (clock) clock.textContent = now();
  }

  function initTelegram() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;

    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor("#080608");
      tg.setBackgroundColor("#080608");
    } catch (error) {
      // Сайт продолжает работать и вне Telegram.
    }
  }

  function bind(id, handler) {
    const element = $(id);
    if (element) element.addEventListener("click", handler);
  }

  function init() {
    initTelegram();
    renderModules();
    renderEvents();
    updateClock();

    bind("signalBtn", () => {
      addEvent("SIGNAL", "Пользователь инициировал демонстрационный сигнал.");
      if ($("heroState")) $("heroState").textContent = "SIGNAL TRANSMITTED";
      if ($("coreVisualState")) $("coreVisualState").textContent = "SIGNAL TRANSMITTED";
      terminalLine("signal --init // simulated");
      notify("Демонстрационный сигнал инициирован.");
    });

    bind("scanBtn", runScan);
    bind("specterBtn", runScan);
    bind("diagnosticBtn", runDiagnostics);
    bind("refreshBtn", refreshSystem);
    bind("protocolBtn", protocolInfo);
    bind("revealBtn", revealFragment);
    bind("archiveBtn", openArchive);
    bind("viewArchiveBtn", openArchive);

    bind("clearEventsBtn", () => {
      state.events = [];
      renderEvents();
      addEvent("LOG", "Локальный журнал очищен.");
      notify("Журнал очищен.");
    });

    document.querySelectorAll("[data-module]").forEach((button) => {
      if (button.tagName !== "BUTTON") return;
      const key = button.dataset.module;
      if (key) button.addEventListener("click", () => toggleModule(key));
    });

    const form = $("terminalForm");
    const input = $("terminalInput");

    if (form && input) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const command = input.value;
        input.value = "";
        executeCommand(command);
      });
    }

    addEvent("BOOT", "DARK.exe UI initialized.");
    terminalLine("system_check --all // complete");
    setInterval(updateClock, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
