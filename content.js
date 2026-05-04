// ── Floating Scroll Buttons ───────────

(function () {
  if (document.getElementById("mal-gap-scroll-btns")) return;

  const container = document.createElement("div");
  container.id = "mal-gap-scroll-btns";

  // ── Up Button ──────────────────────────────────────────────────
  const upBtn = document.createElement("button");
  upBtn.id = "mal-gap-scroll-up";
  upBtn.setAttribute("aria-label", "Scroll to top");
  upBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;

  // ── Down Button ────────────────────────────────────────────────
  const downBtn = document.createElement("button");
  downBtn.id = "mal-gap-scroll-down";
  downBtn.setAttribute("aria-label", "Scroll to bottom");
  downBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  container.appendChild(upBtn);
  container.appendChild(downBtn);
  document.body.appendChild(container);

  // ── Scroll Actions ─────────────────────────────────────────────
  upBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  downBtn.addEventListener("click", () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });

  // ── Show / Hide based on scroll position ───────────────────────
  function updateVisibility() {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    upBtn.classList.toggle("mal-gap-btn-hidden", scrollY < 100);
    downBtn.classList.toggle("mal-gap-btn-hidden", maxScroll - scrollY < 100);
  }

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();

  // ── Live Controls Logic ────────────────────────────────────────

  let activeScoreFilter = null;
  let activeRewatchedFilter = null;
  let activeSortType = null; // 'days' | null
  let activeSortOrder = null; // 'asc' | 'desc' | null

  const ROW_SELECTORS = ".list-table-data .list-table-row, .list-table-data, table.list-table tbody tr, #list-container .list-item";

  function getMovableNode(row) {
    const tbody = row.closest("tbody");
    if (tbody && tbody.parentNode && tbody.parentNode.tagName === "TABLE") {
      if (tbody.classList.contains("list-item")) return tbody;
    }
    return row;
  }

  function getValidRows() {
    const rawRows = Array.from(document.querySelectorAll(ROW_SELECTORS));
    const validMovableNodes = [];
    const seen = new Set();
    
    for (const row of rawRows) {
      if (row.classList.contains("list-table-header") || 
          row.classList.contains("table-header") || 
          row.classList.contains("more-info") ||
          row.closest(".more-info") ||
          row.id.startsWith("more-") ||
          row.querySelector("th") || 
          row.tagName === "TH") {
        continue;
      }
      const movable = getMovableNode(row);
      if (!seen.has(movable)) {
        seen.add(movable);
        validMovableNodes.push(movable);
      }
    }
    return validMovableNodes;
  }

  // Gets the movable node AND its immediate .more-info siblings so they don't tear apart when re-ordered
  function getGrouping(movable) {
    const group = [movable];
    if (movable.tagName === "TR") {
      let next = movable.nextElementSibling;
      while (next && (next.classList.contains("more-info") || (next.id && next.id.startsWith("more-")))) {
        group.push(next);
        next = next.nextElementSibling;
      }
    }
    return group;
  }

  // Evaluators
  function getRowScore(row) {
    const scoreElem = row.querySelector(".data.score, td.score, .score-label, .score .link");
    if (!scoreElem) return 0;
    const text = (scoreElem.textContent || "").trim();
    if (text === "-" || text === "N/A" || text === "") return 0;
    const parsed = parseInt(text, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function parseDateSnippet(dateStr) {
    if (!dateStr || dateStr === "-" || dateStr === "N/A" || dateStr === "") return null;
    const value = dateStr.trim();
    const legacyMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (legacyMatch) {
      const [, day, month, year] = legacyMatch;
      const shortYear = parseInt(year, 10);
      const fullYear = shortYear < 50 ? 2000 + shortYear : 1900 + shortYear;
      return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
    }
    const parsedValue = Date.parse(value);
    return Number.isNaN(parsedValue) ? null : new Date(parsedValue);
  }

  function getRowDaysToComplete(row) {
    const startedElem = row.querySelector(".data.started, td.started");
    const finishedElem = row.querySelector(".data.finished, td.finished");
    if (!startedElem || !finishedElem) return -1;
    const start = parseDateSnippet(startedElem.textContent);
    const finish = parseDateSnippet(finishedElem.textContent);
    if (!start || !finish) return -1;
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.max(Math.round((finish - start) / MS_PER_DAY), 0);
  }

  function getRowRewatched(movable) {
    let moreInfoNode = null;
    if (movable.tagName === 'TBODY') {
      moreInfoNode = movable.querySelector('.more-info, [id^="more-"]');
    } else {
      let next = movable.nextElementSibling;
      while (next && !next.classList.contains('list-table-data')) {
        if (next.classList.contains('more-info') || (next.id && next.id.startsWith('more-'))) {
          moreInfoNode = next;
          break;
        }
        next = next.nextElementSibling;
      }
    }
    if (!moreInfoNode) return 0;

    const textMatch = moreInfoNode.textContent.match(/re-watched\s+(\d+)\s+times?/i);
    if (textMatch) return parseInt(textMatch[1], 10);
    return 0;
  }

  // ── MutationObserver (declared early so rewatch preloading can pause it) ──

  const observer = new MutationObserver((mutations) => {
    if ((activeScoreFilter === null && activeRewatchedFilter === null && activeSortType === null) || isUpdating) return;
    
    let shouldUpdate = false;
    for (const mutation of mutations) {
      const hasAddedElements = Array.from(mutation.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
      if (hasAddedElements) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) {
      applyLiveControls();
    }
  });

  // ── Rewatch Data Preloading (click-based, safe for background tabs) ──

  let rewatchDataLoaded = false;
  let rewatchDataLoading = false;
  let rewatchLoadCancelled = false;

  const POLL_INTERVAL_MS = 500;

  function createProgressIndicator() {
    let indicator = document.getElementById('mal-gap-rewatch-progress');
    if (indicator) return indicator;

    indicator = document.createElement('div');
    indicator.id = 'mal-gap-rewatch-progress';
    indicator.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      z-index: 99999; padding: 10px 22px; border-radius: 8px;
      background: rgba(20, 25, 35, 0.95); color: #00e5ff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; font-weight: 500; letter-spacing: 0.3px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 12px rgba(0,229,255,0.15);
      border: 1px solid rgba(0,229,255,0.25);
      backdrop-filter: blur(8px); transition: opacity 0.3s ease;
      display: flex; align-items: center; gap: 12px;
    `;

    const textSpan = document.createElement('span');
    textSpan.id = 'mal-gap-rewatch-progress-text';
    indicator.appendChild(textSpan);

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'mal-gap-rewatch-cancel';
    cancelBtn.textContent = '✕ Stop';
    cancelBtn.style.cssText = `
      background: rgba(255, 82, 82, 0.2); color: #ff5252;
      border: 1px solid rgba(255, 82, 82, 0.4); border-radius: 4px;
      padding: 3px 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease;
      font-family: inherit; letter-spacing: 0.3px;
    `;
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = 'rgba(255, 82, 82, 0.35)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'rgba(255, 82, 82, 0.2)';
    });
    cancelBtn.addEventListener('click', () => {
      rewatchLoadCancelled = true;
    });
    indicator.appendChild(cancelBtn);

    document.body.appendChild(indicator);
    return indicator;
  }

  function setProgressText(text) {
    const el = document.getElementById('mal-gap-rewatch-progress-text');
    if (el) el.textContent = text;
  }

  function removeProgressIndicator() {
    const indicator = document.getElementById('mal-gap-rewatch-progress');
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }
  }

  // Find all "More" links on the page
  function findAllMoreLinks() {
    const links = [];
    document.querySelectorAll('.list-table-data .more a, .list-table-data a').forEach(link => {
      if (link.textContent.trim() === 'More') links.push(link);
    });
    if (links.length === 0) {
      document.querySelectorAll('#list-container a, .list-block a').forEach(link => {
        if (link.textContent.trim() === 'More') links.push(link);
      });
    }
    return links;
  }

  // Check if a "More" link's corresponding more-info row has loaded content
  function isMoreInfoLoaded(moreLink) {
    const row = moreLink.closest('tr, .list-table-data');
    if (!row) return false;
    if (row.tagName === 'TR') {
      let next = row.nextElementSibling;
      while (next) {
        if (next.classList.contains('more-info') || (next.id && next.id.startsWith('more-'))) {
          const content = next.querySelector('.more-content, td');
          return content && content.textContent.trim().length > 10;
        }
        if (next.classList.contains('list-table-data')) break;
        next = next.nextElementSibling;
      }
    }
    return false;
  }

  async function loadAllRewatchData() {
    if (rewatchDataLoaded || rewatchDataLoading) return;
    rewatchDataLoading = true;
    rewatchLoadCancelled = false;

    // Pause MutationObserver during loading to prevent re-entrant calls
    observer.disconnect();
    const indicator = createProgressIndicator();
    setProgressText(`Preparing to load data...`);

    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

    const allMoreLinks = findAllMoreLinks();
    const unloaded = allMoreLinks.filter(link => !isMoreInfoLoaded(link));

    if (unloaded.length === 0) {
      rewatchDataLoaded = true;
      rewatchDataLoading = false;
      removeProgressIndicator();
      reconnectObserver();
      return;
    }

    const total = unloaded.length;
    setProgressText(`Loading rewatch data… (0/${total})`);

    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

    for (let i = 0; i < unloaded.length; i++) {
      unloaded[i].click();
    }

    // Connect to background service worker for un-throttled timing
    const port = chrome.runtime.connect({ name: "rewatch-timer" });

    await new Promise((resolve) => {
      port.onMessage.addListener((msg) => {
        if (msg.action !== "tick") return;
        if (rewatchLoadCancelled) { resolve(); return; }

        let loadedCount = 0;
        for (let i = 0; i < unloaded.length; i++) {
          if (isMoreInfoLoaded(unloaded[i])) {
            loadedCount++;
          }
        }

        setProgressText(`Loading rewatch data… (${loadedCount}/${total})`);

        if (loadedCount === total) {
          // All loaded — click again to collapse the opened sections
          for (let i = 0; i < unloaded.length; i++) {
            unloaded[i].click();
          }
          resolve();
        }
      });

      port.postMessage({ action: "start", intervalMs: POLL_INTERVAL_MS });
    });

    // Cleanup
    port.postMessage({ action: "stop" });
    port.disconnect();
    reconnectObserver();

    if (rewatchLoadCancelled) {
      setProgressText('Loading cancelled — partial data available');
      setTimeout(() => removeProgressIndicator(), 1500);
      rewatchDataLoaded = true;
    } else {
      setProgressText('Rewatch data loaded ✓');
      setTimeout(() => removeProgressIndicator(), 1200);
      rewatchDataLoaded = true;
    }

    rewatchDataLoading = false;
  }

  // Helper: reconnect the MutationObserver after loading completes
  function reconnectObserver() {
    const container = document.querySelector("#list-container, .list-block") || document.body;
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  // ── Core Filter & Sort Logic ────────────────────────────────────

  let isUpdating = false;
  let originalOrderArray = [];

  function executeFilterAndSort() {
    const rows = getValidRows();
    
    const sortable = rows.map(row => ({
      movable: row,
      group: getGrouping(row),
      score: getRowScore(row),
      days: getRowDaysToComplete(row),
      rewatched: getRowRewatched(row)
    }));

    // Cache original order if not done already
    if (originalOrderArray.length === 0 && sortable.length > 0) {
      originalOrderArray = sortable.map(item => item.movable);
    }

    // Step 1: Sorting
    if (activeSortType === null) {
      // Restore original HTML order
      originalOrderArray.forEach(movable => {
        const item = sortable.find(s => s.movable === movable);
        if (item && movable.parentNode) {
          item.group.forEach(n => movable.parentNode.appendChild(n));
        }
      });
    } else {
      sortable.sort((a, b) => {
        if (a.days === -1 && b.days === -1) return 0;
        if (a.days === -1) return 1;
        if (b.days === -1) return -1;
        return activeSortOrder === "desc" ? b.days - a.days : a.days - b.days;
      });
      
      sortable.forEach(item => {
         const parent = item.movable.parentNode;
         if (parent) item.group.forEach(n => parent.appendChild(n));
      });
    }

    // Step 2: Filtering
    let visibleCount = 0;
    sortable.forEach(({ group, score, rewatched }) => {
      const scoreMatch = activeScoreFilter === null || score === activeScoreFilter;
      const rewatchedMatch = activeRewatchedFilter === null || rewatched >= activeRewatchedFilter;
      const isVisible = scoreMatch && rewatchedMatch;
      group.forEach(node => { node.style.display = isVisible ? "" : "none"; });
      
      if (isVisible) {
        visibleCount++;
        const numberCell = group[0].querySelector(".data.number, td.number, .number, .list-table-data .data.number");
        if (numberCell && numberCell.textContent != visibleCount) {
           numberCell.textContent = visibleCount;
        }
      }
    });
  }

  async function applyLiveControls() {
    if (isUpdating) return;
    isUpdating = true;
    try {
      if (activeRewatchedFilter !== null && !rewatchDataLoaded) {
        await loadAllRewatchData();
      }
      executeFilterAndSort();
    } finally {
      setTimeout(() => { isUpdating = false; }, 0);
    }
  }

  // Listen for popup messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "applyLiveControls") {
      activeScoreFilter = request.score;
      activeRewatchedFilter = request.rewatchedFilter;
      
      if (request.daysOrder) {
        activeSortType = "days";
        activeSortOrder = request.daysOrder;
      } else {
        activeSortType = null;
        activeSortOrder = null;
      }

      applyLiveControls().then(() => {
        sendResponse({ status: "ok" });
      });
      return true;
    }
  });

  // Start observing for infinite scroll / dynamic row loading
  const listContainer = document.querySelector("#list-container, .list-block") || document.body;
  if (listContainer) {
    observer.observe(listContainer, { childList: true, subtree: true });
  }

})();
