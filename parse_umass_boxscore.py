#!/usr/bin/env python3
"""
parse_umass_boxscore.py

Parses UMass Athletics hockey box score pages into structured JSON.
All data lives in <td> cells — parsed via table row iteration.
toi is null on skaters; filled later from CHN for 2024-25+.

Usage:
  python parse_umass_boxscore.py <url>
  python parse_umass_boxscore.py <url> --out game.json
  python parse_umass_boxscore.py --season 2025-26 --outdir ./games/2025-26/
"""

import requests
from bs4 import BeautifulSoup
import json, re, sys, os, argparse

# ── ENCODING FIXES ────────────────────────────────────────────────────────────
ENCODING_FIXES = {
    'Jen?ko':    'Jenčko',
    'Kle?ka':    'Klečka',
    'Nestra?il': 'Nestrašil',
}

UMA_ABBREVS = {'UMASS', 'UMA', 'MASS', 'MAS'}

# ── UTILITIES ─────────────────────────────────────────────────────────────────

def ws(s):
    return re.sub(r'\s+', ' ', str(s)).strip() if s else ''

def fix(s):
    for bad, good in ENCODING_FIXES.items():
        s = s.replace(bad, good)
    return s

def normalize_name(raw):
    s = fix(ws(raw)).lstrip('*').strip()
    if ',' in s:
        last, first = s.split(',', 1)
        return f"{first.strip()} {last.strip()}"
    return s

def parse_pen(raw):
    m = re.match(r'(\d+)-(\d+)', ws(raw))
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)

def full_year(yy):
    y = int(yy)
    return 2000 + y if y < 50 else 1900 + y

def opp_code_from_url(url):
    fn = url.rstrip('/').split('/')[-1]
    m = re.match(r'^\d+([a-z]+)\.htm$', fn, re.I)
    return m.group(1).lower() if m else 'unk'

def date_from_url(url, season=None):
    fn = url.rstrip('/').split('/')[-1]
    m = re.match(r'^(\d+)[a-z]+\.htm$', fn, re.I)
    if not m:
        return None
    digits = m.group(1)
    if len(digits) == 6:
        mm, dd, yy = digits[:2], digits[2:4], digits[4:6]
    elif len(digits) == 5:
        mm, dd, yy = digits[:2], digits[2:3], digits[3:5]
    elif len(digits) == 4:
        mm, dd = digits[:2], digits[2:4]
        if season:
            y1 = int(season.split('-')[0])
            yr = y1 if int(mm) >= 8 else y1 + 1
            yy = str(yr)[2:]
        else:
            return None
    else:
        return None
    return f"{mm.zfill(2)}/{dd.zfill(2)}/{yy}"

def make_game_id(date_str, code):
    mm, dd, yy = date_str.split('/')
    return f"{full_year(yy)}{mm}{dd}_uma_{code}"

def infer_season(date_str):
    mm, _, yy = date_str.split('/')
    fy = full_year(yy)
    return f"{fy}-{str(fy+1)[2:]}" if int(mm) >= 8 else f"{fy-1}-{str(fy)[2:]}"

# ── TABLE ROW EXTRACTION ──────────────────────────────────────────────────────

def get_all_rows(soup):
    """
    Return every <tr> in the page as a list of cell strings.
    Cells with only whitespace are preserved as '' to maintain column positions.
    """
    rows = []
    for tr in soup.find_all('tr'):
        cells = [ws(td.get_text(separator=' ')) for td in tr.find_all(['td', 'th'])]
        if any(cells):
            rows.append(cells)
    return rows

def page_text(soup):
    """Flat text for regex-based metadata extraction."""
    parts = []
    for el in soup.find_all(['td', 'th', 'p', 'h1', 'h2', 'h3', 'pre', 'li']):
        t = ws(el.get_text(separator=' '))
        if t:
            parts.append(t)
    return '\n'.join(parts)

# ── METADATA ──────────────────────────────────────────────────────────────────

def parse_metadata(soup, url):
    code = opp_code_from_url(url)

    season_m = re.search(r'/stats/(\d{4}-\d{4})/', url)
    url_season = None
    if season_m:
        y1, y2 = season_m.group(1).split('-')
        url_season = f"{y1}-{y2[2:]}"

    date_str = date_from_url(url, season=url_season)

    h3 = soup.find('h3')
    title = re.sub(r'#\d+\s+', '', ws(h3.get_text()) if h3 else '')
    # Home game: "Opponent vs Massachusetts" — away: "Massachusetts vs Opponent"
    opp_m = re.match(r'^(.+?)\s+vs\.?\s+Massachusetts', title, re.I)
    if opp_m:
        opponent = ws(opp_m.group(1))
    else:
        opp_m = re.match(r'^Massachusetts\s+vs\.?\s+(.+?)(?:\s*\(|$)', title, re.I)
        opponent = ws(opp_m.group(1)) if opp_m else ''
    opponent = re.sub(r'^#\d+\s+', '', opponent).strip()

    # Prefer date from page title over URL
    title_date = re.search(r'\((\d{2}/\d{2}/\d{2})', title)
    if title_date:
        date_str = title_date.group(1)
    if not date_str:
        date_str = '00/00/00'

    text = page_text(soup)
    loc_m  = re.search(r'Location:\s*(.+?)(?=Arena:|$)',      text, re.M)
    aren_m = re.search(r'Arena:\s*(.+?)(?=Attendance:|$)',    text, re.M)
    att_m  = re.search(r'Attendance:\s*(\d+)',                 text)
    st_m   = re.search(r'Start time:\s*([\d:]+\s*[apm]+)',    text, re.I)
    et_m   = re.search(r'End time:\s*([\d:]+\s*[apm]+)',      text, re.I)
    tt_m   = re.search(r'Total time:\s*([\d:]+)',              text)

    return {
        'game_id':    make_game_id(date_str, code),
        'url':        url,
        'date':       date_str,
        'season':     infer_season(date_str),
        'opponent':   opponent,
        'opp_code':   code,
        'location':   ws(loc_m.group(1))  if loc_m  else '',
        'arena':      ws(aren_m.group(1)) if aren_m else '',
        'attendance': int(att_m.group(1)) if att_m  else None,
        'start_time': ws(st_m.group(1))   if st_m   else '',
        'end_time':   ws(et_m.group(1))   if et_m   else '',
        'total_time': ws(tt_m.group(1))   if tt_m   else '',
    }

# ── RESULT & SCORE ────────────────────────────────────────────────────────────

def parse_result(soup, opponent):
    text = page_text(soup)
    opp  = re.escape(opponent)
    uma_first = re.findall(rf'Massachusetts\s+(\d+),\s+{opp}\s+(\d+)', text)
    opp_first = re.findall(rf'{opp}\s+(\d+),\s+Massachusetts\s+(\d+)', text)

    uma_g = opp_g = 0
    if uma_first:
        uma_g, opp_g = int(uma_first[-1][0]), int(uma_first[-1][1])
    elif opp_first:
        uma_g, opp_g = int(opp_first[-1][1]), int(opp_first[-1][0])

    return {
        'score_uma': uma_g,
        'score_opp': opp_g,
        'result':    'W' if uma_g > opp_g else ('L' if uma_g < opp_g else 'T'),
        'overtime':  bool(re.search(r'\b(?:1st OT|2nd OT|OT Period)\b', text)),
        'shootout':  bool(re.search(r'Shootout', text, re.I)),
    }

# ── PERIOD TABLES (goals / shots by period) ───────────────────────────────────

def parse_period_table(rows, opponent, label):
    """
    Find the goals-by-period or shots-by-period table.
    Returns {'uma': [p1,p2,p3], 'opp': [p1,p2,p3]}
    Header row has label text in first cell; data rows follow.
    """
    opp_clean = opponent.lower()
    uma_vals = []
    opp_vals = []
    in_section = False

    for cells in rows:
        non = [c for c in cells if c]
        if not non:
            continue

        # Detect section header: exact match to avoid the giant outer cell triggering
        if non[0].lower() == label.lower():
            in_section = True
            continue

        if not in_section:
            continue

        # Stop at next section
        if any(x in non[0].lower() for x in ['scoring', 'team summ', 'shots by prd',
                                               'saves', 'power play', 'three stars',
                                               'officials', 'penalty']):
            break

        # Data rows: team name + 3 period values + total
        if len(non) >= 4:
            try:
                vals = [int(v) for v in non[1:4]]  # p1, p2, p3
            except ValueError:
                continue
            if 'massachusetts' in non[0].lower():
                uma_vals = vals
            elif opp_clean in non[0].lower() or non[0].lower() in opp_clean:
                opp_vals = vals

        if uma_vals and opp_vals:
            break

    return {'uma': uma_vals, 'opp': opp_vals}

# ── SKATERS ───────────────────────────────────────────────────────────────────

def parse_uma_skaters(rows):
    """
    Parse UMass skater rows from the table.

    Header row cells: ['Massachusetts', 'G', 'A', '1', '2', '3', 'Tot', '+/-', 'Pen', 'Blk']
      or old format:  ['Massachusetts', 'G', 'A', 'Shots', '+/-', 'Pen', 'Blk']

    Data row (no starter marker):  [jersey, name, G, A, (p1,p2,p3,) total, +/-, pen, blk]
    Data row (with starter '*'):   ['*', jersey, name, G, A, (p1,p2,p3,) total, +/-, pen, blk]

    toi always null; fo_won/fo_lost merged in after faceoff parse.
    """
    skaters    = []
    in_section = False
    per_period = False

    for cells in rows:
        non = [c for c in cells if c]
        if not non:
            continue

        # Detect UMass skater header
        if not in_section:
            if (non[0] == 'Massachusetts' and len(non) >= 7
                    and 'G' in non and 'A' in non):
                in_section = True
                per_period = 'Tot' in non or ('1' in non and '2' in non)
                continue
            continue

        # End of skater section
        if non[0].lower().startswith('saves') or non[0].lower().startswith('totals'):
            break
        if any(x in non[0].lower() for x in ['shots by period', 'power play',
                                               'three stars', 'officials']):
            break

        # Strip starter marker if present
        if non[0] == '*':
            non = non[1:]

        # Need at least jersey + name + stats
        if len(non) < 7:
            continue

        # Validate jersey is numeric
        if not non[0].isdigit():
            continue

        try:
            jersey = non[0]
            name   = non[1]

            if per_period and len(non) >= 11:
                g, a         = int(non[2]), int(non[3])
                p1,p2,p3,tot = int(non[4]),int(non[5]),int(non[6]),int(non[7])
                pm_raw       = non[8]
                pen_raw      = non[9]
                blk          = int(non[10])
                shots = {'p1':p1,'p2':p2,'p3':p3,'total':tot}
            else:
                g, a    = int(non[2]), int(non[3])
                tot     = int(non[4])
                pm_raw  = non[5]
                pen_raw = non[6]
                blk     = int(non[7]) if len(non) > 7 else 0
                shots = {'p1':None,'p2':None,'p3':None,'total':tot}

            pm = int(pm_raw.replace('+',''))
            pen_count, pim = parse_pen(pen_raw)

            skaters.append({
                'player':     normalize_name(name),
                'number':     jersey,
                'g':          g,
                'a':          a,
                'shots':      shots,
                'plus_minus': pm,
                'pim':        pim,
                'pen_count':  pen_count,
                'blk':        blk,
                'toi':        None,
                'fo_won':     None,
                'fo_lost':    None,
            })
        except (ValueError, IndexError):
            continue

    return skaters

# ── GOALIES ───────────────────────────────────────────────────────────────────

def _parse_goalies_for_team(rows, team_name, is_uma=True):
    """
    Generalized goalie parser for any team.
    Header: [team_name, 'Dec', 'Minutes', 'GA', 'EN', '1st', '2nd', '3rd', 'Total']
    For UMass (is_uma=True): section ends at Shots by Period / Power Play etc.
    For opponent (is_uma=False): section ends when Massachusetts appears as a header.
    """
    goalies    = []
    in_section = False

    for cells in rows:
        non = [c for c in cells if c]
        if not non:
            continue

        if not in_section:
            # len guard excludes giant outer cell; exact match on team name
            if len(non) <= 15 and non[0] == team_name and 'Dec' in non and 'Minutes' in non:
                in_section = True
                continue
            continue

        # End conditions
        if non[0].upper() == 'TM':
            continue
        if is_uma:
            # 'shots by prd' is the header that immediately follows UMass goalies
            # and begins the opponent's skater section — must stop here
            if any(x in non[0].lower() for x in ['shots by period', 'shots by prd',
                                                   'power play', 'three stars',
                                                   'officials', 'penalty']):
                break
        else:
            # Opponent goalie section ends when Massachusetts team section begins
            if non[0] == 'Massachusetts':
                break
            if any(x in non[0].lower() for x in ['shots by period', 'three stars',
                                                   'officials', 'penalty']):
                break

        if len(non) < 9 or not non[0].isdigit():
            continue

        try:
            jersey   = non[0]
            name     = non[1]
            dec      = non[2].replace('W-OT','W').replace('L-OT','L')
            toi      = non[3]
            ga       = int(non[4])
            en       = int(non[5])
            sv1,sv2,sv3,sv_tot = int(non[6]),int(non[7]),int(non[8]),int(non[9])
            sa       = sv_tot + ga

            goalies.append({
                'player':  fix_name(normalize_name(name)),
                'number':  jersey,
                'dec':     dec,
                'toi':     toi,
                'ga':      ga,
                'en':      en,
                'saves':   {'p1':sv1,'p2':sv2,'p3':sv3,'total':sv_tot},
                'sa':      sa,
                'sv_pct':  round(sv_tot/sa, 4) if sa > 0 else None,
            })
        except (ValueError, IndexError):
            continue

    return goalies

def parse_uma_goalies(rows):
    return _parse_goalies_for_team(rows, 'Massachusetts', is_uma=True)

def parse_opp_goalies(rows, opponent):
    return _parse_goalies_for_team(rows, opponent, is_uma=False)

# ── SCORING SUMMARY ───────────────────────────────────────────────────────────

def parse_scoring(soup, opponent):
    """
    The scoring rows live in the big page text as:
    '1. 1st 03:28 UMASS EVEN Musa, Jack/1 DeAngelo, Mikey/1 4,16,10,12,2 9,19,17,13,18'
    Parse from the single large td cell that contains the whole box score.
    """
    # Find the big cell containing the scoring summary
    text = ''
    for td in soup.find_all('td'):
        t = ws(td.get_text(separator=' '))
        if 'Scoring Summary' in t and 'Team Summaries' in t:
            text = t
            break

    if not text:
        text = page_text(soup)

    goals = []

    # Each goal: "N. Period Time Team Type Scorer/N Assist1/N [Assist2/N] vis_ice home_ice"
    # We'll find all "N." markers and slice the text between them
    goal_starts = [(m.start(), m.group(1)) for m in
                   re.finditer(r'\b(\d+)\.\s+(?:1st|2nd|3rd|OT)', text)]

    for idx, (start, num) in enumerate(goal_starts):
        end = goal_starts[idx+1][0] if idx+1 < len(goal_starts) else len(text)
        chunk = ws(text[start:end])

        m = re.match(
            r'(\d+)\.\s+'                          # goal #
            r'(\w+)\s+'                            # period
            r'([\d:]+)\s+'                         # time
            r'(\w+)\s+'                            # team
            r'(EVEN|EV|PP|SH|EN|EA|EX)\s+'         # type (EX = extra attacker/6-on-5)
            r'(.+)',                                # rest
            chunk, re.I
        )
        if not m:
            continue

        team_raw = m.group(4).upper()
        is_uma   = team_raw in UMA_ABBREVS
        rest     = m.group(6)

        # All "Name/N" patterns
        players = re.findall(r'([A-Z][^/\d]+)/(\d+)', rest)
        scorer  = normalize_name(players[0][0]) if players else ''
        assists = [normalize_name(p[0]) for p in players[1:]]

        # On-ice jersey lists
        on_ice   = re.findall(r'\b(\d{1,2}(?:,\d{1,2})+)\b', rest)
        vis_ice  = on_ice[0].split(',') if len(on_ice) > 0 else []
        home_ice = on_ice[1].split(',') if len(on_ice) > 1 else []

        goals.append({
            'goal_num':    int(m.group(1)),
            'period':      m.group(2),
            'time':        m.group(3),
            'team':        'UMass' if is_uma else opponent,
            'type':        'EVEN' if m.group(5).upper() in ('EV','EVEN') else m.group(5).upper(),
            'scorer':      scorer,
            'assists':     assists,
            'on_ice_vis':  vis_ice,
            'on_ice_home': home_ice,
            'empty_net':   m.group(5).upper() == 'EN',
        })

    return goals

# ── PENALTIES ─────────────────────────────────────────────────────────────────

def parse_penalties(rows):
    """
    Header row contains 'Prd', 'Player', 'Team', 'Min', 'Offense', 'Time'.
    Data rows: [period, player, team, min, offense, time, (PP)?]
    """
    penalties  = []
    in_section = False
    periods    = {'1st','2nd','3rd','OT'}

    for cells in rows:
        non = [c for c in cells if c]
        if not non:
            continue

        if not in_section:
            if non[0] == 'Prd' and 'Player' in non and 'Team' in non:
                in_section = True
                continue
            continue

        # End of section
        if non[0].endswith('- Faceoffs') or non[0].endswith('Faceoffs'):
            break
        if 'Massachusetts' in non[0] and 'Faceoffs' in ' '.join(non):
            break

        if len(non) < 5:
            continue
        if non[0] not in periods:
            continue

        try:
            team_raw = non[2].upper()
            is_uma   = team_raw in UMA_ABBREVS
            penalties.append({
                'period':   non[0],
                'player':   normalize_name(non[1]),
                'team':     'UMass' if is_uma else 'Opponent',
                'team_raw': non[2],
                'min':      int(non[3]),
                'offense':  non[4],
                'time':     non[5] if len(non) > 5 else '',
            })
        except (ValueError, IndexError):
            continue

    return penalties

# ── FACEOFFS ─────────────────────────────────────────────────────────────────

def parse_uma_faceoffs(rows):
    """
    Section header: row where joined text contains 'Massachusetts' and 'Faceoffs'.
    Data rows: [jersey, name, W, L]
    """
    faceoffs   = {}
    in_section = False

    for cells in rows:
        non = [c for c in cells if c]
        if not non:
            continue

        joined = ' '.join(non)

        if not in_section:
            # len(non) guard excludes the giant outer cell (hundreds of cells)
            if len(non) <= 15 and 'Massachusetts' in joined and 'Faceoffs' in joined:
                in_section = True
                continue
            continue

        # End of section
        if 'Faceoffs' in joined or 'Power Play Summary' in joined:
            break

        # Skip header row; Totals ends the section
        if non[0] in ('##', 'Player'):
            continue
        if non[0].startswith('Totals'):
            break

        if len(non) < 4:
            continue
        if not non[0].isdigit():
            continue

        try:
            name = normalize_name(non[1])
            faceoffs[name] = {'fo_won': int(non[2]), 'fo_lost': int(non[3])}
        except (ValueError, IndexError):
            continue

    return faceoffs

# ── POWER PLAY ────────────────────────────────────────────────────────────────

def parse_power_play(rows):
    """Find the Massachusetts PP summary line."""
    in_section = False

    for cells in rows:
        non = [c for c in cells if c]
        if not non:
            continue

        joined = ' '.join(non)

        if not in_section:
            # len(non) guard excludes the giant outer cell
            if len(non) <= 15 and 'Massachusetts' in joined and 'Power Play Summary' in joined:
                in_section = True
                continue
            continue

        m = re.search(r'SUMMARY:\s*(\d+)\s+opps?,\s*(\d+)\s+shots?,\s*(\d+)\s+goals?',
                      joined, re.I)
        if m:
            return {'opp': int(m.group(1)), 'shots': int(m.group(2)), 'g': int(m.group(3))}

    return None

# ── OFFICIALS & THREE STARS ───────────────────────────────────────────────────

def parse_officials(soup):
    text = page_text(soup)
    m    = re.search(r'Officials:\s*(.+?)(?:\n|$)', text)
    if not m:
        return {}
    raw  = ws(m.group(1))
    refs = re.findall(r'Referee:([^RL]+?)(?=Referee:|Linesman:|$)', raw)
    lins = re.findall(r'Linesman:([^RL]+?)(?=Linesman:|Referee:|$)', raw)
    return {'referees': [ws(r) for r in refs], 'linesmen': [ws(l) for l in lins]}

def parse_three_stars(soup):
    text = page_text(soup)
    m    = re.search(r'Three stars:\s*1\.\s*(.+?)\s+2\.\s*(.+?)\s+3\.\s*(.+?)(?:\n|$)', text, re.I)
    if not m:
        return [None, None, None]
    return [None if 'None' in g else ws(g) for g in (m.group(1), m.group(2), m.group(3))]

# ── DEBUG MODE ────────────────────────────────────────────────────────────────

def debug_page(soup, url):
    print(f"\n{'='*72}\nDEBUG: {url}\n{'='*72}\n")
    rows = get_all_rows(soup)
    print(f"── {len(rows)} table rows ──────────────────────────────────────────────")
    for i, cells in enumerate(rows[:120]):
        non = [c for c in cells if c]
        if non:
            print(f"  {i:3}: {' | '.join(non)}")

# ── MAIN PARSER ───────────────────────────────────────────────────────────────

def fetch_soup(url):
    resp = requests.get(url, timeout=20)
    resp.encoding = 'utf-8'
    return BeautifulSoup(resp.text, 'html.parser')

def parse_boxscore(url, debug=False):
    soup = fetch_soup(url)

    if debug:
        debug_page(soup, url)
        return None

    rows     = get_all_rows(soup)
    meta     = parse_metadata(soup, url)
    opponent = meta['opponent']

    skaters  = parse_uma_skaters(rows)
    faceoffs = parse_uma_faceoffs(rows)

    for s in skaters:
        fo = faceoffs.get(s['player'], {})
        s['fo_won']  = fo.get('fo_won')
        s['fo_lost'] = fo.get('fo_lost')

    return {
        **meta,
        **parse_result(soup, opponent),
        'goals_by_period': parse_period_table(rows, opponent, 'Goals by Period'),
        'shots_by_period': parse_period_table(rows, opponent, 'Shots by Period'),
        'power_play_uma':  parse_power_play(rows),
        'skaters':         skaters,
        'goalies':         parse_uma_goalies(rows),
        'opp_goalies':     parse_opp_goalies(rows, opponent),
        'scoring':         parse_scoring(soup, opponent),
        'penalties':       parse_penalties(rows),
        'three_stars':     parse_three_stars(soup),
        'officials':       parse_officials(soup),
        'recap':           '',
        'recap_url':       '',
    }

# ── SEASON URL DISCOVERY ─────────────────────────────────────────────────────

def get_season_urls(season):
    parts  = season.split('-')
    y1     = parts[0]
    y2_4d  = y1[:2] + parts[1]
    season_path = f"{y1}-{y2_4d}"
    teamgbg_url = (f"https://static.umassathletics.com/custompages/sports/"
                   f"m-hockey/stats/{season_path}/teamgbg.htm")

    print(f"  Fetching schedule from {teamgbg_url} ...")
    resp = requests.get(teamgbg_url, timeout=20)
    resp.encoding = 'utf-8'
    soup = BeautifulSoup(resp.text, 'html.parser')

    base = (f"https://static.umassathletics.com/custompages/sports/"
            f"m-hockey/stats/{season_path}/")

    urls = []
    seen = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith(base):
            fn = href[len(base):]
        elif re.match(r'^\d+[a-z]*\.htm$', href, re.I):
            fn = href
        else:
            continue
        # Must be digits (+ optional letters) — exclude nav pages (team*, plyr_*)
        if not re.match(r'^\d+[a-z]*\.htm$', fn, re.I):
            continue
        if re.match(r'^(team|plyr_)', fn, re.I):
            continue
        full = base + fn
        if full not in seen:
            seen.add(full)
            urls.append(full)

    if not urls:
        raise ValueError(f"No box score URLs found on {teamgbg_url}")

    print(f"  Found {len(urls)} games for {season}")
    return urls

# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description='Parse UMass hockey box score pages.')
    ap.add_argument('url',     nargs='?', help='Single box score URL')
    ap.add_argument('--out',    help='Output JSON file (default: stdout)')
    ap.add_argument('--debug',  action='store_true', help='Dump raw row structure')
    ap.add_argument('--list',   help='Text file with one URL per line')
    ap.add_argument('--season', help='Auto-discover season games, e.g. 2025-26')
    ap.add_argument('--outdir', default='.', help='Output dir for batch mode')
    args = ap.parse_args()

    def run_batch(urls):
        os.makedirs(args.outdir, exist_ok=True)
        ok = err = 0
        for url in urls:
            print(f"  fetch  {url} ...", end=' ', flush=True)
            try:
                data = parse_boxscore(url)
                fn   = os.path.join(args.outdir, data['game_id'] + '.json')
                with open(fn, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"→ {os.path.basename(fn)}  "
                      f"({data['result']} {data['score_uma']}-{data['score_opp']}"
                      f" vs {data['opponent']}, {len(data['skaters'])} skaters)")
                ok += 1
            except Exception as e:
                print(f"ERROR: {e}")
                err += 1
        print(f"\nDone: {ok} ok, {err} errors")

    if args.season and not args.url:
        run_batch(get_season_urls(args.season))
        return

    if args.list:
        with open(args.list) as f:
            urls = [l.strip() for l in f if l.strip() and not l.startswith('#')]
        run_batch(urls)
        return

    if not args.url:
        ap.print_help()
        sys.exit(1)

    data = parse_boxscore(args.url, debug=args.debug)
    if data is None:
        return

    output = json.dumps(data, indent=2, ensure_ascii=False)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"Written to {args.out}")
    else:
        print(output)

if __name__ == '__main__':
    main()
