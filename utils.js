window.MalGapUtils = {
  MS_PER_DAY: 1000 * 60 * 60 * 24,

  parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === "-" || dateStr.trim() === "N/A" || dateStr.trim() === "") return null;
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
  },

  calculateGapDays(previousFinishedDate, nextStartedDate) {
    if (!previousFinishedDate || !nextStartedDate) return 0;
    return Math.max(Math.round((nextStartedDate - previousFinishedDate) / this.MS_PER_DAY) - 1, 0);
  },

  clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
};
