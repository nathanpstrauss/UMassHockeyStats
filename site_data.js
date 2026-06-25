// UMass Hockey Stats - Shared Player Data
// Single source of truth for draft + transfer info
// Edit here -> all pages update automatically

const DRAFT_MAP = {
  "Justin Braun": {
    "team": "SJS",
    "round": 7,
    "pick": 201,
    "year": 2007
  },
  "Ivan Chukarov": {
    "team": "BUF",
    "round": 7,
    "pick": 182,
    "year": 2015
  },
  "Kenny Connors": {
    "team": "LAK",
    "round": 4,
    "pick": 103,
    "year": 2022
  },
  "Marc Del Gaizo": {
    "team": "NSH",
    "round": 4,
    "pick": 109,
    "year": 2019
  },
  "Tyson Dyck": {
    "team": "OTT",
    "round": 7,
    "pick": 206,
    "year": 2022
  },
  "Mario Ferraro": {
    "team": "SJS",
    "round": 2,
    "pick": 49,
    "year": 2017
  },
  "Mike Gaffney": {
    "team": "OTT",
    "round": 6,
    "pick": 131,
    "year": 1994
  },
  "Dale Hooper": {
    "team": "MTL",
    "round": 12,
    "pick": 259,
    "year": 1991
  },
  "Scott Horvath": {
    "team": "COL",
    "round": 6,
    "pick": 184,
    "year": 2001
  },
  "Michael Hrabal": {
    "team": "ARI",
    "round": 2,
    "pick": 38,
    "year": 2023
  },
  "Kevin Jarman": {
    "team": "CBJ",
    "round": 4,
    "pick": 103,
    "year": 2003
  },
  "Zac Jones": {
    "team": "NYR",
    "round": 3,
    "pick": 68,
    "year": 2019
  },
  "Dan Juden": {
    "team": "TBL",
    "round": 6,
    "pick": 137,
    "year": 1994
  },
  "Larry Keenan": {
    "team": "DET",
    "round": 4,
    "pick": 117,
    "year": 2023
  },
  "William Lagesson": {
    "team": "EDM",
    "round": 4,
    "pick": 91,
    "year": 2014
  },
  "John Leonard": {
    "team": "SJS",
    "round": 6,
    "pick": 182,
    "year": 2018
  },
  "Filip Lindberg": {
    "team": "MIN",
    "round": 7,
    "pick": 197,
    "year": 2019
  },
  "Dans Locmelis": {
    "team": "BOS",
    "round": 4,
    "pick": 119,
    "year": 2022
  },
  "Josh Lopina": {
    "team": "ANA",
    "round": 4,
    "pick": 98,
    "year": 2021
  },
  "Paul Lynch": {
    "team": "TBL",
    "round": 5,
    "pick": 138,
    "year": 2001
  },
  "Steve MacKinnon": {
    "team": "OTT",
    "round": 10,
    "pick": 237,
    "year": 1994
  },
  "Cale Makar": {
    "team": "COL",
    "round": 1,
    "pick": 4,
    "year": 2017
  },
  "Taylor Makar": {
    "team": "COL",
    "round": 7,
    "pick": 220,
    "year": 2021
  },
  "Greg Mauldin": {
    "team": "CBJ",
    "round": 7,
    "pick": 199,
    "year": 2002
  },
  "Brandon Montour": {
    "team": "ANA",
    "round": 2,
    "pick": 55,
    "year": 2014
  },
  "Scott Morrow": {
    "team": "CAR",
    "round": 2,
    "pick": 40,
    "year": 2021
  },
  "Vaclav Nestrasil": {
    "team": "CHI",
    "round": 1,
    "pick": 25,
    "year": 2025
  },
  "Martin Nolet": {
    "team": "LAK",
    "round": 5,
    "pick": 144,
    "year": 2006
  },
  "Brad Norton": {
    "team": "Edmonton",
    "round": 9,
    "pick": 215,
    "year": 1993
  },
  "Jon Quick": {
    "team": "LAK",
    "round": 3,
    "pick": 72,
    "year": 2005
  },
  "Brian Regan": {
    "team": "HFD",
    "round": 10,
    "pick": 239,
    "year": 1994
  },
  "Aydar Suniev": {
    "team": "CGY",
    "round": 3,
    "pick": 80,
    "year": 2023
  },
  "John Toffey": {
    "team": "TBL",
    "round": 9,
    "pick": 287,
    "year": 2002
  },
  "Ryan Ufko": {
    "team": "NSH",
    "round": 4,
    "pick": 115,
    "year": 2021
  },
  "Stephen Werner": {
    "team": "WSH",
    "round": 3,
    "pick": 83,
    "year": 2003
  },
  "John Wessbecker": {
    "team": "TBL",
    "round": 7,
    "pick": 225,
    "year": 2005
  },
  "Lucas Mercuri": {
    "team": "TBL",
    "round": 5,
    "pick": 159,
    "year": 2020
  },
  "Cole O'Hara": {
    "team": "NSH",
    "round": 4,
    "pick": 114,
    "year": 2022
  },
  "Cameron O'Neill": {
    "team": "OTT",
    "round": 5,
    "pick": 143,
    "year": 2022
  },
  "Francesco Dell'Elce": {
    "team": "COL",
    "round": 3,
    "pick": 77,
    "year": 2025
  },
  "Maxim Masse": {
    "team": "ANA",
    "round": 3,
    "pick": 66,
    "year": 2024
  },
  "Max Curran": {
    "team": "CGY",
    "round": 5,
    "pick": 161,
    "year": 2024
  },
  "Melvin Novotny": {
    "team": "BUF",
    "round": 7,
    "pick": 195,
    "year": 2025
  },
  "Arsenii Radkov": {
    "team": "MTL",
    "round": 3,
    "pick": 82,
    "year": 2025
  },
  "Alex Berry": {
    "team": "TOR",
    "round": 5,
    "pick": 153,
    "year": 2005
  },
  "Danny Hobbs": {
    "team": "NYR",
    "round": 7,
    "pick": 198,
    "year": 2007
  },
  "Matt Irwin": {
    "team": "SJS",
    "round": 10,
    "pick": 289,
    "year": 2008
  },
  "Casey Wellman": {
    "team": "WSH",
    "round": 5,
    "pick": 130,
    "year": 2007
  },
  "Conor Sheary": {
    "team": "BOS",
    "round": 7,
    "pick": 184,
    "year": 2011
  },
  "Joel Hanley": {
    "team": "MTL",
    "round": 6,
    "pick": 168,
    "year": 2011
  },
  "Shane Walsh": {
    "team": "CGY",
    "round": 6,
    "pick": 166,
    "year": 2013
  },
  "Frank Vatrano": {
    "team": "BOS",
    "round": 6,
    "pick": 156,
    "year": 2014
  },
  "P.J. Fenton": {
    "team": "San Jose",
    "round": 5,
    "pick": 162,
    "year": 2005
  },
  "Ben Gallacher": {
    "team": "FLA",
    "round": 4,
    "pick": 93,
    "year": 2010
  },
  "Liam Gorman": {
    "team": "PIT",
    "round": 6,
    "pick": 177,
    "year": 2018
  },
  "Slava Demin": {
    "team": "VGK",
    "round": 4,
    "pick": 99,
    "year": 2018
  },
  "Josh Nodler": {
    "team": "CGY",
    "round": 5,
    "pick": 150,
    "year": 2019
  },
  "Cole Brady": {
    "team": "NJD",
    "round": 5,
    "pick": 127,
    "year": 2019
  },
  "Matthew Kessel": {
    "team": "STL",
    "round": 5,
    "pick": 150,
    "year": 2020
  },
  "Noah Ellis": {
    "team": "VGK",
    "round": 6,
    "pick": 184,
    "year": 2020
  },
  "Owen Mehlenbacher": {
    "team": "DET",
    "round": 7,
    "pick": 201,
    "year": 2022
  },
  "Nick VanTassell": {
    "team": "OTT",
    "round": 7,
    "pick": 215,
    "year": 2023
  },
  "Tom O'Connor": {
    "team": "PIT",
    "round": 4,
    "pick": 102,
    "year": 1992
  }
};

const TRANSFER_IN_MAP = {
  "John McNelis": "Boston University",
  "Liam Gorman": "Princeton",
  "Cole Brady": "Arizona State",
  "Slava Demin": "Denver",
  "Michael DeAngelo": "Michigan State",
  "Gavin Cornforth": "Boston College",
  "Owen Mehlenbacher": "Wisconsin",
  "Lucas Olvestad": "Denver",
  "Jacob Pritchard": "St. Lawrence",
  "Garrett Wait": "Minnesota",
  "Jerry Harding": "Providence",
  "Cam Donaldson": "Cornell",
  "Matt Baker": "Dartmouth",
  "Lucas Vanroboys": "Bentley",
  "Christian Sanda": "Union",
  "Matthew Wilde": "RIT",
  "Joey Musa": "Dartmouth",
  "Elliott McDermott": "Union",
  "Matt Koopman": "Providence",
  "Samuli Niinisaari": "Brown",
  "Carson Gicewicz": "St. Lawrence",
  "Brett Boeing": "Michigan Tech",
  "Josh Couturier": "Boston College"
};

const TRANSFER_OUT_MAP = {
  "Elias Zimmerman": "Colgate",
  "Matthew Wilde": "RIT",
  "James Duerr": "Bentley",
  "Owen Mehlenbacher": "Ferris State",
  "Andrew Lacroix": "Holy Cross",
  "Nick VanTassell": "New Hampshire",
  "Bo Cosman": "Unknown",
  "Kaz Sobieski": "RPI",
  "Finn Loftus": "St. Cloud State",
  "Aaron Bohlinger": "Quinnipiac",
  "Elliott McDermott": "RPI",
  "Taylor Makar": "Maine",
  "Luke Pavicich": "UMass Lowell",
  "Mikey Adamson": "Sacred Heart",
  "Cal Kiefiuk": "Providence",
  "Ryan Sullivan": "Miami (OH)",
  "Noah Ellis": "Omaha",
  "Henry Graham": "Boston University",
  "Tyson Dyck": "Wisconsin",
  "Ty Farmer": "North Dakota",
  "Oliver MacDonald": "Western Michigan",
  "Slava Demin": "Merrimack",
  "Philip Lagunov": "Vermont",
  "Gianfranco Cassaro": "RIT",
  "Jeremy Davidson": "Michigan State",
  "Marco Bozzo": "Northeastern",
  "Peyton Reeves": "Toronto",
  "Sebastian Tornqvist": "Vermont",
  "Eric DeDobbelaer": "Robert Morris",
  "Jonny Lazarus": "Mercyhurst",
  "Austin Albrecht": "AIC",
  "Brad Arvanitis": "Babson",
  "Griff Jeszka": "Merrimack",
  "Shane Bear": "RPI",
  "Austin Plevy": "Northeastern"
};

// ─── Canonical name aliases ────────────────────────────────────────────────
// Maps any known name variant → canonical ASCII key used in DRAFT_MAP.
// Allows roster pages and other consumers to call DRAFT_MAP[canonical(p.name)]
// without needing to know which exact form the data uses.
const ALIASES = {
  // Curly-apostrophe variants → ASCII canonical
  "Francesco Dell’Elce":  "Francesco Dell'Elce",
  "Cole O’Hara":          "Cole O'Hara",
  "Cameron O’Neill":      "Cameron O'Neill",
  "Cam O’Neill":          "Cameron O'Neill",
  "Cam O'Neill":               "Cameron O'Neill",
  // Nickname variants
  "Mikey DeAngelo":            "Michael DeAngelo",
  "Cam Dunn":                  "Cameron Dunn",
  // Diacritic → ASCII canonical
  "Václav Nestrašil": "Vaclav Nestrasil",
  "Daniel Jenčko":         "Daniel Alexander Jencko",
  "Lucas Ölvestad":        "Lucas Olvestad",
  "Thomas Pöck":           "Thomas Pock",
  "Toni Söderholm":        "Toni Soderholm",
  "Lukas Klečka":          "Lukas Klecka",
  "Maxim Massé":           "Maxim Masse",
  "Sebastian Törnqvist":   "Sebastian Tornqvist",
  "Sebastian Tčrnqvist":   "Sebastian Tornqvist",
  // Other name variants
  "Yegor Barabanov":            "Egor Barabanov",
  "Kennedy O’Connor":      "Kennedy O'Connor",
  // Pro-data reconciliation variants (→ canonical PRO_STATS key)
  "Finnegan Loftus":       "Finn Loftus",
  "Kazimier Sobieski":     "Kaz Sobieski",
  "Calen Kiefiuk":         "Cal Kiefiuk",
  "Matt Kessel":           "Matthew Kessel",
  "Matthew Murray":        "Matt Murray",
  "Jonathan Lazarus":      "Jonny Lazarus",
  "Mike Marcou":           "Michael Marcou",
  "Corey Quirk":           "Cory Quirk",
  "Michael Kostka":        "Mike Kostka",
  "Jonathan Quick":        "Jon Quick",
  "Thomas Poeck":          "Thomas Pock",
  "Mike Mullen":           "Michael Mullen",
};
function canonical(name){ return ALIASES[name] || name; }

// ─── Display names ─────────────────────────────────────────────
// Canonical ASCII key → accented/preferred display form. Consumers that
// iterate canonical keys (e.g. the Minutemen in the Pros page reading
// PRO_STATS) call displayName() to render the proper accented name.
const DISPLAY_NAMES = {
  "Thomas Pock":          "Thomas Pöck",
  "Toni Soderholm":       "Toni Söderholm",
  "Sebastian Tornqvist":  "Sebastian Törnqvist",
  "Vaclav Nestrasil":     "Václav Nestrašil",
  "Maxim Masse":          "Maxim Massé",
};
function displayName(name){ return DISPLAY_NAMES[name] || name; }
