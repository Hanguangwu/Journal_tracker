(function () {
  "use strict";

  const STATE = {
    venues: [],
    config: null,
    translations: {},
    currentLang: "en",
    currentTheme: "light",
    savedVenues: [],
    countdownTimer: null,
    disciplines: {},
    priorityLevels: {},
    deadlineTypes: {},
  };

  async function loadData() {
    try {
      const [configRes, enRes, zhRes, csRes, ecoRes, histRes, finRes] = await Promise.all([
        fetch("data/config.json"),
        fetch("i18n/en.json"),
        fetch("i18n/zh.json"),
        fetch("data/cs-ai-conferences.json"),
        fetch("data/economics-journals.json"),
        fetch("data/history-journals.json"),
        fetch("data/finance-journals.json"),
      ]);

      STATE.config = await configRes.json();
      STATE.translations.en = await enRes.json();
      STATE.translations.zh = await zhRes.json();
      STATE.disciplines = STATE.config.disciplines;
      STATE.priorityLevels = STATE.config.priorityLevels;
      STATE.deadlineTypes = STATE.config.deadlineTypes;

      const csData = await csRes.json();
      const ecoData = await ecoRes.json();
      const histData = await histRes.json();
      const finData = await finRes.json();
      STATE.venues = [...csData, ...ecoData, ...histData, ...finData];

      const savedTheme = localStorage.getItem("jt_theme");
      if (savedTheme === "light" || savedTheme === "dark") STATE.currentTheme = savedTheme;
      const savedLang = localStorage.getItem("jt_lang");
      if (savedLang === "en" || savedLang === "zh") STATE.currentLang = savedLang;
      const saved = localStorage.getItem("jt_saved");
      if (saved) {
        try { STATE.savedVenues = JSON.parse(saved); } catch (e) { STATE.savedVenues = []; }
      }

      applyTheme(STATE.currentTheme);
      applyLanguage(STATE.currentLang);
      return true;
    } catch (error) {
      console.error("Failed to load data:", error);
      showError("Failed to load venue data. Please check your connection and try again.");
      return false;
    }
  }

  function applyLanguage(lang) {
    const t = STATE.translations[lang] || STATE.translations.en;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = getNestedValue(t, key);
      if (value) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.value = value;
        } else {
          el.textContent = value;
        }
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const value = getNestedValue(t, key);
      if (value) el.placeholder = value;
    });

    STATE.currentLang = lang;
    const langLabel = document.getElementById("langLabel");
    if (langLabel) langLabel.textContent = lang === "en" ? "EN" : "中";

    refreshTranslations();
  }

  function getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const themeIcon = document.getElementById("themeIcon");
    if (themeIcon) {
      themeIcon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
    }
    STATE.currentTheme = theme;
  }

  function toggleTheme() {
    const newTheme = STATE.currentTheme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem("jt_theme", newTheme);
  }

  function toggleLanguage() {
    const newLang = STATE.currentLang === "en" ? "zh" : "en";
    applyLanguage(newLang);
    localStorage.setItem("jt_lang", newLang);
  }

  function parseDeadlineDate(deadline) {
    if (deadline.date instanceof Date) return deadline.date;
    let timeStr = deadline.time || "";
    let dateStr = deadline.date;

    if (timeStr && /^\d{4}-\d{2}-\d{2}/.test(timeStr)) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) return d;
    }
    if (dateStr && typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    if (dateStr && typeof dateStr === "string" && /^\d{4}-\d{2}/.test(dateStr)) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  function formatDate(date, lang) {
    if (!date || isNaN(date.getTime())) return "—";
    const locale = lang === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function formatDateTime(date, lang, time) {
    if (!date || isNaN(date.getTime())) return "—";
    const locale = lang === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }

  function getDeadlineStatus(deadline) {
    const date = parseDeadlineDate(deadline);
    if (!date) return "unknown";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dlDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (dlDate < today) return "passed";
    if (dlDate.getTime() === today.getTime()) return "today";
    if (dlDate.getTime() === today.getTime() + 86400000) return "tomorrow";
    return "upcoming";
  }

  function getDeadlineCountdown(deadline) {
    const date = parseDeadlineDate(deadline);
    if (!date) return null;
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
  }

  function getAllDeadlines() {
    const deadlines = [];
    STATE.venues.forEach((venue) => {
      if (!venue.deadlines) return;
      venue.deadlines.forEach((dl) => {
        const date = parseDeadlineDate(dl);
        if (!date) return;
        deadlines.push({ ...dl, venueId: venue.id, venueName: venue.shortName || venue.name, venue, date });
      });
    });
    deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
    return deadlines;
  }

  function getUpcomingDeadlines(daysAhead = 90) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 86400000);
    return getAllDeadlines().filter((dl) => dl.date >= now && dl.date <= cutoff);
  }

  function getCriticalDeadlines(limit = 6) {
    return getAllDeadlines()
      .filter((dl) => dl.priority === "critical" && dl.date >= new Date())
      .slice(0, limit);
  }

  function getVenueNextDeadline(venue) {
    if (!venue.deadlines) return null;
    const deadlines = venue.deadlines
      .map((dl) => ({ ...dl, date: parseDeadlineDate(dl) }))
      .filter((dl) => dl.date && dl.date >= new Date());
    if (deadlines.length === 0) return null;
    deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
    return deadlines[0];
  }

  /* ==================== Routing ==================== */

  function initRouter() {
    window.addEventListener("hashchange", handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const hash = window.location.hash || "#/";
    let view = "dashboard";
    const parts = hash.split("?")[0].substring(1);

    if (parts === "/" || parts === "") view = "dashboard";
    else if (parts === "/venues" || parts === "/journals") view = "venues";
    else if (parts === "/venue") view = "venue";
    else if (parts === "/timeline") view = "timeline";
    else if (parts === "/saved") view = "saved";
    else if (parts === "/about") view = "about";

    document.body.setAttribute("data-view", view);

    const viewSections = ["dashboardContent", "venuesContent", "venueContent", "timelineContent", "aboutContent", "savedContent"];
    viewSections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });

    switch (view) {
      case "dashboard": renderDashboard(); break;
      case "venues": renderVenuesPage(); break;
      case "venue": renderVenueDetail(); break;
      case "timeline": renderTimelinePage(); break;
      case "saved": renderSavedPage(); break;
      case "about": renderAboutPage(); break;
    }
  }

  /* ==================== Dashboard ==================== */

  function renderDashboard() {
    const t = STATE.translations[STATE.currentLang];
    const lastUpdatedEl = document.getElementById("lastUpdatedDate");
    if (lastUpdatedEl) lastUpdatedEl.textContent = STATE.config.lastUpdated || "—";

    renderCountdownBanner();
    renderCriticalDeadlines();
    renderUpcomingTimeline();
    renderDisciplineCards();

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("dashboardContent").classList.remove("hidden");
    startCountdownTimer();
  }

  function renderCountdownBanner() {
    const criticalDeadlines = getCriticalDeadlines(1);
    const banner = document.getElementById("nextDeadlineName");
    const timer = document.getElementById("countdownTimer");
    const dateEl = document.getElementById("countdownDate");
    const venueEl = document.getElementById("countdownVenue");
    const t = STATE.translations[STATE.currentLang];

    if (criticalDeadlines.length === 0) {
      if (banner) banner.textContent = t.dashboard?.noCriticalDeadlines || "All caught up!";
      if (timer) timer.innerHTML = '<span class="text-2xl">✓</span>';
      if (dateEl) dateEl.textContent = "";
      if (venueEl) venueEl.textContent = "";
      return;
    }

    const dl = criticalDeadlines[0];
    const venue = dl.venue;
    if (banner) {
      const typeConfig = STATE.deadlineTypes[dl.type] || {};
      banner.textContent = typeConfig.text || dl.type;
    }
    if (timer) {
      timer.innerHTML = formatCountdownHTML(dl);
    }
    if (dateEl) dateEl.textContent = formatDate(dl.date, STATE.currentLang);
    if (venueEl) venueEl.textContent = venue.shortName || venue.name;
  }

  function formatCountdownHTML(deadline) {
    const cd = getDeadlineCountdown(deadline);
    if (!cd) return '<span class="text-red-300 font-bold">Deadline passed</span>';
    return `<span>${cd.days.toString().padStart(2, "0")}</span> : <span>${cd.hours.toString().padStart(2, "0")}</span> : <span>${cd.minutes.toString().padStart(2, "0")}</span>`;
  }

  function renderCriticalDeadlines() {
    const grid = document.getElementById("criticalDeadlinesGrid");
    const noCritical = document.getElementById("noCriticalDeadlines");
    const criticalDeadlines = getCriticalDeadlines(6);

    if (!grid) return;
    if (criticalDeadlines.length === 0) {
      grid.innerHTML = "";
      if (noCritical) noCritical.classList.remove("hidden");
      return;
    }
    if (noCritical) noCritical.classList.add("hidden");

    grid.innerHTML = criticalDeadlines
      .map((dl) => {
        const venue = dl.venue;
        const cd = getDeadlineCountdown(dl);
        const priorityConfig = STATE.priorityLevels[dl.priority] || STATE.priorityLevels.normal;
        const typeConfig = STATE.deadlineTypes[dl.type] || { icon: "📅", text: dl.type };

        const countdownText = cd
          ? `<span class="font-bold text-2xl text-red-600 dark:text-red-400">${cd.days}d ${cd.hours}h</span>`
          : '<span class="text-red-500 font-bold">Passed</span>';

        return `
          <div class="deadline-card bg-red-50 dark:bg-red-900/10 border-red-500 rounded-xl shadow p-4 cursor-pointer hover:shadow-lg transition"
               data-priority="${dl.priority}" data-discipline="${venue.discipline}"
               onclick="window.location.hash='#/venue?id=${venue.id}'">
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${typeConfig.icon}</span>
                <span class="font-bold text-lg">${typeConfig.text || ""}</span>
              </div>
              <span class="priority-${dl.priority} text-xs px-2 py-1 rounded-full">${priorityConfig.text || ""}</span>
            </div>
            <div class="mb-2">
              <h3 class="font-bold text-lg">${venue.shortName || venue.name}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-300">${STATE.disciplines[venue.discipline]?.name || venue.discipline}</p>
            </div>
            <div class="flex justify-between items-center mb-2">
              ${countdownText}
              <span class="text-sm text-gray-500 dark:text-gray-400">${formatDate(dl.date, STATE.currentLang)}</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">${dl.description || ""}</p>
          </div>
        `;
      })
      .join("");
  }

  function renderUpcomingTimeline() {
    const timeline = document.getElementById("upcomingTimeline");
    const noUpcoming = document.getElementById("noUpcomingDeadlines");
    const countText = document.getElementById("deadlineCountText");
    const upcoming = getUpcomingDeadlines(90);

    if (!timeline) return;

    if (countText) {
      const t = STATE.translations[STATE.currentLang];
      countText.innerHTML = `<span id="upcomingCount">${upcoming.length}</span> <span data-i18n="dashboard.deadlineCount">${t.dashboard.deadlineCount}</span>`;
    }

    if (upcoming.length === 0) {
      timeline.innerHTML = "";
      if (noUpcoming) noUpcoming.classList.remove("hidden");
      return;
    }
    if (noUpcoming) noUpcoming.classList.add("hidden");

    timeline.innerHTML = upcoming
      .slice(0, 15)
      .map((dl) => {
        const venue = dl.venue;
        const cd = getDeadlineCountdown(dl);
        const t = STATE.translations[STATE.currentLang];
        const typeConfig = STATE.deadlineTypes[dl.type] || { icon: "📅", text: dl.type };
        const priorityConfig = STATE.priorityLevels[dl.priority] || STATE.priorityLevels.normal;
        const status = getDeadlineStatus(dl);

        const countdownLabel = cd ? `${cd.days}d ${cd.hours}h` : (t.status.passed || "Passed");
        let bgClass = "bg-white dark:bg-gray-800";
        if (status === "today") bgClass = "bg-red-50 dark:bg-red-900/20";
        else if (cd && cd.days <= 7) bgClass = "bg-orange-50 dark:bg-orange-900/20";

        return `
          <div class="timeline-item ${status === "passed" ? "status-passed" : ""} ${status === "today" ? "status-today" : ""}"
               data-priority="${dl.priority}" data-discipline="${venue.discipline}">
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl">${typeConfig.icon}</div>
              <div class="flex-1 ${bgClass} rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <strong class="text-lg">${venue.shortName || venue.name}</strong>
                    <div class="flex gap-1 mt-1">
                      <span class="discipline-badge discipline-${venue.discipline}">${STATE.disciplines[venue.discipline]?.name || venue.discipline}</span>
                      <span class="priority-${dl.priority} text-xs px-1 py-0.5 rounded-full">${priorityConfig.text}</span>
                    </div>
                  </div>
                  <span class="font-bold text-red-600 dark:text-red-400" data-countdown-live="true" data-venue-id="${venue.id}">${cd ? `${cd.days}d ${cd.hours}h` : countdownLabel}</span>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  ${typeConfig.text} · ${formatDate(dl.date, STATE.currentLang)}
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">${dl.description || ""}</p>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderDisciplineCards() {
    const container = document.getElementById("disciplineCards");
    if (!container) return;

    const disciplines = STATE.config.disciplines;

    container.innerHTML = Object.entries(disciplines)
      .map(([key, disc]) => {
        const venuesInDisc = STATE.venues.filter((v) => v.discipline === key);
        const upcomingInDisc = getUpcomingDeadlines(90).filter((d) => d.venue.discipline === key);
        const criticalCount = upcomingInDisc.filter((d) => d.priority === "critical").length;

        return `
          <a href="#/venues?discipline=${key}" class="discipline-card bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg transition text-center group">
            <div class="${disc.color} w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
              ${disc.name ? disc.name[0] : ""}
            </div>
            <h3 class="font-bold text-lg mb-1">${disc.name}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300">${venuesInDisc.length} ${venuesInDisc.length === 1 ? "venue" : "venues"}</p>
            <span class="text-xs mt-1 inline-block ${criticalCount > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"} px-2 py-1 rounded-full">
              ${criticalCount > 0 ? `${criticalCount} critical` : `${upcomingInDisc.length} upcoming`}
            </span>
          </a>
        `;
      })
      .join("");
  }

  /* ==================== Countdown Timer ==================== */

  function startCountdownTimer() {
    updateAllCountdownDisplays();
    if (STATE.countdownTimer) clearInterval(STATE.countdownTimer);
    STATE.countdownTimer = setInterval(updateAllCountdownDisplays, 60000);
  }

  function updateAllCountdownDisplays() {
    updateCountdownBanner();
    updateCountdownElements();
  }

  function updateCountdownBanner() {
    const critical = getCriticalDeadlines(1);
    if (critical.length === 0) return;
    const cd = getDeadlineCountdown(critical[0]);
    const timer = document.getElementById("countdownTimer");
    if (timer && cd) {
      timer.innerHTML = `<span>${cd.days.toString().padStart(2, "0")}</span> : <span>${cd.hours.toString().padStart(2, "0")}</span> : <span>${cd.minutes.toString().padStart(2, "0")}</span>`;
    }
  }

  function updateCountdownElements() {
    const t = STATE.translations[STATE.currentLang];
    document.querySelectorAll("[data-countdown-live='true']").forEach((el) => {
      const venueId = el.getAttribute("data-venue-id");
      const venue = STATE.venues.find((v) => v.id === venueId);
      if (!venue) return;
      const nextDl = getVenueNextDeadline(venue);
      if (!nextDl) {
        el.textContent = t.status.passed || "Passed";
        return;
      }
      const cd = getDeadlineCountdown(nextDl);
      if (!cd) {
        el.innerHTML = `<span class="text-red-500 font-bold">${t.status.passed || "Passed"}</span>`;
        return;
      }
      el.innerHTML = `<span class="font-bold text-red-600 dark:text-red-400">${cd.days}d ${cd.hours}h</span>`;
    });

    const critical = getCriticalDeadlines(6);
    critical.forEach((dl) => {
      document.querySelectorAll(".deadline-card").forEach((card) => {
        const venueId = card.getAttribute("data-venue") || "";
        if (card.dataset && card.dataset.priority === dl.priority && card.dataset.discipline === dl.venue.discipline) {
          const cd = getDeadlineCountdown(dl);
          const countdownEl = card.querySelector(".text-2xl.font-bold");
          if (countdownEl && cd) {
            countdownEl.innerHTML = `<span class="font-bold text-2xl text-red-600 dark:text-red-400">${cd.days}d ${cd.hours}h</span>`;
          }
        }
      });
    });
  }

  function refreshTranslations() {
    const t = STATE.translations[STATE.currentLang];
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = getNestedValue(t, key);
      if (value) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.value = value;
        } else {
          el.textContent = value;
        }
      }
    });
  }

  /* ==================== Venues Page ==================== */

  function renderVenuesPage() {
    const loading = document.getElementById("loadingState");
    const content = document.getElementById("venuesContent");
    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.replace(/^[^?]*\?/, ""));
    const discFilter = urlParams.get("discipline");
    if (discFilter) {
      const discSelect = document.getElementById("disciplineFilter");
      if (discSelect) discSelect.value = discFilter;
    }

    renderVenueGrid();
    setupVenueFilters();
    setTimeout(updateCountdownElements, 100);
  }

  function setupVenueFilters() {
    const ids = ["searchInput", "disciplineFilter", "typeFilter", "priorityFilter", "sortSelect"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.removeEventListener("input", renderVenueGrid);
        el.removeEventListener("change", renderVenueGrid);
        el.addEventListener("input", renderVenueGrid);
        el.addEventListener("change", renderVenueGrid);
      }
    });
  }

  function getCurrentFilters() {
    return {
      search: (document.getElementById("searchInput")?.value || "").toLowerCase(),
      discipline: document.getElementById("disciplineFilter")?.value || "all",
      type: document.getElementById("typeFilter")?.value || "all",
      priority: document.getElementById("priorityFilter")?.value || "all",
    };
  }

  function filterAndSortVenues() {
    const f = getCurrentFilters();
    const sort = document.getElementById("sortSelect")?.value || "deadline";

    let filtered = STATE.venues.filter((venue) => {
      if (f.search) {
        const searchable = (venue.name + " " + (venue.shortName || "") + " " + JSON.stringify(venue.requirements || "")).toLowerCase();
        if (!searchable.includes(f.search)) return false;
      }
      if (f.discipline !== "all" && venue.discipline !== f.discipline) return false;
      if (f.type !== "all" && venue.type !== f.type) return false;
      if (f.priority !== "all") {
        const nextDl = getVenueNextDeadline(venue);
        if (!nextDl || nextDl.priority !== f.priority) return false;
      }
      return true;
    });

    if (sort === "deadline") {
      filtered.sort((a, b) => {
        const da = getVenueNextDeadline(a);
        const db = getVenueNextDeadline(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.date.getTime() - db.date.getTime();
      });
    } else if (sort === "name") {
      filtered.sort((a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name));
    } else if (sort === "discipline") {
      filtered.sort((a, b) => (a.discipline || "").localeCompare(b.discipline || ""));
    }

    return filtered;
  }

  function renderVenueGrid() {
    const grid = document.getElementById("venuesGrid");
    const noVenues = document.getElementById("noVenuesFound");
    const countEl = document.getElementById("resultCount");
    const filtered = filterAndSortVenues();

    if (!grid) return;
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.innerHTML = "";
      if (noVenues) noVenues.classList.remove("hidden");
      return;
    }
    if (noVenues) noVenues.classList.add("hidden");

    const t = STATE.translations[STATE.currentLang];

    grid.innerHTML = filtered
      .map((venue) => {
        const nextDl = getVenueNextDeadline(venue);
        const isSaved = STATE.savedVenues.includes(venue.id);
        const disc = STATE.disciplines[venue.discipline] || {};
        const cd = nextDl ? getDeadlineCountdown(nextDl) : null;
        const status = nextDl ? getDeadlineStatus(nextDl) : "passed";
        const priorityConfig = nextDl ? STATE.priorityLevels[nextDl.priority] : STATE.priorityLevels.normal;
        const typeConfig = STATE.deadlineTypes[nextDl?.type || ""] || { text: nextDl?.type || "" };

        let countdownHtml = "";
        if (nextDl) {
          if (cd && status !== "passed") {
            countdownHtml = `<span class="text-red-600 dark:text-red-400 font-bold" data-countdown-live="true" data-venue-id="${venue.id}">${cd.days}d ${cd.hours}h</span>`;
          } else {
            countdownHtml = `<span class="text-gray-500" data-countdown-live="true" data-venue-id="${venue.id}">${t.status.passed || "Passed"}</span>`;
          }
        } else {
          countdownHtml = `<span class="text-gray-500">${t.status.passed || "No deadlines"}</span>`;
        }

        const statusClass = status === "today" ? "status-today" : status === "passed" ? "status-passed" : "";

        return `
          <div class="venue-card ${statusClass} bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg transition relative cursor-pointer group"
               data-discipline="${venue.discipline}" data-type="${venue.type}"
               onclick="window.location.hash='#/venue?id=${venue.id}'">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="font-bold text-lg mb-1">${venue.shortName || venue.name}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300">${venue.name}</p>
              </div>
              <span class="discipline-badge discipline-${venue.discipline}">${disc.name || venue.discipline}</span>
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
              <span class="type-badge type-${venue.type}">${t.venueTypes[venue.type] || venue.type}</span>
              ${venue.ranking ? `<span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full">🏆 ${venue.ranking}</span>` : ""}
              ${venue.important ? `<span class="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded-full">⚡ ${t.priority.critical}</span>` : ""}
            </div>
            <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
              ${nextDl ? `<div class="text-sm text-gray-600 dark:text-gray-300 mb-1">${typeConfig.text} · ${formatDate(nextDl.date, STATE.currentLang)}</div>` : ""}
              <div class="flex justify-between items-center">
                ${countdownHtml}
              </div>
            </div>
            ${isSaved ? `<div class="absolute top-2 right-2"><i class="bi bi-bookmark-star-fill text-yellow-400 text-xl"></i></div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  /* ==================== Venue Detail ==================== */

  function renderVenueDetail() {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^[^?]*\?/, ""));
    const venueId = params.get("id");

    if (!venueId) {
      showError("Venue ID not found in URL.");
      return;
    }

    const venue = STATE.venues.find((v) => v.id === venueId);

    if (!venue) {
      const loading = document.getElementById("loadingState");
      const content = document.getElementById("venueContent");
      if (loading) loading.classList.remove("hidden");
      if (content) content.classList.add("hidden");
      const loadingText = document.getElementById("loadingText");
      if (loadingText) loadingText.textContent = "Venue not found";
      return;
    }

    const loading = document.getElementById("loadingState");
    const content = document.getElementById("venueContent");
    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const t = STATE.translations[STATE.currentLang];
    const disc = STATE.disciplines[venue.discipline] || {};

    const header = document.getElementById("venueHeader");
    let rankBadge = "";
    if (venue.ranking) {
      rankBadge = `<span class="type-badge type-conference ms-2">🏆 ${venue.ranking}</span>`;
    } else if (venue.requirements?.impactFactor) {
      rankBadge = `<span class="type-badge type-journal ms-2">📊 IF: ${venue.requirements.impactFactor}</span>`;
    }
    let locationInfo = "";
    if (venue.location) {
      locationInfo = `<p class="text-gray-600 dark:text-gray-300 mt-1"><i class="bi bi-geo-alt me-1"></i> ${venue.location} · ${venue.dates || ""}</p>`;
    }

    header.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between items-start gap-4">
        <div class="flex items-center gap-3 mb-4 md:mb-0">
          <div class="${disc.color} w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl">
            ${venue.type === "conference" ? "📆" : "📚"}
          </div>
          <div>
            <h1 class="text-2xl md:text-3xl font-bold">${venue.shortName || venue.name}</h1>
            <p class="text-gray-600 dark:text-gray-300 text-lg">${venue.name}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="discipline-badge discipline-${venue.discipline}">${disc.name || venue.discipline}</span>
              <span class="type-badge type-${venue.type}">${t.venueTypes[venue.type] || venue.type}</span>
              ${rankBadge}
            </div>
            ${venue.website ? `<a href="${venue.website}" target="_blank" class="text-blue-600 dark:text-blue-400 text-sm flex items-center gap-1 mt-1"><i class="bi bi-box-arrow-up-right"></i> ${t.venueDetail.website}</a>` : ""}
            ${locationInfo}
          </div>
        </div>
        <div class="flex flex-col gap-2">
          ${renderSaveButton(venue.id)}
          ${venue.submitLink ? `<a href="${venue.submitLink}" target="_blank" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition">${t.venueDetail.submit} <i class="bi bi-box-arrow-up-right"></i></a>` : ""}
        </div>
      </div>
    `;

    renderRequirements(venue);
    renderVenueDeadlines(venue);
    renderSavedVenueButton(venue);
  }

  function renderSaveButton(venueId) {
    const t = STATE.translations[STATE.currentLang];
    const isSaved = STATE.savedVenues.includes(venueId);
    return `
      <button id="saveButton" onclick="toggleSavedVenue('${venueId}')" class="px-4 py-2 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
        isSaved
          ? "bg-yellow-400 text-gray-800"
          : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
      }">
        <i class="bi ${isSaved ? "bi-bookmark-star-fill" : "bi-bookmark"}"></i>
        <span>${isSaved ? (t.venueDetail.removeFromMyDates || "Remove") : t.venueDetail.saveToMyDates}</span>
      </button>
    `;
  }

  function renderRequirements(venue) {
    const reqEl = document.getElementById("requirementsSection");
    if (!reqEl) return;
    const t = STATE.translations[STATE.currentLang];

    if (!venue.requirements) {
      reqEl.innerHTML = `<p class="text-gray-500" data-i18n="search.noResults">No requirements data available.</p>`;
      return;
    }

    const reqs = venue.requirements;
    let reqRows = "";
    if (venue.type === "conference") {
      reqRows = `
        ${reqs.format ? reqRow(t, "Format", reqs.format, "📄") : ""}
        ${reqs.paperLength ? reqRow(t, "Paper Length", reqs.paperLength, "📏") : ""}
        ${reqs.anonymization ? reqRow(t, "Anonymization", reqs.anonymization, "🎭") : ""}
        ${reqs.supplemental ? reqRow(t, "Supplemental", reqs.supplemental, "📎") : ""}
        ${reqs.dualSubmission !== undefined ? reqRow(t, "Dual Submission", reqs.dualSubmission ? "Not allowed" : "Check policy", "🔗") : ""}
        ${reqs.abstractRequired !== undefined ? reqRow(t, "Abstract Required", reqs.abstractRequired ? "Yes" : "No", "📝") : ""}
        ${reqs.openReview !== undefined ? reqRow(t, "OpenReview", reqs.openReview ? "Yes" : "No", "👁️") : ""}
        ${reqs.fee ? reqRow(t, "Registration Fee", reqs.fee, "💰") : ""}
        ${reqs.abstractWordLimit ? reqRow(t, "Abstract Limit", reqs.abstractWordLimit, "📝") : ""}
      `;
    } else {
      reqRows = `
        ${reqs.peerReview ? reqRow(t, "Peer Review", reqs.peerReview ? "Yes" : "No", "👥") : ""}
        ${reqs.openAccess ? reqRow(t, "Open Access", typeof reqs.openAccess === "string" ? reqs.openAccess : (reqs.openAccess ? "Hybrid" : "No"), "🔓") : ""}
        ${reqs.pageLimit ? reqRow(t, "Page Limit", reqs.pageLimit, "📏") : ""}
        ${reqs.format ? reqRow(t, "Format", reqs.format, "📄") : ""}
        ${reqs.anonymization ? reqRow(t, "Anonymization", reqs.anonymization, "🎭") : ""}
        ${reqs.dualSubmission !== undefined ? reqRow(t, "Dual Submission", reqs.dualSubmission ? "Not allowed" : "Check policy", "🔗") : ""}
        ${reqs.turnaround ? reqRow(t, "Turnaround Time", reqs.turnaround, "⏱️") : ""}
        ${reqs.impactFactor ? reqRow(t, "Impact Factor", reqs.impactFactor, "📊") : ""}
        ${reqs.acceptanceRate ? reqRow(t, "Acceptance Rate", reqs.acceptanceRate, "🎯") : ""}
        ${reqs.fee ? reqRow(t, "Fee", reqs.fee, "💰") : ""}
      `;
    }

    reqEl.innerHTML = `
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><i class="bi bi-clipboard-data text-blue-500"></i> ${t.venueDetail.requirements}</h2>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table class="w-full">
          <tbody>${reqRows}</tbody>
        </table>
      </div>
    `;
  }

  function reqRow(t, label, value, icon) {
    return `<tr class="border-b border-gray-100 dark:border-gray-700"><td class="py-3 px-4 font-medium w-48">${icon} ${label}</td><td class="py-3 px-4 text-gray-600 dark:text-gray-300">${value}</td></tr>`;
  }

  function renderVenueDeadlines(venue) {
    const dlEl = document.getElementById("deadlinesTimeline");
    if (!dlEl) return;

    const t = STATE.translations[STATE.currentLang];
    const allDeadlines = (venue.deadlines || [])
      .map((dl) => ({ ...dl, date: parseDeadlineDate(dl) }))
      .filter((dl) => dl.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let html = `
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><i class="bi bi-calendar-event text-red-500"></i> ${t.venueDetail.deadlines}</h2>
      <div class="timeline">
    `;

    if (allDeadlines.length === 0) {
      html += `<p class="text-gray-500" data-i18n="search.noResults">No deadlines found.</p>`;
    } else {
      html += allDeadlines
        .map((dl) => {
          const typeConfig = STATE.deadlineTypes[dl.type] || { icon: "📅", text: dl.type };
          const priorityConfig = STATE.priorityLevels[dl.priority] || STATE.priorityLevels.normal;
          const cd = getDeadlineCountdown(dl);
          const status = getDeadlineStatus(dl);
          const todayColor = status === "today" ? "bg-red-50 dark:bg-red-900/20" : cd && cd.days <= 7 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-white dark:bg-gray-800";
          const countdownClass = status === "passed" ? "text-red-500" : "text-red-600 dark:text-red-400";

          let countdownDisplay = "";
          if (cd && status !== "passed") {
            countdownDisplay = `<span class="font-bold ${countdownClass}">${cd.days}d ${cd.hours}h ${cd.minutes}m</span>`;
          } else {
            countdownDisplay = `<span class="font-bold ${countdownClass}">${t.status.passed || "Passed"}</span>`;
          }

          return `
            <div class="timeline-item data-priority-${dl.priority}" data-priority="${dl.priority}">
              <div class="${todayColor} rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700">
                <div class="flex justify-between items-start mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-2xl">${typeConfig.icon}</span>
                    <span class="font-bold">${typeConfig.text || ""}</span>
                  </div>
                  <span class="priority-${dl.priority} text-xs px-2 py-1 rounded-full">${priorityConfig.text}</span>
                </div>
                <div class="text-lg font-semibold mb-1">${countdownDisplay}</div>
                <div class="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  <span>${formatDateTime(dl.date, STATE.currentLang)}</span>
                  <span class="mx-1">•</span>
                  <span>${dl.timezone || ""}</span>
                </div>
                ${dl.description ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${dl.description}</p>` : ""}
                ${dl.important ? `<div class="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">⚡ Critical deadline</div>` : ""}
              </div>
            </div>
          `;
        })
        .join("");
    }

    html += "</div>";
    dlEl.innerHTML = html;
  }

  function renderSavedVenueButton(venue) {
    const section = document.getElementById("savedActions");
    if (!section) return;
    const t = STATE.translations[STATE.currentLang];
    const isSaved = STATE.savedVenues.includes(venue.id);
    section.classList.remove("hidden");
    section.innerHTML = `
      <div class="text-center py-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700">
        <p class="text-gray-600 dark:text-gray-400 mb-3">${isSaved ? (t.venueDetail.removeFromMyDates || "Remove from My Dates") : (t.venueDetail.saveToMyDates || "Save this venue")}</p>
        <button onclick="toggleSavedVenue('${venue.id}')" class="px-6 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 mx-auto ${
          isSaved ? "bg-yellow-400 text-gray-800" : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
        }">
          <i class="bi ${isSaved ? "bi-bookmark-star-fill" : "bi-bookmark"}"></i>
          <span>${isSaved ? (t.venueDetail.removeFromMyDates || "Remove") : t.venueDetail.saveToMyDates}</span>
        </button>
      </div>
    `;
  }

  /* ==================== Timeline Page ==================== */

  function renderTimelinePage() {
    const content = document.getElementById("timelineContent");
    const loading = document.getElementById("loadingState");
    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const discFilter = document.getElementById("timelineDisciplineFilter");
    const prioFilter = document.getElementById("timelinePriorityFilter");
    [discFilter, prioFilter].forEach((el) => {
      if (el) {
        el.removeEventListener("change", renderTimelineList);
        el.addEventListener("change", renderTimelineList);
      }
    });

    renderTimelineList();
  }

  function getTimelineFilters() {
    return {
      discipline: document.getElementById("timelineDisciplineFilter")?.value || "all",
      priority: document.getElementById("timelinePriorityFilter")?.value || "all",
    };
  }

  function renderTimelineList() {
    const container = document.getElementById("timelineList");
    const noEl = document.getElementById("noTimelineDeadlines");
    if (!container) return;

    const f = getTimelineFilters();
    let allUpcoming = getUpcomingDeadlines(90).filter((dl) => {
      if (f.discipline !== "all" && dl.venue.discipline !== f.discipline) return false;
      if (f.priority !== "all" && dl.priority !== f.priority) return false;
      return true;
    });

    if (allUpcoming.length === 0) {
      container.innerHTML = "";
      if (noEl) noEl.classList.remove("hidden");
      return;
    }
    if (noEl) noEl.classList.add("hidden");

    container.innerHTML = allUpcoming
      .map((dl) => {
        const venue = dl.venue;
        const disc = STATE.disciplines[venue.discipline] || {};
        const cd = getDeadlineCountdown(dl);
        const priorityConfig = STATE.priorityLevels[dl.priority] || STATE.priorityLevels.normal;
        const typeConfig = STATE.deadlineTypes[dl.type] || { icon: "📅", text: dl.type };
        let countdownText = cd ? `${cd.days}d ${cd.hours}h` : priorityConfig.text;

        return `
          <div class="timeline-item" data-priority="${dl.priority}" data-discipline="${venue.discipline}">
            <div class="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700">
              <div class="${disc.color} w-8 h-8 rounded-full flex items-center justify-center text-white text-sm">${typeConfig.icon || "📅"}</div>
              <div class="flex-1">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-bold">${venue.shortName || venue.name}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-300">${venue.name}</p>
                  </div>
                  <span class="priority-${dl.priority} text-xs px-2 py-1 rounded-full">${priorityConfig.text}</span>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  ${typeConfig.text} · ${formatDate(dl.date, STATE.currentLang)}
                </div>
                <div class="font-medium text-red-600 dark:text-red-400 mt-1" data-countdown-live="true" data-venue-id="${venue.id}">
                  ${cd ? `${cd.days}d ${cd.hours}h` : countdownText}
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${dl.description || ""}</p>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  /* ==================== About Page ==================== */

  function renderAboutPage() {
    const content = document.getElementById("aboutContent");
    const loading = document.getElementById("loadingState");
    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const t = STATE.translations[STATE.currentLang];
    if (!content) return;

    let features = "";
    if (t.about?.keyFeatures) {
      features = t.about.keyFeatures.map((f) => `<li class="flex items-center gap-2 py-1"><i class="bi bi-check2-circle text-green-500"></i> ${f}</li>`).join("");
    }

    content.innerHTML = `
      <div class="max-w-3xl mx-auto text-center">
        <div class="mb-8">
          <div class="text-5xl mb-4">📚</div>
          <h1 class="text-3xl font-bold mb-4 text-gradient">${t.about?.title || "About This Tracker"}</h1>
          <p class="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">${t.about?.description || ""}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h2 class="text-xl font-bold mb-4 flex items-center justify-center gap-2"><i class="bi bi-stars text-yellow-500"></i> Key Features</h2>
          <ul class="space-y-2">${features}</ul>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6">
          <p class="text-gray-600 dark:text-gray-300" data-i18n="about.contributing">${t.about?.contributing || "Open a PR!"}</p>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span data-i18n="footer.lastUpdated">${t.footer?.lastUpdated || "Last updated"}</span>: ${STATE.config.lastUpdated || "—"}
          </p>
        </div>
      </div>
    `;
  }

  /* ==================== Saved Venues Page ==================== */

  function renderSavedPage() {
    const content = document.getElementById("savedContent");
    const loading = document.getElementById("loadingState");
    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const t = STATE.translations[STATE.currentLang];
    const savedVenues = STATE.venues.filter((v) => STATE.savedVenues.includes(v.id));

    if (savedVenues.length === 0) {
      content.innerHTML = `
        <div class="text-center py-20">
          <i class="bi bi-bookmark-star text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
          <h2 class="text-xl font-bold mb-2" data-i18n="noSavedDeadlines">${t.noSavedDeadlines || "No saved venues yet."}</h2>
          <a href="#/venues" class="text-blue-600 dark:text-blue-400 hover:underline">${t.dashboard.viewAll || "View All Venues"}</a>
        </div>
      `;
      return;
    }

    let html = `<h1 class="text-2xl font-bold mb-6" data-i18n="savedDeadlines">${t.savedDeadlines || "My Saved Dates"}</h1><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">`;

    html += savedVenues
      .map((venue) => {
        const nextDl = getVenueNextDeadline(venue);
        const disc = STATE.disciplines[venue.discipline] || {};
        const cd = nextDl ? getDeadlineCountdown(nextDl) : null;
        const priorityConfig = nextDl ? STATE.priorityLevels[nextDl.priority] : STATE.priorityLevels.normal;
        let countdown = "";
        if (nextDl) {
          countdown = cd
            ? `<span class="text-red-600 font-bold" data-countdown-live="true" data-venue-id="${venue.id}">${cd.days}d ${cd.hours}h</span>`
            : `<span class="text-gray-500">${t.status.passed || "Passed"}</span>`;
        }

        return `
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold">${venue.shortName || venue.name}</h3>
              <span class="discipline-badge discipline-${venue.discipline}">${disc.name || venue.discipline}</span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">${venue.name}</p>
            ${nextDl ? `<div class="text-sm mb-1"><span class="priority-${nextDl.priority} text-xs px-1 py-0.5 rounded-full">${priorityConfig.text}</span> ${nextDl.type}</div>` : ""}
            <div class="flex justify-between items-center">
              ${countdown}
              <a href="#/venue?id=${venue.id}" class="text-blue-600 dark:text-blue-400 hover:underline text-sm" data-i18n="actions.viewDetails">${t.actions?.viewDetails || "View Details"}</a>
            </div>
          </div>
        `;
      })
      .join("");

    html += "</div>";
    content.innerHTML = html;
  }

  /* ==================== Saved Venue Toggle ==================== */

  function toggleSavedVenue(venueId) {
    const idx = STATE.savedVenues.indexOf(venueId);
    if (idx === -1) {
      STATE.savedVenues.push(venueId);
    } else {
      STATE.savedVenues.splice(idx, 1);
    }
    localStorage.setItem("jt_saved", JSON.stringify(STATE.savedVenues));

    const venue = STATE.venues.find((v) => v.id === venueId);
    if (venue) {
      const saveBtn = document.querySelector(`button[onclick*="toggleSavedVenue('${venueId}')"]`);
      if (saveBtn) saveBtn.outerHTML = renderSaveButton(venueId);

      const savedSection = document.getElementById("savedActions");
      if (savedSection) savedSection.innerHTML = renderSavedVenueButtonHTML(venue);
    }
  }

  function renderSavedVenueButtonHTML(venue) {
    const t = STATE.translations[STATE.currentLang];
    const isSaved = STATE.savedVenues.includes(venue.id);
    return `
      <div class="text-center py-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700">
        <p class="text-gray-600 dark:text-gray-400 mb-3">${isSaved ? (t.venueDetail.removeFromMyDates || "Remove from My Dates") : (t.venueDetail.saveToMyDates || "Save this venue")}</p>
        <button onclick="toggleSavedVenue('${venue.id}')" class="px-6 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 mx-auto ${
          isSaved ? "bg-yellow-400 text-gray-800" : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
        }">
          <i class="bi ${isSaved ? "bi-bookmark-star-fill" : "bi-bookmark"}"></i>
          <span>${isSaved ? (t.venueDetail.removeFromMyDates || "Remove") : t.venueDetail.saveToMyDates}</span>
        </button>
      </div>
    `;
  }

  /* ==================== Utilities ==================== */

  function showError(message) {
    const loading = document.getElementById("loadingState");
    if (loading) {
      loading.querySelector("p").textContent = message;
      loading.classList.remove("hidden");
    }
  }

  function initEventListeners() {
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        toggleTheme();
        localStorage.setItem("jt_theme", STATE.currentTheme);
      });
    }

    const langToggle = document.getElementById("langToggle");
    if (langToggle) {
      langToggle.addEventListener("click", () => {
        toggleLanguage();
        localStorage.setItem("jt_lang", STATE.currentLang);
      });
    }

    const menuToggle = document.getElementById("menuToggle");
    const mobileMenu = document.getElementById("mobile-menu");

    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener("click", () => {
        mobileMenu.classList.add("visible");
        document.body.style.overflow = "hidden";
      });
    }

    if (mobileMenu) {
      const mobileClose = document.getElementById("mobileMenuClose");
      if (mobileClose) {
        mobileClose.addEventListener("click", () => {
          mobileMenu.classList.remove("visible");
          document.body.style.overflow = "";
        });
      }
      window.addEventListener("hashchange", () => {
        if (mobileMenu) {
          mobileMenu.classList.remove("visible");
          document.body.style.overflow = "";
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const loaded = await loadData();
    if (loaded) {
      initEventListeners();
      initRouter();
    }
  });

  window.toggleSavedVenue = toggleSavedVenue;
})();
