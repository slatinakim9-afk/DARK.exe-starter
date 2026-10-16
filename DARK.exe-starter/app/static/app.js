const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const $ = (id) => document.getElementById(id);

const MODULES = {
  ghost_mode: {
    name: "GHOST MODE",
    description: "Режим скрытого отображения интерфейса",
  },
  auto_reply: {
    name: "AUTO REPLY",
    description: "Автоответчик — требует подключения к источнику сообщений",
  },
};

let refreshing = false;

function addEvent(type, detail, time = new Date()) {
  const container = $("events");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "event";

  const t = document.createElement("time");
  t.textContent = time.toLocaleTimeString("ru-RU", {
    hour12: false,
  });

  const label = document.createElement("b");
  label.className = "red";
  label.textContent = `[${String(type).slice(0, 24)}] `;

  const msg = document.createElement("span");
  msg.textContent = String(detail).slice(0, 180);

  row.append(t, label, msg);
  container.prepend(row);

  while (container.children.length > 8) {
    container.lastElementChild.remove();
  }
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;

  try {
    const [health, rows] = await Promise.all([
      fetchJSON("/api/health"),
      fetchJSON("/api/events"),
    ]);

    if ($("statusText")) {
      $("statusText").textContent =
        health.status === "online"
          ? "СИСТЕМА ОНЛАЙН"
          : "СИСТЕМА НЕАКТИВНА";
    }

    if ($("core")) {
      $("core").textContent =
        health.status === "online" ? "ONLINE" : "OFFLINE";
    }

    if ($("coreStatus")) {
      $("coreStatus").textContent =
        health.status === "online" ? "STABLE" : "OFFLINE";
    }

    if ($("events")) {
      $("events").replaceChildren();

      rows.forEach((event) => {
        addEvent(
          event.type,
          event.detail,
          event.created_at ? new Date(event.created_at) : new Date()
        );
      });

      if (!rows.length) {
        addEvent("BOOT", "Ядро запущено. Ожидание сигнала.");
      }
    }

    await refreshModules();
  } catch {
    if ($("statusText")) $("statusText").textContent = "СВЯЗЬ ПОТЕРЯНА";
    if ($("core")) $("core").textContent = "ERROR";
    if ($("coreStatus")) $("coreStatus").textContent = "OFFLINE";
  } finally {
    refreshing = false;
  }
}

async function refreshModules() {
  try {
    const modules = await fetchJSON("/api/modules");

    Object.entries(modules).forEach(([key, module]) => {
      const statusElement = $(`${key}Status`);
      const button = $(`${key}Btn`);

      if (statusElement) {
        statusElement.textContent = module.enabled ? "ACTIVE" : "STANDBY";
        statusElement.dataset.status = module.enabled ? "active" : "standby";
      }

      if (button) {
        button.textContent = module.enabled ? "DEACTIVATE" : "ACTIVATE";
        button.dataset.enabled = String(module.enabled);
        button.disabled = false;
      }
    });
  } catch {
    // Панель продолжает работать, даже если API модулей недоступно.
  }
}

async function sendSignal() {
  const button = $("signalBtn");
  if (!button || button.disabled) return;

  button.disabled = true;

  if ($("notice")) {
    $("notice").textContent = "ОТПРАВКА СИГНАЛА...";
  }

  try {
    await fetchJSON("/api/events/demo", {
      method: "POST",
    });

    if ($("notice")) {
      $("notice").textContent = "СИГНАЛ ПРИНЯТ. ЗАПИСЬ ДОБАВЛЕНА.";
    }

    await refresh();

    tg?.HapticFeedback?.impactOccurred("medium");
  } catch {
    if ($("notice")) {
      $("notice").textContent = "ОШИБКА: СИГНАЛ НЕ ДОСТАВЛЕН.";
    }
  } finally {
    button.disabled = false;
  }
}

async function toggleModule(moduleName) {
  const module = MODULES[moduleName];
  if (!module) return;

  const button = $(`${moduleName}Btn`);
  if (button?.disabled) return;

  if (button) button.disabled = true;

  try {
    const result = await fetchJSON(
      `/api/modules/${encodeURIComponent(moduleName)}/toggle`,
      { method: "POST" }
    );

    if ($("notice")) {
      $("notice").textContent = result.enabled
        ? `${module.name}: АКТИВИРОВАН`
        : `${module.name}: ДЕАКТИВИРОВАН`;
    }

    await refreshModules();
    await refresh();

    tg?.HapticFeedback?.impactOccurred("light");
  } catch {
    if ($("notice")) {
      $("notice").textContent = `ОШИБКА: НЕ УДАЛОСЬ ИЗМЕНИТЬ ${module.name}.`;
    }
  } finally {
    if (button) button.disabled = false;
  }
}

if ($("signalBtn")) {
  $("signalBtn").addEventListener("click", sendSignal);
}

Object.keys(MODULES).forEach((key) => {
  const button = $(`${key}Btn`);
  if (button) {
    button.addEventListener("click", () => toggleModule(key));
  }
});

refresh();
setInterval(refresh, 15000);
