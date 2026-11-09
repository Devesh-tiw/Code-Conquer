# Code-Conquer v2 — Live LeetCode Tracker + Recommendation Engine

> Personal DSA study system for one user (Devesh). Static, explainable, daily-driver.

**Live:** `https://devesh-tiw.github.io/Code-Conquer/`  
**Repo:** `github.com/Devesh-tiw/Code-Conquer` (`main` branch)

## What it is

Upgraded from a static reader (175 hardcoded problems) to a daily system:

1. **Live LeetCode sync** — real solved counts (107 total: 63E/39M/5H as of 9 Nov 2026 baseline), per-topic counts, streak, calendar, recent ACs — pulled from LeetCode's public GraphQL.
2. **Tracker + spaced repetition** — per-problem state (status, confidence 1–5, solvedOn, R1 +10d, R2 +30d) with due-review surfacing.
3. **Recommendation engine** — deterministic, explainable **4 tasks today** (2 reviews + 2 new) + drift warnings. Not ML. Pure rules.

## How sync works (CORS-safe)

LeetCode's GraphQL at `https://leetcode.com/graphql` does **not** send CORS — browser fetch would fail. So:

- **GitHub Actions cron** (`.github/workflows/sync.yml`) runs `schedule: 0 3,15 * * *` (08:30 & 20:30 IST) + manual `workflow_dispatch`
- Steps: `checkout → node scripts/fetch-leetcode.mjs → commit data/*.json if changed`
- `scripts/fetch-leetcode.mjs` (Node 20+, zero npm deps):
  - `POST` with `Referer: https://leetcode.com/u/Devesht373/` and `Content-Type: application/json`
  - `matchedUser(username)` for stats + `tagProblemCounts` + `userCalendar` (parses JSON-string `submissionCalendar`)
  - `problemsetQuestionListV2(limit:100, skip)` paginated with 400 ms delay; `totalLength` ≈ 4109 (~3320 free). Cached monthly.
  - Probes `recentAcSubmissionList(username, limit:20)` via introspection — falls back to calendar diff if renamed.
  - Writes pretty `data/user.json` + `data/problems.json` with `_syncedAt` + IST label. Never overwrites good data with error payload.

The site reads local `data/*.json` via `js/sync.js` with `cache: no-store` and `network-first` in `sw.js` (`cc-v2` cache). If sync is days old, UI shows `data as of <timestamp>` and keeps working — graceful degradation.

## How state is stored

- Key: `cc:v2:state` in `localStorage`
- Shape:
```json
{
  "version": 2,
  "username": "Devesht373",
  "records": {
    "206": { "status": "solved", "confidence": 3, "solvedOn": "2026-11-24", "r1Done": false, "r2Done": false, "attempts": 2, "notes": "lost dummy-node trick" }
  },
  "settings": { "hoursPerWeek": 4, "newPerDay": 2, "reviewsPerDay": 2 },
  "log": [ { "week": "2026-11-23", "new": 3, "reviews": 2, "contest": true, "hours": 4 } ]
}
```
- Buttons: **Export JSON** / **Import JSON** (and `Reset`). That's the backup — no backend, no DB.
- Service worker: `sw.js` version `cc-v2`, adds `data/*.json` network-first.

## Recommendation engine (explainable)

Pure function `recommend({records, ladder, todayISO, settings})` in `js/recommend.js`:

1. **Due queue:** `r1Due = solvedOn+10d`, `r2Due = solvedOn+30d`; due if `!r1Done && today>=r1Due` or `r1Done && !r2Done && today>=r2Due`.
2. **Rank:** `score = (6-confidence)*10 + min(overdue,30) + (attempts>1?5:0) + (notes?3:0)` — low confidence first.
3. **Fill:** `reviewsPerDay` (2) from due, then `newPerDay` (2) from **current stage only** in `ladder.json` order (skip non-`not_started`).
4. **Stage gate:** current stage = first stage with any not-`solved`. Never leak to later stage — most important rule, shown in UI.
5. **Warnings:** `DUE_OVERFLOW>8`, `DRIFT>5d`, `CONFIDENCE_LOW>40% ≤2`, `NO_CONTEST 7d`, `STAGE_STALL 10d`. Each with `reason` string like *“Confidence 2, 14 days overdue, you noted …”*

Date math in `js/sr.js` — inclusive at exactly +10/+30, capped overdue 30.

## Views

- **Today (default):** 4 cards with LeetCode link + reason + Solved/Attempted/Skip + confidence tap.
- **Dashboard:** live numbers (total/easy/med/hard, streak, activeDays, ranking, last sync) + per-stage progress bars.
- **Topic Audit:** two columns — “LeetCode says you solved X” vs interview weights (Appendix B hardcoded) — flags `ZERO` & `OVER_INVESTED`.
- **Ladder:** 152 problems in 12 stages, filterable, inline editable (status/confidence/notes).
- **Log:** weekly new/reviews/contest/hours (derived from `solvedOn` + manual contest).
- **Settings:** username, pace, Export/Import/Reset, “sync now” link to Actions.

Mobile: cards stack, tap ≥40px, no horizontal scroll.

## Cleanup vs v1

- Deleted every filler *“Why this works — The solution maintains the invariant…”* paragraph.
- Code samples labeled: *“reference solution in Python; I practise in Java”* (or port to Java).
- Footer shows `Last updated` from sync timestamp.
- Kept IBM Plex visual identity, extended.

## Local run

```bash
git clone https://github.com/Devesh-tiw/Code-Conquer.git
cd Code-Conquer
node scripts/fetch-leetcode.mjs   # writes data/*.json (no npm)
# open index.html via Live Server or `python -m http.server`
```

No build step, no bundler, no framework, zero npm in shipped site — plain ES modules.

## Tests

Pure & testable:

```bash
node --test tests/sr.test.mjs
node --test tests/recommend.test.mjs
# or: node --test tests/*.test.mjs
```

Covers: due boundaries at +10/+30, stage gate never leaking, ranking order, each warning firing/not firing, empty-state → first 2 of Stage 0, 3× backdated 40d all due.

Manual checks: empty state → Stage 0 first 2; 3 backdated 40d confidence 1 → lowest first.

## Non-goals

No auth, no server/DB/serverless, no analytics, no extension, no ML, no solution scraping.

## Appendix A baseline (9 Nov 2026)

`107 total · 63E/39M/5H · ranking 1,625,079 · active 96 · streak 24 · last 7 Nov`  
Topics: Array 43, String 28, Two Pointers 20, Sorting 13, Linked List 7, etc. ZERO: Tree, Graph, BFS/DFS, Heap.

## Appendix B weights

Array 0.20, Tree/BT 0.25, Graph/BFS/DFS 0.20, DP 0.15, Linked List 0.10, Stack/Queue/Monotonic 0.10, Heap 0.08, Binary Search 0.12, Hash Table 0.15, Sliding Window 0.10, Two Pointers 0.10, Backtracking 0.06, Bit Manip 0.04, Math 0.04, Greedy 0.06, Union-Find 0.05 — overlapping, not summing to 1.

---

*Definition of done:* loads on GitHub Pages with no console errors, no calls to `leetcode.com` from browser, sync unattended 2×/day, phone-friendly 4 tasks with reasons, 152 ladder problems, no filler, README as above.

