// ── Shared Constants ────────────────────────────────────────────────
const MAL_ANIMELIST_URL_PREFIX = "https://myanimelist.net/animelist/";
const REPORT_FILENAME = "mal-gap-report.md";
const RATING_INPUT_IDS = ["rStory", "rCharacter", "rAnimation", "rSound", "rEnjoyment"];

// ── Date Formatting ─────────────────────────────────────────────────

function formatDate(date) {
  if (!date) {
    return "N/A";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// ── Gap Detection ───────────────────────────────────────────────────

function detectGaps(data) {
  const sortedEntries = data
    .map((item) => ({
      ...item,
      startedDate: window.MalGapUtils.parseDate(item.started),
      finishedDate: window.MalGapUtils.parseDate(item.finished)
    }))
    .filter((item) => item.finishedDate !== null)
    .sort((a, b) => a.finishedDate - b.finishedDate);

  return sortedEntries.slice(0, -1).map((current, index) => {
    const next = sortedEntries[index + 1];

    return {
      current,
      next,
      gap: window.MalGapUtils.calculateGapDays(current.finishedDate, next.startedDate)
    };
  });
}

// ── Markdown Generation ─────────────────────────────────────────────

function generateMarkdown(gaps) {
  const lines = ["# Anime Watch Gap Report", ""];

  gaps.forEach(({ current, next, gap }) => {
    lines.push(`##### ${current.title} → ${next.title}`);
    lines.push(`- Finished: ${formatDate(current.finishedDate)}`);
    lines.push(`- Next Started: ${formatDate(next.startedDate)}`);
    lines.push(`- **Gap: ${gap} day${gap !== 1 ? "s" : ""}**`);
    lines.push("");
  });

  return lines.join("\n");
}


// ── DOM References & Local State ────────────────────────────────────

const $ = (selector) => document.querySelector(selector);

const elements = {
  analyzeBtn: $("#analyze"),
  downloadBtn: $("#download"),
  status: $("#status"),
  output: $("#output"),
  summary: $("#summary"),
  minGapInput: $("#minGap"),
  sortSelect: $("#sortBy"),
  fromYearInput: $("#fromYear"),
  toYearInput: $("#toYear"),
  totalEntries: $("#totalEntries"),
  largestGap: $("#largestGap"),
  avgGap: $("#avgGap"),
  pageScoreInput: $("#pageScore"),
  SortOrder: $("#SortOrder"),
  RewatchedInput: $("#Rewatched"),
  applyLiveControlsBtn: $("#applyLiveControls"),
  clearLiveControlsBtn: $("#clearLiveControls"),
  calcBtn: $("#calcRating"),
  ratingResult: $("#rating-result"),
  ratingValue: $("#ratingValue"),
  ratingLabel: $("#ratingLabel"),
  ratingActual: $("#ratingActual")
};

const ratingInputs = RATING_INPUT_IDS.map((id) => document.getElementById(id));

const state = {
  rawGaps: [],
  currentReport: ""
};

// ── Popup UI Helpers ────────────────────────────────────────────────

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = type;
}

function clearStatus() {
  elements.status.className = "hidden";
  elements.status.textContent = "";
}

function setAnalyzeLoading(isLoading) {
  const spinner = elements.analyzeBtn.querySelector(".spinner");
  const text = elements.analyzeBtn.querySelector(".btn-text");

  setHidden(spinner, !isLoading);
  text.textContent = isLoading ? "Analyzing…" : "Analyze";
  elements.analyzeBtn.disabled = isLoading;
}

function resetAnalysisState() {
  state.rawGaps = [];
  state.currentReport = "";
  elements.output.textContent = "";
  setHidden(elements.summary, true);
  elements.downloadBtn.disabled = true;
}

// ── Gap Filter & Render Flow ────────────────────────────────────────

function renderSummary(gaps) {
  if (gaps.length === 0) {
    setHidden(elements.summary, true);
    return;
  }

  const gapValues = gaps.map((entry) => entry.gap);
  const largestGap = Math.max(...gapValues);
  const averageGap = (
    gapValues.reduce((total, value) => total + value, 0) / gapValues.length
  ).toFixed(1);

  elements.totalEntries.innerHTML = `<strong>${gaps.length}</strong> transitions`;
  elements.largestGap.innerHTML = `<strong>${largestGap}</strong> day max`;
  elements.avgGap.innerHTML = `<strong>${averageGap}</strong> day avg`;
  setHidden(elements.summary, false);
}

function getMinimumGap() {
  return Math.max(parseInt(elements.minGapInput.value, 10) || 0, 1);
}

function sortGaps(gaps, sortBy) {
  if (sortBy === "gap-desc") {
    gaps.sort((a, b) => b.gap - a.gap);
  } else if (sortBy === "gap-asc") {
    gaps.sort((a, b) => a.gap - b.gap);
  }

  return gaps;
}

function getDateRange() {
  const fromYear = parseInt(elements.fromYearInput.value, 10) || null;
  const toYear = parseInt(elements.toYearInput.value, 10) || null;
  return { fromYear, toYear };
}

function getFilteredGaps() {
  const minGap = getMinimumGap();
  const { fromYear, toYear } = getDateRange();

  let filtered = state.rawGaps.filter((entry) => entry.gap >= minGap);

  if (fromYear || toYear) {
    filtered = filtered.filter(({ current, next }) => {
      const finishYear = current.finishedDate.getFullYear();
      const startYear = next.startedDate?.getFullYear() ?? finishYear;

      if (fromYear && finishYear < fromYear && startYear < fromYear) return false;
      if (toYear && finishYear > toYear && startYear > toYear) return false;
      return true;
    });
  }

  return sortGaps([...filtered], elements.sortSelect.value);
}

function renderAnalysis() {
  const filteredGaps = getFilteredGaps();
  renderSummary(filteredGaps);
  state.currentReport = generateMarkdown(filteredGaps);
  elements.output.textContent = state.currentReport;
  elements.downloadBtn.disabled = filteredGaps.length === 0;
}

// ── Chrome Tab Access ───────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isMalAnimelistTab(tab) {
  return Boolean(tab?.url?.startsWith(MAL_ANIMELIST_URL_PREFIX));
}

async function scrapeActiveTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.MalGapScraper.scrapeAnimelist()
  });

  return results?.[0]?.result ?? [];
}

// ── Analyze Action ──────────────────────────────────────────────────

async function analyzeCurrentTab() {
  clearStatus();
  resetAnalysisState();

  const tab = await getActiveTab();
  if (!isMalAnimelistTab(tab)) {
    setStatus("Navigate to a MAL anime list page first (myanimelist.net/animelist/…)", "error");
    return;
  }

  setAnalyzeLoading(true);

  try {
    const data = await scrapeActiveTab(tab.id);

    if (data.length === 0) {
      setStatus("No completed anime found on this page. Make sure the list has finished dates visible.", "error");
      return;
    }

    state.rawGaps = detectGaps(data);
    setStatus(`Scraped ${data.length} entries, found ${state.rawGaps.length} transitions.`, "success");
    renderAnalysis();
  } catch (error) {
    console.error("MAL Gap Detector error:", error);
    setStatus(`Error: ${error.message}`, "error");
  } finally {
    setAnalyzeLoading(false);
  }
}

// ── Report Download ────────────────────────────────────────────────

function downloadReport() {
  if (!state.currentReport) {
    return;
  }

  const blob = new Blob([state.currentReport], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = REPORT_FILENAME;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Rating Calculator Helpers ───────────────────────────────────────

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampRatingInput(input) {
  const numericValue = parseInt(input.value, 10);
  if (Number.isNaN(numericValue)) {
    return;
  }

  input.value = clampValue(numericValue, 0, 10);
}

function getRatingLabel(rating) {
  const labels = {
    8: "Great",
    7: "Good",
    6: "Fine",
    5: "Average",
    4: "Below Average",
    3: "Bad",
    2: "Terrible",
    1: "Appalling"
  };

  if (rating >= 9) {
    return "Masterpiece";
  }

  return labels[rating] ?? "—";
}

function getRatingTier(rating) {
  if (rating >= 7) {
    return "green";
  }

  if (rating >= 4) {
    return "yellow";
  }

  return "red";
}

function getRatingValues() {
  return ratingInputs.map((input) => {
    const numericValue = parseFloat(input.value);
    return Number.isNaN(numericValue) ? null : clampValue(numericValue, 0, 10);
  });
}

function renderRatingError() {
  elements.ratingResult.className = "";
  elements.ratingResult.classList.add("rating-error");
  elements.ratingValue.textContent = "!";
  elements.ratingLabel.textContent = "Fill in all fields";
  elements.ratingActual.textContent = "";
}

function renderRatingResult(finalRating, averageRating) {
  elements.ratingResult.className = "";
  elements.ratingResult.classList.add(`rating-tier-${getRatingTier(finalRating)}`);
  elements.ratingValue.textContent = finalRating;
  elements.ratingLabel.textContent = `/ 10  ·  ${getRatingLabel(finalRating)}`;
  elements.ratingActual.textContent = `Actual: ${averageRating.toFixed(2)}`;
}

// ── Rating Calculation ──────────────────────────────────────────────

function calculateRating() {
  const values = getRatingValues();

  if (values.some((value) => value === null)) {
    renderRatingError();
    return;
  }

  const averageRating = values.reduce((total, value) => total + value, 0) / values.length;
  const finalRating = Math.round(averageRating);
  renderRatingResult(finalRating, averageRating);
}

// ── Date Range Presets ──────────────────────────────────────────────

function clearPresetSelection() {
  document.querySelectorAll(".preset-pill").forEach((pill) => pill.classList.remove("active"));
}

function applyPreset(preset) {
  clearPresetSelection();
  document.querySelector(`.preset-pill[data-preset="${preset}"]`)?.classList.add("active");

  if (preset === "all") {
    elements.fromYearInput.value = "";
    elements.toYearInput.value = "";
  } else {
    const years = parseInt(preset, 10);
    const currentYear = new Date().getFullYear();
    elements.fromYearInput.value = currentYear - years;
    elements.toYearInput.value = currentYear;
  }

  if (state.rawGaps.length > 0) {
    renderAnalysis();
  }
}

// ── Live Page Controls ──────────────────────────────────────────────

async function applyLiveControls() {
  const scoreRaw = elements.pageScoreInput.value;
  let score = null;
  if (scoreRaw !== "") {
    score = Math.max(0, Math.min(10, parseInt(scoreRaw, 10)));
    elements.pageScoreInput.value = score;
  }

  const rewatchedRaw = elements.RewatchedInput.value;
  let rewatchedFilter = null;
  if (rewatchedRaw !== "") {
    rewatchedFilter = Math.max(0, parseInt(rewatchedRaw, 10));
    elements.RewatchedInput.value = rewatchedFilter;
  }

  const daysOrder = elements.SortOrder.value;

  const tab = await getActiveTab();
  if (tab && isMalAnimelistTab(tab)) {
    chrome.tabs.sendMessage(tab.id, {
      action: "applyLiveControls",
      score,
      rewatchedFilter,
      daysOrder: daysOrder || null
    });

    let msg = [];
    if (score !== null) msg.push(`Score: ${score === 0 ? 'Unrated' : score}`);
    if (rewatchedFilter !== null) msg.push(`Rewatched: ${rewatchedFilter}`);
    if (daysOrder) msg.push(`Days: ${daysOrder === "desc" ? "Longest" : "Fastest"}`);

    setStatus(msg.length > 0 ? `Applied: ${msg.join(' | ')}` : "Filters applied.", "success");
  } else {
    setStatus("Navigate to a MAL anime list page to use live controls.", "error");
  }
}

async function clearLiveControls() {
  elements.pageScoreInput.value = "";
  elements.SortOrder.value = "";
  elements.RewatchedInput.value = "";

  const tab = await getActiveTab();
  if (tab && isMalAnimelistTab(tab)) {
    chrome.tabs.sendMessage(tab.id, {
      action: "applyLiveControls",
      score: null,
      rewatchedFilter: null,
      daysOrder: null
    });
    setStatus("Filter & Sort cleared.", "info");
  }
}

// ── Event Wiring & Init ─────────────────────────────────────────────

function bindEvents() {
  elements.analyzeBtn.addEventListener("click", analyzeCurrentTab);
  elements.downloadBtn.addEventListener("click", downloadReport);

  elements.applyLiveControlsBtn.addEventListener("click", applyLiveControls);
  elements.clearLiveControlsBtn.addEventListener("click", clearLiveControls);

  elements.minGapInput.addEventListener("input", () => {
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  elements.sortSelect.addEventListener("change", () => {
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  elements.fromYearInput.addEventListener("input", () => {
    clearPresetSelection();
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  elements.toYearInput.addEventListener("input", () => {
    clearPresetSelection();
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  document.querySelectorAll(".preset-pill").forEach((pill) => {
    pill.addEventListener("click", () => applyPreset(pill.dataset.preset));
  });
  elements.calcBtn.addEventListener("click", calculateRating);

  ratingInputs.forEach((input) => {
    input.addEventListener("input", () => clampRatingInput(input));
  });
}

bindEvents();
