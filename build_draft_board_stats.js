#!/usr/bin/env node
/**
 * build_draft_board_stats.js
 * Regenerates UMass career stats and NHL totals in recruiting_classes.html PLAYERS[]
 * from the two authoritative sources: career_stats.html (RAW) and pro_stats.js (PRO_STATS).
 *
 * Usage:
 *   node build_draft_board_stats.js          # dry-run: print diffs, no writes
 *   node build_draft_board_stats.js --apply  # write changes to recruiting_classes.html
 */

'use strict';
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DIR = __dirname;

// ─── 1. Load & parse ALIASES from site_data.js ────────────────────────────
const siteDataSrc = fs.readFileSync(path.join(DIR, 'site_data.js'), 'utf8');

// Extract ALIASES object literal
const aliasMatch = siteDataSrc.match(/const ALIASES\s*=\s*(\{[\s\S]*?\});\s*function canonical/);
if (!aliasMatch) throw new Error('Could not find ALIASES in site_data.js');

let ALIASES;
try {
  ALIASES = eval('(' + aliasMatch[1] + ')');
} catch (e) {
  throw new Error('Failed to parse ALIASES: ' + e.message);
}

function canonical(name) {
  return ALIASES[name] || name;
}

// ─── 2. Load & parse RAW from career_stats.html ────────────────────────────
const careerHtml = fs.readFileSync(path.join(DIR, 'career_stats.html'), 'utf8');

// Find "const RAW = {" and extract to the matching closing "}"
const rawStart = careerHtml.indexOf('const RAW = {');
if (rawStart === -1) throw new Error('Could not find const RAW in career_stats.html');

// We need to find the balanced closing brace
let braceDepth = 0;
let rawEnd = -1;
let inString = false;
let stringChar = '';
let escaped = false;

for (let i = rawStart + 'const RAW = '.length; i < careerHtml.length; i++) {
  const ch = careerHtml[i];
  if (escaped) { escaped = false; continue; }
  if (ch === '\\' && inString) { escaped = true; continue; }
  if (inString) {
    if (ch === stringChar) inString = false;
    continue;
  }
  if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
  if (ch === '{') braceDepth++;
  if (ch === '}') {
    braceDepth--;
    if (braceDepth === 0) { rawEnd = i; break; }
  }
}
if (rawEnd === -1) throw new Error('Could not find end of RAW object');

const rawJson = careerHtml.slice(rawStart + 'const RAW = '.length, rawEnd + 1);
let RAW;
try {
  RAW = JSON.parse(rawJson);
} catch (e) {
  throw new Error('Failed to parse RAW JSON: ' + e.message);
}

// Build umassByCanon map
const umassByCanon = {};
function addUmassEntry(entry, isGoalie) {
  const key = canonical(entry.name);
  if (isGoalie) {
    umassByCanon[key] = {
      gp: entry.career_gp || 0,
      sk_g: 0, sk_a: 0, pts: 0, pim: 0,
      isGoalie: true
    };
  } else {
    umassByCanon[key] = {
      gp: entry.career_gp || 0,
      sk_g: entry.career_g || 0,
      sk_a: entry.career_a || 0,
      pts: entry.career_tp || 0,   // use stored total, not recomputed
      pim: entry.career_pim || 0,
      isGoalie: false
    };
  }
}

(RAW.skaters || []).forEach(e => addUmassEntry(e, false));
(RAW.goalies || []).forEach(e => addUmassEntry(e, true));

console.log(`RAW: ${(RAW.skaters||[]).length} skaters, ${(RAW.goalies||[]).length} goalies`);
console.log(`umassByCanon: ${Object.keys(umassByCanon).length} entries`);

// ─── 3. Load & parse PRO_STATS from pro_stats.js ───────────────────────────
const proStatsSrc = fs.readFileSync(path.join(DIR, 'pro_stats.js'), 'utf8');

// Extract var PRO_STATS = {...};
const proStart = proStatsSrc.indexOf('var PRO_STATS = ');
if (proStart === -1) throw new Error('Could not find var PRO_STATS in pro_stats.js');

const proJsonStart = proStatsSrc.indexOf('{', proStart);
let proBraceDepth = 0;
let proEnd = -1;
let proInString = false;
let proStringChar = '';
let proEscaped = false;

for (let i = proJsonStart; i < proStatsSrc.length; i++) {
  const ch = proStatsSrc[i];
  if (proEscaped) { proEscaped = false; continue; }
  if (ch === '\\' && proInString) { proEscaped = true; continue; }
  if (proInString) {
    if (ch === proStringChar) proInString = false;
    continue;
  }
  if (ch === '"' || ch === "'") { proInString = true; proStringChar = ch; continue; }
  if (ch === '{') proBraceDepth++;
  if (ch === '}') {
    proBraceDepth--;
    if (proBraceDepth === 0) { proEnd = i; break; }
  }
}
if (proEnd === -1) throw new Error('Could not find end of PRO_STATS object');

const proJson = proStatsSrc.slice(proJsonStart, proEnd + 1);
let PRO_STATS;
try {
  PRO_STATS = JSON.parse(proJson);
} catch (e) {
  throw new Error('Failed to parse PRO_STATS JSON: ' + e.message);
}

// Build nhlByCanon: sum bucket==="NHL" seasons for each player
const nhlByCanon = {};
for (const [name, player] of Object.entries(PRO_STATS)) {
  const key = canonical(name);
  const isGoalie = player.role === 'goalie';
  let nhlGP = 0, nhlG = 0, nhlA = 0, nhlPts = 0;
  for (const s of (player.seasons || [])) {
    if (s.bucket === 'NHL') {
      nhlGP += (s.gp || 0);
      if (!isGoalie) {
        nhlG   += (s.g || 0);
        nhlA   += (s.a || 0);
        nhlPts += (s.pts || 0);
      }
    }
  }
  if (nhlGP > 0 || nhlByCanon[key]) {
    // Only store if there are NHL seasons (or update if already exists due to alias collision)
    nhlByCanon[key] = { nhl: nhlGP, nhl_g: nhlG, nhl_a: nhlA, nhl_pts: nhlPts, isGoalie };
  }
}

// For players with no NHL seasons in PRO_STATS, they just won't be in nhlByCanon
// We'll use zeros in that case.

const nhlPlayersCount = Object.values(nhlByCanon).filter(v => v.nhl > 0).length;
console.log(`PRO_STATS: ${Object.keys(PRO_STATS).length} players; ${nhlPlayersCount} with NHL GP`);

// ─── 4. Parse PLAYERS[] from recruiting_classes.html ──────────────────────
const boardHtml = fs.readFileSync(path.join(DIR, 'recruiting_classes.html'), 'utf8');

// Find "const PLAYERS=[" 
const playersStart = boardHtml.indexOf('const PLAYERS=[');
if (playersStart === -1) throw new Error('Could not find const PLAYERS= in recruiting_classes.html');

// Find the array's content
const arrayStart = boardHtml.indexOf('[', playersStart);
let bracketDepth = 0;
let arrayEnd = -1;
let aInString = false;
let aStringChar = '';
let aEscaped = false;

for (let i = arrayStart; i < boardHtml.length; i++) {
  const ch = boardHtml[i];
  if (aEscaped) { aEscaped = false; continue; }
  if (ch === '\\' && aInString) { aEscaped = true; continue; }
  if (aInString) {
    if (ch === aStringChar) aInString = false;
    continue;
  }
  if (ch === '"' || ch === "'") { aInString = true; aStringChar = ch; continue; }
  if (ch === '[') bracketDepth++;
  if (ch === ']') {
    bracketDepth--;
    if (bracketDepth === 0) { arrayEnd = i; break; }
  }
}
if (arrayEnd === -1) throw new Error('Could not find end of PLAYERS array');

const playersJs = boardHtml.slice(arrayStart, arrayEnd + 1);
let PLAYERS;
try {
  // PLAYERS uses JS object literal syntax (unquoted keys), not strict JSON
  PLAYERS = eval('(' + playersJs + ')');
} catch (e) {
  throw new Error('Failed to eval PLAYERS: ' + e.message);
}
console.log(`PLAYERS[]: ${PLAYERS.length} rows\n`);

// ─── 5. Dry-run: compute proposed values for each row ─────────────────────
const statFields = ['gp','sk_g','sk_a','pts','pim','nhl','nhl_g','nhl_a','nhl_pts'];

let changedCount = 0;
let unchangedCount = 0;
const unmatched = [];       // non-commit rows with no RAW match
const changes = [];         // {rowIdx, name, old, proposed, warnings}

for (let i = 0; i < PLAYERS.length; i++) {
  const p = PLAYERS[i];

  // Skip commits — no UMass stats and usually no PRO_STATS
  if (p.commit) {
    continue;
  }

  const key = canonical(p.n);
  const umassStat = umassByCanon[key];
  const nhlStat = nhlByCanon[key] || { nhl: 0, nhl_g: 0, nhl_a: 0, nhl_pts: 0 };

  const warnings = [];

  if (!umassStat) {
    unmatched.push({ rowIdx: i, name: p.n, canonKey: key });
    // For reporting, don't skip — flag it
    continue;
  }

  // Proposed new values
  const proposed = {
    gp:      umassStat.gp,
    sk_g:    umassStat.sk_g,
    sk_a:    umassStat.sk_a,
    pts:     umassStat.pts,
    pim:     umassStat.pim,
    nhl:     nhlStat.nhl,
    nhl_g:   nhlStat.nhl_g,
    nhl_a:   nhlStat.nhl_a,
    nhl_pts: nhlStat.nhl_pts,
  };

  // For goalies: zero out offensive fields on both sides
  if (umassStat.isGoalie) {
    proposed.sk_g = 0;
    proposed.sk_a = 0;
    proposed.pts  = 0;
    proposed.pim  = 0;
    proposed.nhl_g  = 0;
    proposed.nhl_a  = 0;
    proposed.nhl_pts = 0;
  }

  const old = {};
  statFields.forEach(f => { old[f] = p[f] !== undefined ? p[f] : null; });

  const diffFields = statFields.filter(f => proposed[f] !== old[f]);
  if (diffFields.length > 0) {
    changedCount++;
    changes.push({ rowIdx: i, name: p.n, canonKey: key, old, proposed, diffFields, warnings });
  } else {
    unchangedCount++;
  }
}

// ─── 6. Print dry-run report ───────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('DRY-RUN DIFF REPORT');
console.log('═══════════════════════════════════════════════════════════\n');

if (unmatched.length > 0) {
  console.log(`⚠️  UNMATCHED non-commit rows (no RAW entry found):`);
  unmatched.forEach(u => {
    console.log(`   Row ${u.rowIdx}: "${u.name}" (canonical key: "${u.canonKey}")`);
  });
  console.log('');
}

if (changes.length === 0) {
  console.log('✅ All rows already match source data. No changes needed.\n');
} else {
  console.log(`📝 Rows with proposed changes: ${changes.length}\n`);
  for (const c of changes) {
    console.log(`Row ${c.rowIdx}: ${c.name}`);
    if (c.warnings.length) c.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
    for (const f of c.diffFields) {
      const arrow = `  ${f.padEnd(9)}: ${String(c.old[f]).padStart(5)} → ${String(c.proposed[f]).padStart(5)}`;
      console.log(arrow);
    }
    console.log('');
  }
}

console.log('─── Summary ───────────────────────────────────────────────');
console.log(`  Commits skipped:   ${PLAYERS.filter(p=>p.commit).length}`);
console.log(`  Rows unmatched:    ${unmatched.length}`);
console.log(`  Rows unchanged:    ${unchangedCount}`);
console.log(`  Rows to change:    ${changedCount}`);
console.log('───────────────────────────────────────────────────────────\n');

if (!APPLY) {
  console.log('ℹ️  Dry-run only. Run with --apply to write changes.');
  process.exit(0);
}

// ─── 7. Apply mode: rewrite stat fields in recruiting_classes.html ─────────
if (changes.length === 0) {
  console.log('Nothing to apply.');
  process.exit(0);
}

// Strategy: work on the raw text of the PLAYERS array region.
// For each changed row, locate its text representation and update only the
// stat fields using regex replacement.
// We operate on the boardHtml string and replace values field by field.

let updatedHtml = boardHtml;

// For each changed row, find the player entry by matching on a unique anchor
// (the name field is unique enough combined with draft year).
// We'll do targeted field replacements within the matched span.

for (const c of changes) {
  const p = PLAYERS[c.rowIdx];

  // Build a unique search string: the name field as it appears in the JS
  // E.g. n:"Cale Makar" or n:"Cam O\u2019Neill"
  // The JSON.stringify approach handles special characters automatically:
  const nameJson = JSON.stringify(p.n); // e.g. "\"Cale Makar\""

  // Find the span of this player row in the current HTML
  // Anchor on {n:NAME or {n: NAME
  const anchor = `n:${nameJson}`;
  const anchorPos = updatedHtml.indexOf(anchor);
  if (anchorPos === -1) {
    console.error(`⚠️  APPLY: Could not find anchor for "${p.n}" — skipping`);
    continue;
  }

  // Find the end of this object (next unescaped "},\n" at the same depth or end of array)
  // Simple approach: find the next occurrence of "}," or "}]" after this position
  let rowEnd = anchorPos;
  let rdepth = 0;
  let rInStr = false; let rStrCh = ''; let rEsc = false;
  // Back up to find the '{' that opens this row
  let rowStart = anchorPos;
  while (rowStart > 0 && updatedHtml[rowStart] !== '{') rowStart--;

  for (let i = rowStart; i < updatedHtml.length; i++) {
    const ch = updatedHtml[i];
    if (rEsc) { rEsc = false; continue; }
    if (ch === '\\' && rInStr) { rEsc = true; continue; }
    if (rInStr) { if (ch === rStrCh) rInStr = false; continue; }
    if (ch === '"' || ch === "'") { rInStr = true; rStrCh = ch; continue; }
    if (ch === '{') rdepth++;
    if (ch === '}') {
      rdepth--;
      if (rdepth === 0) { rowEnd = i; break; }
    }
  }

  let rowText = updatedHtml.slice(rowStart, rowEnd + 1);
  const origRowText = rowText;

  // For each changed field, replace fieldName:oldValue with fieldName:newValue
  for (const f of c.diffFields) {
    const oldVal = c.old[f];
    const newVal = c.proposed[f];
    // Match: field name followed by colon and the old numeric value
    // Pattern: fieldname:NUMBER or fieldname: NUMBER (with possible whitespace)
    const fieldRegex = new RegExp(`(\\b${f}\\s*:\\s*)${oldVal}(\\b|,|})`, 'g');
    const replaced = rowText.replace(fieldRegex, `$1${newVal}$2`);
    if (replaced === rowText) {
      console.error(`⚠️  APPLY: Could not replace ${f}:${oldVal}→${newVal} in row "${p.n}"`);
    } else {
      rowText = replaced;
    }
  }

  if (rowText !== origRowText) {
    updatedHtml = updatedHtml.slice(0, rowStart) + rowText + updatedHtml.slice(rowEnd + 1);
    console.log(`✅ Applied: ${c.name}`);
  }
}

fs.writeFileSync(path.join(DIR, 'recruiting_classes.html'), updatedHtml, 'utf8');
console.log('\n✅ recruiting_classes.html written successfully.');
console.log('   Verify the file, then bundle for deployment.');
