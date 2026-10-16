
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const state = {
    modules: {
      ghost_mode: false,
      auto_reply: false,
      specter: false,
      archive: false
    },
    events: [],
    commandHistory: [],
    commandIndex: 0,
    terminalLines: [],
    busy: false
  };

  const MODULE_NAMES = {
    ghost_mode: "GHOST MODE",
    auto_reply: "AUTO REPLY",
    specter: "SPECTER",
    archive: "ARCHIVE"
  };

  const MODULE_DESCRIPTIONS = {
    ghost_mode: "GHOST MODE",
    auto_reply: "AUTO REPLY",
    specter: "SPECTER",
    archive: "ARCHIVE"
  };

  function escapeText(value) {
    return String(value ?? "");
  }

  function formatTime(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value ?? "Unknown time");
    }

    return date.toLocaleString();
  }

  function addLocalEvent(type, message) {
    const event = {
      type,
      message,
      time: new Date().toISOString()
    };

    state.events.unshift(event);
    state.events = state.events.slice(0, 100);

    renderEvents();
    return event;
  }

  function showNotice(message) {
    const notice = $("#notice");

    if (!notice) {
      console.info("[DARK.exe]", message);
      return;
    }

    notice.textContent = message;
    notice.classList.add("show");

    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => {
      notice.classList.remove("show");
    }, 3000);
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const contentType = response.headers.get("content-type") || "";
    let result = {};

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = { detail: await response.text() };
    }

    if (!response.ok) {
      const error = new Error(
        result.detail || `Request failed (${response.status})`
      );
      error.status = response.status;
      throw error;
    }

    return result;
  }

  function renderEvents() {
    const container = $("#events");

    if (!container) return;

    container.replaceChildren();

    if (!state.events.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "NO EVENTS RECORDED";
      container.appendChild(empty);
      return;
    }

    state.events.slice(0, 30).forEach((event) => {
      const row = document.createElement("div");
      row.className = "event-row";

      const type = document.createElement("span");
      type.className = "event-type";
      type.textContent = escapeText(event.type || "EVENT");

      const message = document.createElement("span");
      message.className = "event-detail";
      message.textContent = escapeText(event.message || "");

      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = formatTime(event.time);

      row.append(type, message, time);
      container.appendChild(row);
    });
  }

  function renderModules() {
    $$("[data-module]").forEach((card) => {
      const name = card.dataset.module;
      if (!name || !(name in state.modules)) return;

      const active = Boolean(state.modules[name]);
      card.classList.toggle("active", active);

      const status = $(".module-status", card);
      if (status) {
        status.textContent = active ? "ACTIVE" : "STANDBY";
        status.classList.toggle("active", active);
      }

      const button = $(".toggle-button", card);
      if (button) {
        button.textContent = active ? "DISABLE MODULE" : "ACTIVATE MODULE";
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    });

    const activeCount = Object.values(state.modules).filter(Boolean).length;

    const moduleCount = $("#activeModules");
    if (moduleCount) moduleCount.textContent = String(activeCount);

    const moduleCountAlt = $("#moduleCount");
    if (moduleCountAlt) moduleCountAlt.textContent = String(activeCount);
  }

  async function refreshModules() {
    try {
      const modules = await apiRequest("/api/modules");

      Object.keys(state.modules).forEach((name) => {
        if (typeof modules[name] === "boolean") {
          state.modules[name] = modules[name];
        }
      });

      renderModules();
    } catch (error) {
      console.warn("Could not load modules:", error.message);
    }
  }

  async function toggleModule(name) {
    if (!(name in state.modules)) return;

    try {
      const result = await apiRequest(
        `/api/modules/${encodeURIComponent(name)}/toggle`,
        { method: "POST" }
      );

      state.modules[name] = Boolean(result.active);
      renderModules();

      const message = `${MODULE_NAMES[name]}: ${
        result.active ? "ACTIVE" : "STANDBY"
      }`;

      addLocalEvent("MODULE_STATE", message);
      showNotice(message);
    } catch (error) {
      showNotice("SERVER ERROR: " + error.message);
    }
  }

  async function refreshHealth() {
    try {
      const result = await apiRequest("/api/health");

      const statusElements = [
        $("#systemStatus"),
        $("#healthStatus"),
        $("[data-system-status]")
      ].filter(Boolean);

      statusElements.forEach((element) => {
        element.textContent = String(result.status || "UNKNOWN").toUpperCase();
      });

      const activeCount = $("#activeModules");
      if (activeCount && Number.isFinite(result.active_modules)) {
        activeCount.textContent = String(result.active_modules);
      }

      const uptime = $("#uptime");
      if (uptime) uptime.textContent = "ONLINE";

      return result;
    } catch (error) {
      const statusElements = [
        $("#systemStatus"),
        $("#healthStatus"),
        $("[data-system-status]")
      ].filter(Boolean);

      statusElements.forEach((element) => {
        element.textContent = "CONNECTION ERROR";
      });

      showNotice("API CONNECTION FAILED");
      throw error;
    }
  }

  function updateClock() {
    const now = new Date();

    $$("[data-clock]").forEach((element) => {
      element.textContent = formatTime(now);
    });

    const clock = $("#clock");
    if (clock) clock.textContent = formatTime(now);

    const date = $("#currentDate");
    if (date) {
      date.textContent = now.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "2-digit"
      });
    }
  }

  function appendTerminalLine(message, type = "normal") {
    const output =
      $("#terminalOutput") ||
      $("#terminalOutputArea") ||
      $(".terminal-output-area");

    const line = {
      message: String(message),
      type
    };

    state.terminalLines.push(line);
    state.terminalLines = state.terminalLines.slice(-100);

    if (!output) {
      console.info("[DARK terminal]", line.message);
      return;
    }

    const element = document.createElement("div");
    element.textContent = line.message;
    element.className = `terminal-line terminal-${type}`;
    output.appendChild(element);

    while (output.children.length > 100) {
      output.removeChild(output.firstElementChild);
    }

    output.scrollTop = output.scrollHeight;
  }

  function clearTerminal() {
    state.terminalLines = [];

    const output =
      $("#terminalOutput") ||
      $("#terminalOutputArea") ||
      $(".terminal-output-area");

    if (output) output.replaceChildren();
  }

  async function runTerminalCommand(rawCommand) {
    const command = String(rawCommand || "").trim();
    if (!command) return;

    appendTerminalLine(`> ${command}`, "command");

    const parts = command.toLowerCase().split(/\s+/);
    const action = parts[0];

    switch (action) {
      case "help":
        appendTerminalLine("AVAILABLE COMMANDS:");
        appendTerminalLine("help     — show commands");
        appendTerminalLine("status   — check API status");
        appendTerminalLine("scan     — run demo diagnostics");
        appendTerminalLine("events   — show recent local events");
        appendTerminalLine("modules  — list module states");
        appendTerminalLine("time     — display local time");
        appendTerminalLine("about    — display system information");
        appendTerminalLine("clear    — clear terminal");
        break;

      case "status":
        try {
          const status = await refreshHealth();
          appendTerminalLine(`STATUS: ${status.status}`);
          appendTerminalLine(`MODE: ${status.mode}`);
          appendTerminalLine(`ACTIVE MODULES: ${status.active_modules}`);
          appendTerminalLine(`SERVER TIME: ${status.timestamp}`);
        } catch {
          appendTerminalLine("Unable to reach the server.", "error");
        }
        break;

      case "scan":
        appendTerminalLine("DIAGNOSTIC STARTED...");
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        appendTerminalLine("Checking API response...");
        try {
          await apiRequest("/api/health");
          appendTerminalLine("API RESPONSE: OK");
          appendTerminalLine("DEMO DIAGNOSTIC COMPLETE.");
          addLocalEvent("DIAGNOSTIC", "Demo diagnostic completed");
        } catch {
          appendTerminalLine("API RESPONSE: FAILED", "error");
        }
        break;

      case "events":
        if (!state.events.length) {
          appendTerminalLine("No local events recorded.");
        } else {
          state.events.slice(0, 10).forEach((event) => {
            appendTerminalLine(
              `[${formatTime(event.time)}] ${event.type}: ${event.message}`
            );
          });
        }
        break;

      case "modules":
        Object.entries(state.modules).forEach(([name, active]) => {
          appendTerminalLine(`${name}: ${active ? "ACTIVE" : "STANDBY"}`);
        });
        break;

      case "time":
        appendTerminalLine(new Date().toString());
        break;

      case "about":
        appendTerminalLine("DARK.exe CONTROL CENTER");
        appendTerminalLine("Interface mode: demo");
        appendTerminalLine("Commands are local UI commands only.");
        break;

      case "clear":
        clearTerminal();
        break;

      default:
        appendTerminalLine(
          `Unknown command: ${command}. Type help to see available commands.`,
          "error"
        );
    }
  }

  function setupTerminal() {
    const form =
      $("#terminalForm") ||
      $(".terminal-input-row")?.closest("form");

    const input =
      $("#terminalInput") ||
      $(".terminal-input");

    if (!input) return;

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const command = input.value;
        input.value = "";

        state.commandHistory.unshift(command);
        state.commandHistory = state.commandHistory.slice(0, 50);
        state.commandIndex = 0;

        await runTerminalCommand(command);
      });
    } else {
      input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();

          const command = input.value;
          input.value = "";

          state.commandHistory.unshift(command);
          state.commandHistory = state.commandHistory.slice(0, 50);

          await runTerminalCommand(command);
        }
      });
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp") {
        if (!state.commandHistory.length) return;
        event.preventDefault();

        state.commandIndex = Math.min(
          state.commandIndex + 1,
          state.commandHistory.length
        );

        input.value = state.commandHistory[state.commandIndex - 1] || "";
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        state.commandIndex = Math.max(0, state.commandIndex - 1);
        input.value = state.commandIndex
          ? state.commandHistory[state.commandIndex - 1] || ""
          : "";
      }
    });

    appendTerminalLine("DARK.exe terminal initialized.");
    appendTerminalLine('Type "help" to list available commands.');
  }

  function setupDashboardButtons() {
    $$("[data-module]").forEach((card) => {
      const name = card.dataset.module;
      const button = $(".toggle-button", card);

      if (!button || !name) return;

      button.addEventListener("click", () => {
        toggleModule(name);
      });
    });

    const scanButton = $("#scanButton") || $("[data-action='scan']");
    if (scanButton) {
      scanButton.addEventListener("click", async () => {
        addLocalEvent("SCAN", "Diagnostic scan requested");
        await runTerminalCommand("scan");
      });
    }

    const refreshButton =
      $("#refreshButton") ||
      $("#refreshStatus") ||
      $("[data-action='refresh']");

    if (refreshButton) {
      refreshButton.addEventListener("click", async () => {
        try {
          await refreshHealth();
          await refreshModules();
          addLocalEvent("REFRESH", "System status refreshed");
          showNotice("SYSTEM STATUS REFRESHED");
        } catch {
          // The status function already reports the connection failure.
        }
      });
    }

    const demoEventButton =
      $("#createEventButton") ||
      $("[data-action='demo-event']");

    if (demoEventButton) {
      demoEventButton.addEventListener("click", async () => {
        try {
          const result = await apiRequest("/api/events/demo", {
            method: "POST"
          });

          addLocalEvent(
            result.event?.type || "DEMO",
            result.event?.message || "Demonstration event created"
          );

          showNotice("DEMO EVENT CREATED");
        } catch {
          addLocalEvent("DEMO", "Local demonstration event created");
          showNotice("LOCAL DEMO EVENT CREATED");
        }
      });
    }

    const clearEventsButton =
      $("#clearEventsButton") ||
      $("[data-action='clear-events']");

    if (clearEventsButton) {
      clearEventsButton.addEventListener("click", () => {
        state.events = [];
        renderEvents();
        showNotice("LOCAL EVENT VIEW CLEARED");
      });
    }

    const protocolButton =
      $("#protocolButton") ||
      $("#revealProtocol") ||
      $("[data-action='protocol']");

    if (protocolButton) {
      protocolButton.addEventListener("click", () => {
        const content =
          $("#protocolContent") ||
          $("#revealContent") ||
          $(".reveal-content");

        if (!content) {
          showNotice("PROTOCOL PANEL NOT FOUND");
          return;
        }

        const hidden =
          content.hidden ||
          getComputedStyle(content).display === "none";

        content.hidden = !hidden;
        content.style.display = hidden ? "block" : "none";

        protocolButton.setAttribute("aria-expanded", String(hidden));

        if (hidden) {
          addLocalEvent("PROTOCOL", "Protocol panel opened");
        }
      });
    }

    const quickActionButtons = $$("[data-action]");

    quickActionButtons.forEach((button) => {
      if (button.dataset.boundQuickAction === "true") return;
      button.dataset.boundQuickAction = "true";

      const action = button.dataset.action;

      if (["scan", "refresh", "demo-event", "clear-events", "protocol"].includes(action)) {
        return;
      }

      button.addEventListener("click", () => {
        switch (action) {
          case "specter":
            toggleModule("specter");
            break;

          case "archive":
            toggleModule("archive");
            break;

          case "ghost":
            toggleModule("ghost_mode");
            break;

          case "auto-reply":
            toggleModule("auto_reply");
            break;

          default:
            addLocalEvent("ACTION", `Action selected: ${action}`);
            showNotice(`ACTION: ${action.toUpperCase()}`);
        }
      });
    });
  }

  function setupAdminPanel() {
    const overlay = $("#adminOverlay");
    const trigger = $("#systemAdminTrigger");
    const form = $("#adminLoginForm");
    const usernameInput = $("#adminUsername");
    const passwordInput = $("#adminPassword");
    const loginButton = $("#adminLoginButton");
    const errorBox = $("#adminError");
    const errorMessage = $("#adminErrorMessage");
    const dashboard = $("#adminDashboard");

    if (!overlay || !trigger || !form) {
      console.warn("Admin panel elements are missing from index.html.");
      return;
    }

    let isAuthenticated = false;

    function showAdminError(message, scary = false) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.style.display = "block";
        errorBox.classList.toggle("admin-error", true);
        errorBox.classList.toggle("glitch-title", scary);
      }

      if (errorMessage) {
        errorMessage.textContent = message;
      } else if (errorBox) {
        errorBox.textContent = message;
      }

      overlay.classList.toggle("admin-glitch", scary);
    }

    function clearAdminError() {
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.style.display = "none";
        errorBox.classList.remove("glitch-title");
      }

      if (errorMessage) errorMessage.textContent = "";
      overlay.classList.remove("admin-glitch");
    }

    function openAdmin() {
      overlay.hidden = false;
      overlay.style.display = "grid";
      clearAdminError();

      if (dashboard) {
        dashboard.hidden = true;
        dashboard.style.display = "none";
      }

      form.hidden = false;
      form.style.display = "";

      checkAdminSession();

      window.setTimeout(() => {
        if (usernameInput) usernameInput.focus();
      }, 50);
    }

    function closeAdmin() {
      overlay.hidden = true;
      overlay.style.display = "none";
      clearAdminError();
    }

    async function checkAdminSession() {
      try {
        const result = await apiRequest("/api/admin/me");

        if (result.authenticated) {
          isAuthenticated = true;
          showAdminDashboard();
          await loadAdminData();
        }
      } catch (error) {
        console.warn("Could not check admin session:", error.message);
      }
    }

    function showAdminDashboard() {
      clearAdminError();

      if (dashboard) {
        dashboard.hidden = false;
        dashboard.style.display = "block";
      }

      form.hidden = true;
      form.style.display = "none";
    }

    function renderAdminList(container, items, formatter) {
      if (!container) return;

      container.replaceChildren();

      if (!items || !items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "NO RECORDS";
        container.appendChild(empty);
        return;
      }

      items.slice(0, 100).forEach((item) => {
        const row = document.createElement("div");
        row.className = "admin-log-row";
        row.style.padding = "8px 0";
        row.style.borderBottom = "1px solid #26151e";
        row.style.whiteSpace = "pre-wrap";
        row.textContent = formatter(item);
        container.appendChild(row);
      });
    }

    async function loadAdminData() {
      if (!isAuthenticated) return;

      try {
        const [visits, events] = await Promise.all([
          apiRequest("/api/admin/visits"),
          apiRequest("/api/admin/events")
        ]);

        const visitCount = $("#adminVisitCount");
        const eventCount = $("#adminEventCount");

        if (visitCount) visitCount.textContent = String(visits.length);
        if (eventCount) eventCount.textContent = String(events.length);

        renderAdminList($("#adminVisits"), visits, (visit) => {
          return [
            `TIME: ${formatDate(visit.time)}`,
            `IP: ${visit.ip || "Not recorded"}`,
            `PATH: ${visit.path || "/"}`,
            `USER AGENT: ${visit.user_agent || "Not recorded"}`
          ].join("\n");
        });

        renderAdminList($("#adminEvents"), events, (event) => {
          return [
            `TIME: ${formatDate(event.time)}`,
            `TYPE: ${event.type || "EVENT"}`,
            `MESSAGE: ${event.message || ""}`
          ].join("\n");
        });
      } catch (error) {
        if (error.status === 401) {
          isAuthenticated = false;
          showAdminError("SESSION EXPIRED. PLEASE SIGN IN AGAIN.");
          if (dashboard) {
            dashboard.hidden = true;
            dashboard.style.display = "none";
          }
          form.hidden = false;
          form.style.display = "";
          return;
        }

        showNotice("ADMIN DATA COULD NOT BE LOADED");
        console.error("Admin data request failed:", error.message);
      }
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openAdmin();
    });

    const closeButton =
      $("#adminClose") ||
      $("[data-admin-close]");

    if (closeButton) {
      closeButton.addEventListener("click", closeAdmin);
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeAdmin();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) {
        closeAdmin();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAdminError();

      const username = usernameInput?.value.trim() || "";
      const password = passwordInput?.value || "";

      if (!username || !password) {
        showAdminError("ENTER BOTH USERNAME AND PASSWORD.");
        return;
      }

      if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "VERIFYING...";
      }

      try {
        await apiRequest("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });

        isAuthenticated = true;

        if (passwordInput) passwordInput.value = "";

        addLocalEvent("ADMIN", "Administrator signed in");
        showAdminDashboard();
        await loadAdminData();
      } catch (error) {
        if (error.status === 401) {
          showAdminError(
            "ХА-ХА-ХА... ТЫ ПОПАЛСЯ, МАЛЕНЬКИЙ ЖУЛИК. ДОСТУП ЗАПРЕЩЁН.",
            true
          );
        } else if (error.status === 429) {
          showAdminError(
            "TOO MANY ATTEMPTS. ACCESS TEMPORARILY LOCKED.",
            true
          );
        } else if (error.status === 503) {
          showAdminError(
            "ADMIN NOT CONFIGURED. CHECK VERCEL ENVIRONMENT VARIABLES."
          );
        } else {
          showAdminError(
            "SERVER CONNECTION FAILED. TRY AGAIN LATER."
          );
        }

        if (passwordInput) {
          passwordInput.value = "";
          passwordInput.focus();
        }
      } finally {
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.textContent = "AUTHENTICATE";
        }
      }
    });

    const refreshAdminButton = $("#adminRefresh");

    if (refreshAdminButton) {
      refreshAdminButton.addEventListener("click", loadAdminData);
    }

    const logoutButton = $("#adminLogout");

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await apiRequest("/api/admin/logout", { method: "POST" });
        } catch (error) {
          console.warn("Logout request failed:", error.message);
        }

        isAuthenticated = false;

        if (dashboard) {
          dashboard.hidden = true;
          dashboard.style.display = "none";
        }

        form.hidden = false;
        form.style.display = "";
        clearAdminError();
        showNotice("ADMIN SESSION CLOSED");
      });
    }

    closeAdmin();
  }

  function setupProtocolDefaults() {
    const content =
      $("#protocolContent") ||
      $("#revealContent") ||
      $(".reveal-content");

    if (content) {
      content.hidden = true;
      content.style.display = "none";
    }
  }

  async function init() {
    updateClock();
    window.setInterval(updateClock, 1000);

    renderEvents();
    renderModules();
    setupTerminal();
    setupDashboardButtons();
    setupAdminPanel();
    setupProtocolDefaults();

    await refreshModules();

    try {
      await refreshHealth();
    } catch {
      // Keep the dashboard usable if the API is temporarily unavailable.
    }

    console.info("DARK.exe interface initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
