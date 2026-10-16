function setupDashboardButtons() {
  $$("[data-module]").forEach((card) => {
    const name = card.dataset.module;
    const button = $(".toggle-button", card);

    if (!button || !name) return;

    button.addEventListener("click", () => {
      if (name === "specter" || name === "archive") return;
      toggleModule(name);
    });
  });

  const scanButton = $("#scanBtn") || $("#scanButton") || $("[data-action='scan']");
  if (scanButton) {
    scanButton.addEventListener("click", async () => {
      addLocalEvent("SCAN", "Diagnostic scan requested");
      await runTerminalCommand("scan");
    });
  }

  const signalButton = $("#signalBtn");
  if (signalButton) {
    signalButton.addEventListener("click", () => {
      addLocalEvent("SIGNAL", "Signal initiated");
      const stateText = $("#heroState");
      const coreState = $("#coreVisualState");
      if (stateText) stateText.textContent = "SIGNAL ACTIVE";
      if (coreState) coreState.textContent = "SIGNAL TRANSMITTING";
      showNotice("SIGNAL INITIATED");
    });
  }

  const refreshButton =
    $("#refreshBtn") || $("#refreshButton") ||
    $("#refreshStatus") || $("[data-action='refresh']");

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await refreshModules();
      try {
        await refreshHealth();
        addLocalEvent("REFRESH", "System status refreshed");
        showNotice("SYSTEM STATUS REFRESHED");
      } catch {
        showNotice("API UNAVAILABLE — LOCAL VIEW READY");
      }
    });
  }

  const diagnosticButton = $("#diagnosticBtn");
  if (diagnosticButton) {
    diagnosticButton.addEventListener("click", async () => {
      addLocalEvent("DIAGNOSTIC", "Full diagnostic requested");
      await runTerminalCommand("scan");
      showNotice("DIAGNOSTIC COMPLETE");
    });
  }

  const clearButton =
    $("#clearEventsBtn") || $("#clearEventsButton") ||
    $("[data-action='clear-events']");

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      state.events = [];
      renderEvents();
      showNotice("LOCAL EVENT VIEW CLEARED");
    });
  }

  const protocolButton = $("#protocolBtn") || $("#protocolButton") ||
    $("#revealProtocol") || $("[data-action='protocol']");

  if (protocolButton) {
    protocolButton.addEventListener("click", () => {
      const content = $("#revealContent") || $("#protocolContent") ||
        $(".reveal-content");

      if (!content) return;

      content.hidden = !content.hidden;
      content.style.display = content.hidden ? "none" : "block";

      if (!content.hidden) {
        addLocalEvent("PROTOCOL", "Protocol panel opened");
      }
    });
  }

  const revealButton = $("#revealBtn");
  if (revealButton) {
    revealButton.addEventListener("click", () => {
      const content = $("#revealContent");
      if (!content) return;

      content.hidden = !content.hidden;
      content.style.display = content.hidden ? "none" : "block";
      revealButton.textContent = content.hidden
        ? "РАСШИФРОВАТЬ ФРАГМЕНТ ↗"
        : "СКРЫТЬ ФРАГМЕНТ";

      if (!content.hidden) {
        addLocalEvent("PROTOCOL", "Fragment revealed");
      }
    });
  }

  const archiveButton = $("#archiveBtn");
  if (archiveButton) {
    archiveButton.addEventListener("click", () => {
      $("#archiveSection")?.scrollIntoView({ behavior: "smooth" });
      addLocalEvent("ARCHIVE", "Archive opened");
    });
  }

  const viewArchiveButton = $("#viewArchiveBtn");
  if (viewArchiveButton) {
    viewArchiveButton.addEventListener("click", () => {
      $("#eventsSection")?.scrollIntoView({ behavior: "smooth" });
      showNotice("SESSION EVENTS");
    });
  }

  const specterButton = $("#specterBtn");
  if (specterButton) {
    specterButton.addEventListener("click", async () => {
      addLocalEvent("SPECTER", "Scan started");
      await runTerminalCommand("scan");
    });
  }
}
