window.MalGapScraper = {
  scrapeAnimelist() {
    const data = [];
    function addEntry(title, started, finished) {
      if (title && finished && finished !== "-") {
        data.push({ title, started, finished });
      }
    }
    function collectRows(rows, extractRow) {
      rows.forEach((row) => {
        const entry = extractRow(row);
        if (entry) {
          addEntry(entry.title, entry.started, entry.finished);
        }
      });
    }

    collectRows(
      document.querySelectorAll(".list-table-data .list-table-row, .list-table-data"),
      (row) => {
        const title = row.querySelector(".title .link, .title a")?.innerText?.trim();
        const started = row.querySelector(".data.started, td.started")?.innerText?.trim();
        const finished = row.querySelector(".data.finished, td.finished")?.innerText?.trim();
        return title ? { title, started, finished } : null;
      }
    );

    if (data.length === 0) {
      collectRows(
        document.querySelectorAll("table.list-table tbody tr, #list-container .list-item"),
        (row) => {
          const cols = row.querySelectorAll("td");
          if (cols.length < 8) return null;
          return {
            title: cols[1]?.innerText?.trim(),
            started: cols[6]?.innerText?.trim(),
            finished: cols[7]?.innerText?.trim()
          };
        }
      );
    }
    return data;
  },

  getRowScore(row) {
    const scoreElem = row.querySelector(".data.score, td.score, .score-label, .score .link");
    if (!scoreElem) return 0;
    const text = (scoreElem.textContent || "").trim();
    if (text === "-" || text === "N/A" || text === "") return 0;
    const parsed = parseInt(text, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  },

  getRowDaysToComplete(row) {
    const startedElem = row.querySelector(".data.started, td.started");
    const finishedElem = row.querySelector(".data.finished, td.finished");
    if (!startedElem || !finishedElem) return -1;
    
    // Uses window.MalGapUtils
    const start = window.MalGapUtils.parseDate(startedElem.textContent);
    const finish = window.MalGapUtils.parseDate(finishedElem.textContent);
    
    if (!start || !finish) return -1;
    return Math.max(Math.round((finish - start) / window.MalGapUtils.MS_PER_DAY), 0);
  },

  getRowRewatched(movable) {
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
};
