#!/usr/bin/env node
'use strict';

/**
 * sync_notes.js
 *
 * Fetches the published Google Sheet CSV (one row per submitted note from
 * notes_picker.html), validates each row against players.json, and writes
 * player_notes.json — a slug -> [note, ...] index consumed by career_stats.html.
 *
 * Column mapping is done BY HEADER NAME, not by fixed position. The sheet's
 * actual column order (confirmed live, 2026-06-30) is:
 *   Timestamp | Slug | Display Name | Note | Type | Source
 * This differs from the original v1 spec's assumed order (Note/Type swapped) —
 * reading by header name means a future Google Forms field reorder won't
 * silently corrupt the data the way a fixed-position parser would.
 *
 * QC (unmatched slugs, malformed type values, empty notes) is reported, not
 * silently dropped, per the build brief.
 *
 * Usage:
 *   node sync_notes.js          # dry-run (QC report only, no writes)
 *   node sync_notes.js --apply  # writes player_notes.json + QC report file
 */

const fs   = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQuEDp7gUhHStm7SYetZoOpMou77WpHEFOUV-I-rlKwDpik6sD1hz1J0U00EJWTLU0opVdFjNDObP4D/pub?gid=180024856&single=true&output=csv';

const VALID_TYPES = new Set(['Fact', 'Quote', 'Trivia']);

const OUT_NOTES = path.join(__dirname, 'player_notes.json');
const OUT_QC    = path.join(__dirname, 'player_notes_qc.md');

// ── Minimal RFC4180-ish CSV parser ──────────────────────────────────────
// Handles quoted fields containing commas, newlines, and doubled ""
// escaped quotes. Sheets/Forms text fields (notes, sources) can contain
// commas, so a naive split(',') would corrupt rows.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; } // normalize CRLF
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  // final field/row (file may or may not end with newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  return rows.filter(r => !(r.length === 1 && r[0] === '')); // drop trailing blank lines
}

async function main() {
  // ── Load players.json (slug dimension) ────────────────────────────────
  const playersPath = path.join(__dirname, 'players.json');
  if (!fs.existsSync(playersPath)) {
    console.error(`FATAL: players.json not found at ${playersPath}`);
    process.exit(1);
  }
  const playersDim = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  const validSlugs = new Set(playersDim.map(p => p.slug));

  // ── Fetch CSV ───────────────────────────────────────────────────────────
  let csvText;
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (err) {
    console.error(`FATAL: could not fetch CSV export — ${err.message}`);
    process.exit(1);
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    console.error('FATAL: CSV appears empty');
    process.exit(1);
  }

  const header = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);

  // ── Resolve column indices by header name (not fixed position) ─────────
  const REQUIRED_COLS = ['Timestamp', 'Slug', 'Display Name', 'Note', 'Type', 'Source'];
  const colIndex = {};
  REQUIRED_COLS.forEach(name => { colIndex[name] = header.indexOf(name); });

  const missingCols = REQUIRED_COLS.filter(name => colIndex[name] === -1);
  if (missingCols.length) {
    console.error(`FATAL: CSV header is missing expected column(s): ${missingCols.join(', ')}`);
    console.error(`       Actual header row: ${header.join(' | ')}`);
    process.exit(1);
  }

  // ── Process rows ─────────────────────────────────────────────────────────
  const notesBySlug = {};   // slug -> [ {type, note, source, timestamp}, ... ]
  const qc = {
    unmatchedSlug: [],   // rows whose slug isn't in players.json
    badType: [],         // rows whose Type isn't exactly Fact/Quote/Trivia
    emptyNote: [],        // rows with blank Note text
    ok: 0
  };

  dataRows.forEach((r, idx) => {
    const rowNum = idx + 2; // +1 for 0-index, +1 for header row, matches Sheet row number
    const timestamp   = (r[colIndex['Timestamp']]    || '').trim();
    const slug         = (r[colIndex['Slug']]          || '').trim();
    const displayName = (r[colIndex['Display Name']]  || '').trim();
    const note         = (r[colIndex['Note']]          || '').trim();
    const type         = (r[colIndex['Type']]          || '').trim();
    const source       = (r[colIndex['Source']]        || '').trim();

    // Skip fully-blank rows (trailing empty lines some CSV exports include)
    if (!timestamp && !slug && !displayName && !note && !type && !source) return;

    let hasIssue = false;

    if (!validSlugs.has(slug)) {
      qc.unmatchedSlug.push({ rowNum, timestamp, slug, displayName, note });
      hasIssue = true;
    }
    if (!VALID_TYPES.has(type)) {
      qc.badType.push({ rowNum, timestamp, slug, type });
      hasIssue = true;
    }
    if (!note) {
      qc.emptyNote.push({ rowNum, timestamp, slug });
      hasIssue = true;
    }

    if (hasIssue) return; // don't add malformed rows to player_notes.json

    if (!notesBySlug[slug]) notesBySlug[slug] = [];
    notesBySlug[slug].push({ type, note, source, timestamp });
    qc.ok++;
  });

  // Sort output slugs alphabetically for stable diffs
  const output = {};
  Object.keys(notesBySlug).sort().forEach(slug => { output[slug] = notesBySlug[slug]; });

  // ── QC Report ────────────────────────────────────────────────────────────
  const qcLines = [];
  qcLines.push('# player_notes.json — Sync QC Report');
  qcLines.push('');
  qcLines.push(`Run: ${new Date().toISOString()}`);
  qcLines.push('');
  qcLines.push(`- Rows in sheet: ${dataRows.length}`);
  qcLines.push(`- Clean rows synced: ${qc.ok}`);
  qcLines.push(`- Players with notes: ${Object.keys(output).length}`);
  qcLines.push(`- Unmatched slug: ${qc.unmatchedSlug.length}`);
  qcLines.push(`- Invalid type value: ${qc.badType.length}`);
  qcLines.push(`- Empty note text: ${qc.emptyNote.length}`);
  qcLines.push('');

  if (qc.unmatchedSlug.length) {
    qcLines.push('## Unmatched slug (not in players.json — check for a typo or a slug that needs minting)');
    qc.unmatchedSlug.forEach(x => {
      qcLines.push(`- Row ${x.rowNum} (${x.timestamp}): slug="${x.slug}" displayName="${x.displayName}" note="${x.note.slice(0,60)}${x.note.length>60?'…':''}"`);
    });
    qcLines.push('');
  }
  if (qc.badType.length) {
    qcLines.push('## Invalid type value (must be exactly Fact, Quote, or Trivia)');
    qc.badType.forEach(x => {
      qcLines.push(`- Row ${x.rowNum} (${x.timestamp}): slug="${x.slug}" type="${x.type}"`);
    });
    qcLines.push('');
  }
  if (qc.emptyNote.length) {
    qcLines.push('## Empty note text');
    qc.emptyNote.forEach(x => {
      qcLines.push(`- Row ${x.rowNum} (${x.timestamp}): slug="${x.slug}"`);
    });
    qcLines.push('');
  }
  if (!qc.unmatchedSlug.length && !qc.badType.length && !qc.emptyNote.length) {
    qcLines.push('✓ No issues — every row synced cleanly.');
    qcLines.push('');
  }

  const qcReport = qcLines.join('\n');

  // ── Console summary (visible in Action logs even on dry-run) ───────────
  console.log('\n=== sync_notes.js — QC Summary ===');
  console.log(`Rows in sheet         : ${dataRows.length}`);
  console.log(`Clean rows synced      : ${qc.ok}`);
  console.log(`Players with notes     : ${Object.keys(output).length}`);
  console.log(`Unmatched slug         : ${qc.unmatchedSlug.length}`);
  console.log(`Invalid type value     : ${qc.badType.length}`);
  console.log(`Empty note text        : ${qc.emptyNote.length}`);

  // ── Write ────────────────────────────────────────────────────────────────
  if (APPLY) {
    fs.writeFileSync(OUT_NOTES, JSON.stringify(output, null, 0));
    fs.writeFileSync(OUT_QC, qcReport);
    console.log(`\n✓  Written ${OUT_NOTES}`);
    console.log(`✓  Written ${OUT_QC}`);
  } else {
    console.log('\n⚠  Dry-run mode — pass --apply to write player_notes.json + QC report');
  }
}

main();
