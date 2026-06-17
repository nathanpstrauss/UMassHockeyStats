#!/usr/bin/env python3
"""
build_boxscores_js.py

Reads all parsed game JSON files and outputs a compact boxscores.js
for use in game_log.html.

Lookup key format: "SEASON:M/D"  e.g. "2025-26:10/4"
This matches game_log.html's g.s (season) + g.d (date like "10/4").

Usage:
  python build_boxscores_js.py --games games/ --out boxscores.js
  python build_boxscores_js.py --games games/ --out ../path/to/site/boxscores.js
"""

import json, os, re, argparse, glob

def make_key(season, date_str):
    """
    '2025-26', '10/04/25' → '2025-26:10/4'
    Strips leading zeros so it matches g.d format in game_log.html.
    """
    parts = date_str.split('/')
    m, d = int(parts[0]), int(parts[1])
    return f"{season}:{m}/{d}"

def build_compact(g):
    """
    Extract only the fields needed for display from a full game JSON.
    Keeps the payload small since it's embedded in a page.
    """
    out = {}

    # ── Scoring ───────────────────────────────────────────────────────────────
    scoring = []
    for goal in g.get('scoring', []):
        scoring.append({
            'p':  goal.get('period', ''),
            't':  goal.get('time', ''),
            'tm': 'U' if goal.get('team') == 'UMass' else 'O',
            'ty': goal.get('type', ''),
            'sc': goal.get('scorer', ''),
            'a':  goal.get('assists', []),
            'en': goal.get('empty_net', False),
        })
    out['scoring'] = scoring

    # ── Shots by period ───────────────────────────────────────────────────────
    sbp = g.get('shots_by_period', {})
    out['shots'] = {
        'u': sbp.get('uma', []),
        'o': sbp.get('opp', []),
    }

    # ── Power play ────────────────────────────────────────────────────────────
    pp = g.get('power_play_uma') or {}
    out['pp'] = {
        'g':    pp.get('g'),
        'opp':  pp.get('opp'),
        'sh':   pp.get('shots'),
    }

    # ── Penalty minutes (totals) ──────────────────────────────────────────────
    penalties = g.get('penalties', [])
    out['pim'] = {
        'u': sum(p.get('min', 0) for p in penalties if p.get('team') == 'UMass'),
        'o': sum(p.get('min', 0) for p in penalties if p.get('team') == 'Opponent'),
    }

    # ── Individual penalties ───────────────────────────────────────────────────
    out['pens'] = [{
        'p':  p.get('period', ''),
        't':  p.get('time', ''),
        'tm': 'U' if p.get('team') == 'UMass' else 'O',
        'pl': p.get('player', ''),
        'of': p.get('offense', ''),
        'm':  p.get('min', 0),
    } for p in penalties]

    # ── Opponent PP (derived: each UMass penalty ≈ one opp PP opportunity) ────
    opp_pp_opp   = len([p for p in penalties if p.get('team') == 'UMass'])
    opp_pp_goals = sum(1 for goal in g.get('scoring', [])
                       if goal.get('team') != 'UMass' and goal.get('type') == 'PP')
    out['pp_opp'] = {'g': opp_pp_goals, 'opp': opp_pp_opp}

    # ── Goalie(s) ─────────────────────────────────────────────────────────────
    goalies = []
    for gl in g.get('goalies', []):
        saves = gl.get('saves', {})
        goalies.append({
            'name': gl.get('player', ''),
            'dec':  gl.get('dec', ''),
            'toi':  gl.get('toi', ''),
            'sv':   saves.get('total', 0),
            'sa':   gl.get('sa', 0),
            'svp':  gl.get('sv_pct'),
        })
    out['goalies'] = goalies

    # ── Opponent goalie(s) ────────────────────────────────────────────────────
    opp_goalies = []
    for gl in g.get('opp_goalies', []):
        saves = gl.get('saves', {})
        opp_goalies.append({
            'name': gl.get('player', ''),
            'dec':  gl.get('dec', ''),
            'toi':  gl.get('toi', ''),
            'sv':   saves.get('total', 0),
            'sa':   gl.get('sa', 0),
            'svp':  gl.get('sv_pct'),
        })
    out['opp_goalies'] = opp_goalies

    return out


def main():
    ap = argparse.ArgumentParser(description='Build boxscores.js from game JSON files.')
    ap.add_argument('--games', default='games',
                    help='Root directory containing season subdirs (e.g. games/2025-26/*.json)')
    ap.add_argument('--out', default='boxscores.js',
                    help='Output JS file path (default: boxscores.js)')
    args = ap.parse_args()

    # Find all JSON files anywhere under --games
    pattern = os.path.join(args.games, '**', '*.json')
    files   = sorted(glob.glob(pattern, recursive=True))

    if not files:
        print(f"No JSON files found under {args.games}")
        return

    data    = {}
    ok = bad = dup = 0

    for fp in files:
        try:
            with open(fp, encoding='utf-8') as f:
                g = json.load(f)
        except Exception as e:
            print(f"  skip {fp}: {e}")
            bad += 1
            continue

        season = g.get('season', '')
        date   = g.get('date', '')
        if not season or not date or '/' not in date:
            bad += 1
            continue

        key = make_key(season, date)

        if key in data:
            print(f"  duplicate key {key} ({fp})")
            dup += 1
            continue

        data[key] = build_compact(g)
        ok += 1

    print(f"\nLoaded {ok} games  ({bad} skipped, {dup} duplicates)")
    print(f"Seasons: {sorted(set(k.split(':')[0] for k in data))}")

    # Write output
    js  = f"// Auto-generated by build_boxscores_js.py — {ok} games across "
    js += f"{len(set(k.split(':')[0] for k in data))} seasons\n"
    js += "const BOXSCORES = "
    js += json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    js += ";\n"

    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(js)

    size_kb = os.path.getsize(args.out) / 1024
    print(f"Written to {args.out} ({size_kb:.1f} KB)")


if __name__ == '__main__':
    main()
