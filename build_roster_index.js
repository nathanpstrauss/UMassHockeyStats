#!/usr/bin/env node
'use strict';

/**
 * build_roster_index.js
 *
 * Reads players.json (slug-keyed dimension table, frozen slugs) and
 * career_stats.html RAW (umass_seasons + active flag) and emits
 * roster_by_year.json — a year -> [slug, ...] index, alphabetical by
 * display name within each year, used by notes_picker.html and any
 * other roster-by-year UI.
 *
 * This script does NOT mint slugs. players.json is the frozen source of
 * truth for slugs; any RAW player that fails to match an existing slug
 * is reported in the QC output as needing a slug minted by hand
 * (frozen-slug rule: lastname-firstname, lowercased, ASCII-folded,
 * punctuation stripped, debut-year suffix on collisions).
 *
 * Usage:
 *   node build_roster_index.js          # dry-run (QC report only)
 *   node build_roster_index.js --apply  # writes roster_by_year.json
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const APPLY = process.argv.includes('--apply');

// ── Load data ────────────────────────────────────────────────────────────
const playersDim = JSON.parse(fs.readFileSync(path.join(__dirname, 'players.json'), 'utf8'));

const html = fs.readFileSync(path.join(__dirname, 'career_stats.html'), 'utf8');
const rawMatch = html.match(/RAW\s*=\s*(\{[\s\S]*?\});/);
if (!rawMatch) {
  console.error('FATAL: could not locate `RAW = {...};` in career_stats.html');
  process.exit(1);
}
const RAW = JSON.parse(rawMatch[1]);
const allRawPlayers = [...RAW.skaters, ...RAW.goalies];

// Load canonical()/ALIASES from site_data.js without modifying it —
// it's a plain browser script (no require/module.exports), so a vm
// sandbox lets us reuse it as-is rather than re-deriving the alias map.
const siteDataSrc = fs.readFileSync(path.join(__dirname, 'site_data.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(siteDataSrc, sandbox);
const canonical = sandbox.canonical;
if (typeof canonical !== 'function') {
  console.error('FATAL: canonical() not found after loading site_data.js');
  process.exit(1);
}

// ── Build canonical-name -> slug map from players.json ─────────────────
const nameToSlug = {};
const slugToDisplay = {};
playersDim.forEach(p => {
  nameToSlug[p.canonical_name] = p.slug;
  nameToSlug[p.display_name]   = p.slug; // fallback for entries with no alias needed
  slugToDisplay[p.slug] = p.display_name;
});

// ── Build roster_by_year from umass_seasons (historical) ───────────────
const rosterByYear = {}; // year -> Set(slug)
const qcUnmatched = [];

allRawPlayers.forEach(p => {
  const cname = canonical(p.name);
  const slug = nameToSlug[cname];
  if (!slug) {
    qcUnmatched.push(p.name);
    return;
  }
  (p.umass_seasons || []).forEach(s => {
    if (!s.season) return;
    if (!rosterByYear[s.season]) rosterByYear[s.season] = new Set();
    rosterByYear[s.season].add(slug);
  });
});

// ── 2026-27 key sourced from players.json active:true (not umass_seasons —
//    those players haven't played a UMass game yet) ────────────────────
const CURRENT_YEAR = '2026-27';
rosterByYear[CURRENT_YEAR] = new Set(
  playersDim.filter(p => p.active).map(p => p.slug)
);

// ── Sort each year's roster alphabetically by display name ─────────────
const output = {};
Object.keys(rosterByYear).sort().forEach(year => {
  const slugs = [...rosterByYear[year]];
  slugs.sort((a, b) => (slugToDisplay[a] || a).localeCompare(slugToDisplay[b] || b));
  output[year] = slugs;
});

// ── QC Report ────────────────────────────────────────────────────────────
console.log('\n=== build_roster_index.js — QC Report ===');
console.log(`players.json entries        : ${playersDim.length}`);
console.log(`RAW players (skaters+goalies): ${allRawPlayers.length}`);
console.log(`Years indexed                : ${Object.keys(output).length}`);

if (qcUnmatched.length) {
  console.error(`\n⚠  UNMATCHED — RAW name has no slug in players.json (${qcUnmatched.length}):`);
  console.error('   These need a slug minted by hand (frozen-slug rule) before they can appear in any roster year.');
  qcUnmatched.forEach(n => console.error(`   - ${n}`));
} else {
  console.log('\n✓  All RAW players matched to an existing players.json slug — no slugs needed minting');
}

const currentRoster = output[CURRENT_YEAR] || [];
console.log(`\n${CURRENT_YEAR} roster (active:true)  : ${currentRoster.length} players`);
const hasEskit = currentRoster.includes('eskit-ethan');
console.log(`  eskit-ethan present?        : ${hasEskit ? 'yes' : 'NO — check players.json'}`);

console.log('\nPer-year roster counts (most recent 8):');
const years = Object.keys(output).sort();
years.slice(-8).forEach(y => console.log(`  ${y}: ${output[y].length}`));

// Spot check: a known historical year + an apostrophe-name resolution
const spotYear = '2015-16';
if (output[spotYear]) {
  console.log(`\nSpot check ${spotYear}: ${output[spotYear].length} players`);
}
console.log('\nSpot check apostrophe names:');
['dellelce-francesco', 'oneill-cameron'].forEach(slug => {
  const years2 = Object.keys(output).filter(y => output[y].includes(slug));
  console.log(`  ${slug}: appears in ${years2.length} year(s)${years2.length ? ' (' + years2.slice(0,3).join(', ') + (years2.length>3?', ...':'') + ')' : ''}`);
});

// ── Write ────────────────────────────────────────────────────────────────
if (APPLY) {
  const outPath = path.join(__dirname, 'roster_by_year.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 0));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\n✓  Written ${outPath}  (${Object.keys(output).length} years, ${kb} KB)`);
} else {
  console.log('\n⚠  Dry-run mode — pass --apply to write roster_by_year.json');
}
