#!/usr/bin/env node
'use strict';

/**
 * build_season_explorer.js
 * Reads unified_players.json + aliases.json + players.json
 * Emits season_explorer.json — a flat array, one row per player-season.
 *
 * Usage:
 *   node build_season_explorer.js          # dry-run (QC report only)
 *   node build_season_explorer.js --apply  # writes season_explorer.json
 */

const fs   = require('fs');
const path = require('path');
const APPLY = process.argv.includes('--apply');

// ── Constants ──────────────────────────────────────────────────────────────
const CLASS_ORDER = ['Fr', 'So', 'Jr', 'Sr', 'Gr'];

// Transfer entry-class map — canonical names (ASCII) matching unified_players.json keys.
// Verified June 30 2026: all 24 produce internally consistent progressions (≤ Gr).
// John McNelis and Gavin Cornforth deferred: no season rows yet (2026-27, 0 GP).
const TRANSFER_ENTRY_CLASS = {
  'Brett Boeing':        'So',
  'Josh Couturier':      'So',
  'Jacob Pritchard':     'Sr',
  'Carson Gicewicz':     'Gr',
  'Garrett Wait':        'Jr',
  'Jerry Harding':       'So',
  'Cam Donaldson':       'Gr',
  'Matt Baker':          'Gr',
  'Slava Demin':         'Sr',
  'Cole Brady':          'Jr',
  'Elliott McDermott':   'Jr',
  'Matt Koopman':        'Gr',
  'Christian Sanda':     'Gr',
  'Liam Gorman':         'Gr',
  'Lucas Vanroboys':     'Gr',
  'Samuli Niinisaari':   'Gr',
  'Joey Musa':           'Gr',
  'Lucas Olvestad':      'Jr',
  'Matthew Wilde':       'Jr',
  'Michael DeAngelo':    'So',
  'Owen Mehlenbacher':   'Jr',
  'Ben Gallacher':       'So',
  'Josh Nodler':         'Sr',
  'Niko Rufo':           'Gr',
};

// ── Load data ──────────────────────────────────────────────────────────────
const unified   = JSON.parse(fs.readFileSync('unified_players.json',  'utf8'));
const aliasesJs = JSON.parse(fs.readFileSync('aliases.json',          'utf8')); // name → slug
const playersDim= JSON.parse(fs.readFileSync('players.json',          'utf8')); // slug dimension table

// Build slug → display_name from players.json
const slugToDisplay = {};
playersDim.forEach(p => { slugToDisplay[p.slug] = p.display_name; });

// ── Helpers ────────────────────────────────────────────────────────────────

// Normalize curly right-single-quotation-mark (U+2019) → ASCII apostrophe.
// unified_players.json keys are already ASCII, but kept here for safety.
function normApos(s) { return s.replace(/\u2019/g, "'"); }

function getSlug(name) {
  return aliasesJs[normApos(name)] || null;
}

// ── Main loop ──────────────────────────────────────────────────────────────
const rows          = [];
const qcUnresolved  = [];
const qcOverflow    = [];

for (const [name, player] of Object.entries(unified)) {
  const slug = getSlug(name);
  if (!slug) {
    qcUnresolved.push(name);
    continue;
  }

  const displayName  = slugToDisplay[slug] || name;
  const seasons      = player.umass_seasons || [];
  if (!seasons.length) continue;

  const entryClsStr  = TRANSFER_ENTRY_CLASS[name] || 'Fr';
  const entryClsIdx  = CLASS_ORDER.indexOf(entryClsStr);
  const isGoalie     = player.is_goalie || false;
  const pos          = player.pos || (isGoalie ? 'G' : 'F');
  const active       = player.active || false;

  seasons.forEach((s, i) => {
    const seasonIndex = i + 1;
    const clsIdx      = entryClsIdx + i;

    if (clsIdx >= CLASS_ORDER.length) {
      qcOverflow.push({ name, season: s.season, season_index: seasonIndex });
    }

    const cls = clsIdx < CLASS_ORDER.length ? CLASS_ORDER[clsIdx] : 'Gr';

    const row = {
      slug,
      display_name:  displayName,
      is_goalie:     isGoalie,
      pos,
      season:        s.season,
      season_index:  seasonIndex,
      class:         cls,
      active,
    };

    if (isGoalie) {
      row.gp       = s.gp     || 0;
      row.gs       = s.gs     || 0;
      row.minutes  = s.minutes || '0:00';
      row.ga       = s.ga     || 0;
      row.avg      = s.avg    || 0;
      row.saves    = s.saves  || 0;
      row.sv_pct   = s.sv_pct || 0;
      row.w        = s.w      || 0;
      row.l        = s.l      || 0;
      row.t        = s.t      || 0;
      row.sho      = s.sho    || 0;
      row.pp_ga    = s.pp_ga  || 0;
      row.sh_ga    = s.sh_ga  || 0;
      row.en       = s.en     || 0;
    } else {
      row.gp        = s.gp        || 0;
      row.g         = s.g         || 0;
      row.a         = s.a         || 0;
      row.pts       = s.pts       || 0;
      row.plus_minus= s.plus_minus !== undefined ? s.plus_minus : 0;
      row.pen_min   = s.pen_min   || 0;
      row.pp        = s.pp        || 0;
      row.sh        = s.sh        || 0;
      row.gw        = s.gw        || 0;
      row.shots     = s.shots     || 0;
      row.pct       = s.pct       || 0;
      row.blk       = s.blk       || 0;
    }

    rows.push(row);
  });
}

// ── QC Report ──────────────────────────────────────────────────────────────
console.log('\n=== build_season_explorer.js — QC Report ===');
console.log(`Players in unified_players.json : ${Object.keys(unified).length}`);
console.log(`Total player-seasons emitted    : ${rows.length}`);

// Per-season counts
const seasonCounts = {};
rows.forEach(r => { seasonCounts[r.season] = (seasonCounts[r.season] || 0) + 1; });
const sortedSeasons = Object.keys(seasonCounts).sort();
console.log(`Season range : ${sortedSeasons[0]} — ${sortedSeasons[sortedSeasons.length - 1]}`);
console.log(`Seasons covered : ${sortedSeasons.length}`);
console.log('\nPer-season row counts:');
sortedSeasons.forEach(s => console.log(`  ${s}: ${seasonCounts[s]}`));

if (qcUnresolved.length) {
  console.error(`\n⚠  UNRESOLVED — name not in aliases.json (${qcUnresolved.length}):`);
  qcUnresolved.forEach(n => console.error(`   - ${n}`));
} else {
  console.log('\n✓  All player names resolved to slugs');
}

if (qcOverflow.length) {
  console.error(`\n⚠  CLASS OVERFLOW — exceeds Gr (${qcOverflow.length}):`);
  qcOverflow.forEach(e => console.error(`   - ${e.name}  season=${e.season}  season_index=${e.season_index}`));
} else {
  console.log('✓  All class progressions within Fr–Gr bounds');
}

// Spot checks
const spots = [
  { label: "Cole O'Hara",     slug: getSlug("Cole O'Hara") },
  { label: 'Cale Makar',      slug: getSlug('Cale Makar') },
  { label: 'Filip Lindberg',  slug: getSlug('Filip Lindberg') },
  { label: 'Brett Boeing',    slug: getSlug('Brett Boeing') },
  { label: 'Lucas Olvestad',  slug: getSlug('Lucas Olvestad') },
  { label: 'Ben Gallacher',   slug: getSlug('Ben Gallacher') },
];
console.log('\n── Spot checks ──────────────────────────────────────');
spots.forEach(({ label, slug }) => {
  if (!slug) { console.log(`  ${label}: *** slug not found ***`); return; }
  const playerRows = rows.filter(r => r.slug === slug);
  console.log(`  ${label} (${slug}): ${playerRows.length} season(s)`);
  playerRows.forEach(r => {
    const statStr = r.is_goalie
      ? `w=${r.w} gaa=${r.avg} svpct=${r.sv_pct}`
      : `pts=${r.pts} g=${r.g} a=${r.a}`;
    console.log(`    [${r.season_index}] ${r.season}  class=${r.class}  ${statStr}`);
  });
});

console.log('\n── Goalie count check ───────────────────────────────');
const goalieRows = rows.filter(r => r.is_goalie);
const skaterRows = rows.filter(r => !r.is_goalie);
console.log(`  Skater rows : ${skaterRows.length}`);
console.log(`  Goalie rows : ${goalieRows.length}`);

// ── Write ──────────────────────────────────────────────────────────────────
if (APPLY) {
  const outPath = path.join(__dirname, 'season_explorer.json');
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 0));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\n✓  Written ${outPath}  (${rows.length} rows, ${kb} KB)`);
} else {
  console.log('\n⚠  Dry-run mode — pass --apply to write season_explorer.json');
}
