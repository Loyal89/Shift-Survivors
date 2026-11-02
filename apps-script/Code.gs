/**
 * Shift Survivors leaderboard
 * Google Apps Script web app that lives inside a Google Sheet.
 *
 * - Players' scores land in the "Scores" tab with "Show" unticked.
 * - Tick "Show" to put a score on the leaderboard. Untick it to take it down.
 * - You can fix a name by editing its cell, or delete the whole row.
 *
 * @OnlyCurrentDoc
 */
const SHEET = 'Scores';
const HEAD = ['Time', 'Name', 'Score', 'Level', 'Nurse', 'Made it to 19:00', 'Show'];
const SHOW_COL = HEAD.length;          // column G
const TOP = 15;                        // how many approved scores the board shows

function setup() {                     // optional: run once to create the Scores tab
  sheet_();
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET, 0);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 170);
  }
  return sh;
}

function clean_(s) {
  return String(s == null ? '' : s)
    .replace(/[<>"'`\\=+@]/g, '')      // no markup, and nothing a spreadsheet would read as a formula
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14);
}

// A player sends a score (POST from the game).
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const name = clean_(d.name);
    const score = Math.floor(Number(d.score));
    const level = Math.floor(Number(d.level)) || 0;
    if (!name || !(score > 0 && score <= 60000) || level < 1 || level > 60) return json_({ ok: false });
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const sh = sheet_();
      sh.appendRow([new Date(), name, score, level, clean_(d.nurse), d.done ? 'Yes' : 'No', false]);
      sh.getRange(sh.getLastRow(), SHOW_COL).insertCheckboxes();
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  }
}

// The game and the booth screen read the approved top scores (GET).
function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('top');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const sh = sheet_();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  const top = rows
    .filter(function (r) { return r[SHOW_COL - 1] === true && String(r[1]).trim() !== ''; })
    .map(function (r) {
      return { name: String(r[1]).trim().slice(0, 14), score: Number(r[2]) || 0, level: Number(r[3]) || 0, done: r[5] === 'Yes' };
    })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, TOP);
  const out = JSON.stringify({ ok: true, top: top });
  cache.put('top', out, 15);           // ticks in the sheet show up within ~15 seconds
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
