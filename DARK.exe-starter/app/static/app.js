(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const statusText = $("#statusText");
  const coreStatus = $("#coreStatus");
  const eventsContainer = $("#events");
  const eventCount = $("#eventCount");
  const eventTimestamp = $("#eventTimestamp");
  const activeModules = $("#activeModules");
  const signalBtn = $("#signalBtn");
  const notice = $("#notice");

  const moduleNames = {
    ghost_mode: "GHOST MODE",
    auto_reply: "AUTO REPLY",
  };

  const moduleStates = {
    ghost_mode: false,
    auto_reply: false,
  };

  let noticeTimeout;
  let busy = false;

  const telegram = window.Telegram?.WebApp;

  if (telegram) {
    telegram.ready();
    telegram.expand();

    try {
      telegram.setHeaderColor("#080608");
      telegram.setBackgroundColor("#080608");
    } catch (_) {
      // Older Telegram clients may not support these methods.
    }
  }

  function showNotice(message) {
    if (!notice) return;

    notice.textContent = message;
    notice.classList.add("show");

    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      notice.classList.remove("show");
    }, 3000);
  }

  function haptic(style = "light") {
    try {
      telegram?.HapticFeedback?.impactOccurred(style);
    } catch (_) {
      // Haptics are optional.
    }
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function setConnection(online) {
    if (statusText) {
      statusText.textContent = online ? "SYSTEM ONLINE" : "CONNECTION LOST";
    }

    if (coreStatus) {
      coreStatus.textContent = online ? "OPERATIONAL" : "OFFLINE";
      coreStatus.style.color = online ? "var(--green)" : "var(--red)";
    }
  }

  function formatTime(value) {
    if (!value) return "--:--:--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "--:--:--";

    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character];
    });
  }

  function renderEvents(events) {
    if (!eventsContainer) return;

    if (!Array.isArray(events) || events.length === 0) {
      eventsContainer.innerHTML =
        '<div class="empty-state">СОБЫТИЙ ПОКА НЕТ</div>';

      if (eventCount) eventCount.textContent = "000";
      if (eventTimestamp) eventTimestamp.textContent = "NO RECENT ACTIVITY";

      return;
    }

    eventsContainer.innerHTML = events
      .slice(0, 8)
      .map((event) => {
        const type = escapeHTML(event.type || "SYSTEM");
        const detail = escapeHTML(event.detail || "Системное событие");
        const time = escapeHTML(formatTime(event.created_at));

        return `
          <article class="event-row">
            <span class="event-type">${type}</span>
            <span class="event-detail">${detail}</span>
            <time class="event-time">${time}</time>
          </article>
        `;
      })
      .join("");

    if (eventCount) {
      eventCount.textContent = String(events.length).padStart(3, "0");
    }

    if (eventTimestamp) {
      eventTimestamp.textContent = `UPDATED ${formatTime(
        events[0]?.created_at
      )}`;
    }
  }

  function renderModules(modules) {
    let enabledCount = 0;

    for (const [key, name] of Object.entries(moduleNames)) {
      const moduleData = modules?.[key];
      const enabled =
        typeof moduleData === "boolean"
          ? moduleData
          : Boolean(moduleData?.enabled);

      moduleStates[key] = enabled;

      if (enabled) enabledCount++;

      const status = $(`#${key}Status`);
      const button = $(`#${key}Btn`);

      if (status) {
        status.textContent = enabled ? "ACTIVE" : "STANDBY";
        status.classList.toggle("active", enabled);
      }

      if (button) {
        button.classList.toggle("active", enabled);
        button.setAttribute("aria-pressed", String(enabled));
        button.innerHTML = enabled
          ? 'ДЕАКТИВИРОВАТЬ <span>↘</span>'
          : 'АКТИВИРОВАТЬ <span>↗</span>';
      }
    }

    if (activeModules) {
      activeModules.innerHTML = `${String(enabledCount).padStart(
        2,
        "0"
      )} <small>/ 02</small>`;
    }
  }

  async function refreshHealth() {
    try {
      await request("/api/health");
      setConnection(true);
    } catch (error) {
      setConnection(false);
      console.error("DARK.exe health check failed:", error);
    }
  }

  async function refreshEvents() {
    try {
      const events = await request("/api/events");
      renderEvents(events);
    } catch (error) {
      console.error("DARK.exe event refresh failed:", error);

      if (eventsContainer && !eventsContainer.children.length) {
        eventsContainer.innerHTML =
          '<div class="empty-state">ЖУРНАЛ НЕДОСТУПЕН</div>';
      }
    }
  }

  async function refreshModules() {
    try {
      const modules = await request("/api/modules");
      renderModules(modules);
    } catch (error) {
      // A deployment without module endpoints remains usable.
      console.warn("Module API is unavailable:", error);
      renderModules(moduleStates);
    }
  }

  async function toggleModule(key) {
    if (busy) return;

    busy = true;

    const button = $(`#${key}Btn`);

    if (button) button.disabled = true;

    try {
      const result = await request(`/api/modules/${key}/toggle`, {
        method: "POST",
      });

      if (typeof result.enabled === "boolean") {
        moduleStates[key] = result.enabled;
      }

      renderModules(moduleStates);
      haptic("medium");

      showNotice(
        `${moduleNames[key]}: ${moduleStates[key] ? "ACTIVE" : "STANDBY"}`
      );

      await refreshEvents();
    } catch (error) {
      console.error("Module toggle failed:", error);
      showNotice("Не удалось переключить модуль. Проверь API.");
    } finally {
      busy = false;

      if (button) button.disabled = false;
    }
  }

  async function sendSignal() {
    if (busy) return;

    busy = true;

    if (signalBtn) signalBtn.disabled = true;

    try {
      await request("/api/events/demo", {
        method: "POST",
      });

      haptic("medium");
      showNotice("Сигнал успешно отправлен.");
      await refreshEvents();
    } catch (error) {
      console.error("Signal request failed:", error);
      showNotice("Ошибка отправки сигнала. Проверь подключение.");
    } finally {
      busy = false;

      if (signalBtn) signalBtn.disabled = false;
    }
  }

  for (const key of Object.keys(moduleNames)) {
    const button = $(`#${key}Btn`);

    if (button) {
      button.addEventListener("click", () => toggleModule(key));
    }
  }

  if (signalBtn) {
    signalBtn.addEventListener("click", sendSignal);
  }

  async function initialize() {
    await Promise.all([
      refreshHealth(),
      refreshEvents(),
      refreshModules(),
    ]);
  }

  initialize();

  window.setInterval(refreshHealth, 15000);
  window.setInterval(refreshEvents, 15000);
})();
