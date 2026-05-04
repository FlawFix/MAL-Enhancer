# MAL Enhancer — Feature Specification

> A comprehensive Chrome Extension designed to improve the MyAnimeList (MAL) experience by adding advanced filtering, gap detection, and rating tools.

---

## 1. Live List Controls (In-Page)
Injects a suite of controls directly into the top of the user's MyAnimeList page, allowing for dynamic sorting and filtering of anime entries.

### 1.1 Fast Filtering
* **Minimum Score:** Instantly hides any anime with a score lower than the requested threshold.
* **Rewatched Count:** Instantly hides any anime with a rewatch count lower than the requested threshold.

### 1.2 Custom Sorting
* **Days to Complete:** Sorts the anime list based on how long it took the user to complete the series (Finished Date - Started Date).

### 1.3 Asynchronous Data Preloading
* Since MyAnimeList hides rewatch data behind a "More Information" toggle, the extension automatically preloads this data.
* Uses **Asynchronous Chunking** to trigger hundreds of entries rapidly in the background without freezing the browser's main thread.
* Features a sleek, floating progress indicator and an instantly responsive "Stop" button.

---

## 2. Anime Watch Gap Detector (Popup)
Analyzes the user's completed anime list to find the downtime ("gaps") between finishing one series and starting the next.

### 2.1 Analysis & Filtering
* Scrapes the active tab to extract watch dates.
* Allows filtering by a specific **Date Range** (e.g., gaps that occurred between 2020 and 2022) using quick preset buttons.
* Allows filtering by **Minimum Gap** size (e.g., only show gaps larger than 30 days).
* Can sort the results by gap length (Ascending/Descending).

### 2.2 Reporting
* Provides a visual summary of the largest gap, the average gap, and the total number of transitions.
* Generates a downloadable **Markdown (.md) Report** containing a chronological list of all filtered gaps.

---

## 3. Rating Calculator Panel (Popup)
A built-in calculator to compute a fair, weighted average score based on specific anime aspects.

### 3.1 Input Categories
Users rate the anime out of 10 across five categories:
1. Story
2. Character
3. Animation
4. Sound
5. Enjoyment

### 3.2 Dynamic Feedback
* Calculates the exact average and rounds it to the nearest whole integer (standard MAL format).
* Displays a dynamic gradient and descriptive label based on the final score:
  * **🟢 Green (7–10):** Strong / Positive (e.g., "Masterpiece", "Great")
  * **🟡 Yellow (4–6):** Neutral / Average (e.g., "Fine", "Below Average")
  * **🔴 Red (1–3):** Weak / Negative (e.g., "Terrible")

---

## 4. Floating Scroll Buttons
Injects floating ↑ / ↓ buttons to easily navigate massive anime lists.
* Located in the bottom-right corner.
* Circular, semi-transparent design with hover elevation.
* Automatically available on any MyAnimeList page.

---

## Technical Architecture

* **Modular Design:** Strictly follows the Principle of Separation of Concerns (SoC).
  * `utils.js`: Pure data math and date parsing.
  * `scraper.js`: Strict DOM traversal and extraction logic.
  * `content.js`: Handles in-page UI rendering and DOM manipulation.
  * `popup.js`: Handles extension popup state and rendering.
* **Lightweight:** Vanilla JavaScript and CSS with zero external dependencies. No persistent background workers are required.
