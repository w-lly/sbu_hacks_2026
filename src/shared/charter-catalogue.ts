/**
 * Charter catalogue: curated real districts + cached scenario per map.
 * To add a map: add the curated districts and cached scenario here
 * and register its JSON in src/backend/services/maps.server.ts.
 */
import type { Difficulty, DistrictSeed, Scenario, StartingKit } from "@/shared/types";

export interface CharterDef {
  slug: string;
  name: string;
  difficulty: Difficulty;
  blurb: string;
  districts: DistrictSeed[];
  start: StartingKit;
  scenario: Scenario;
}

const d = (
  id: string,
  realName: string,
  kind: DistrictSeed["kind"],
  lat: number,
  lng: number,
  demand = 1,
): DistrictSeed => ({ id, realName, kind, lat, lng, demand });

export const CHARTERS: CharterDef[] = [
  {
    slug: "setauket",
    name: "Setauket & Stony Brook",
    difficulty: "Tutorial",
    blurb: "Harbor villages, a university and a ferry wharf. A gentle first survey of the North Shore.",
    start: { track: 100000, locomotives: 3, carriages: 1, bridges: 2, tunnels: 0, interchanges: 0, tubes: 1 },
    districts: [
      d("sbu", "Stony Brook University", "student", 40.9126, -73.1234, 1.4),
      d("sb", "Stony Brook Village", "shopper", 40.9165, -73.1455),
      d("set", "East Setauket", "commuter", 40.9365, -73.1015),
      d("pj", "Port Jefferson", "shopper", 40.9445, -73.0685, 1.2),
      d("pjs", "Port Jefferson Station", "commuter", 40.9255, -73.0475),
      d("sj", "St. James", "commuter", 40.879, -73.157),
      d("lg", "Lake Grove", "shopper", 40.8625, -73.115),
      d("ce", "Centereach", "commuter", 40.8585, -73.082),
      d("ofl", "Old Field", "commuter", 40.958, -73.133, 0.7),
      d("ss", "South Setauket", "student", 40.889, -73.095),
      d("mp", "Mount Sinai", "commuter", 40.945, -73.035, 0.8),
    ],
    scenario: {
      title: "The North Shore Charter",
      source: "cache",
      demand: { commuter: 1, student: 1.1, shopper: 0.9 },
      districts: [
        {
          id: "sbu",
          name: "Institute of Natural Philosophy",
          lore: "A domed academy where students tinker with aether engines.",
        },
        { id: "sb", name: "Stony Brook Gristmill", lore: "The old mill village, now a market of brass trinkets." },
        { id: "set", name: "Setauket Signal Green", lore: "Home of spymasters' heirs and quiet commuters." },
        {
          id: "pj",
          name: "Port Jefferson Ferry Wharf",
          lore: "Steam ferries to Bridgeport unload shoppers by the hundred.",
        },
        { id: "pjs", name: "Comsewogue Rail Yards", lore: "Terminus of the Long Island line, thick with soot." },
        { id: "sj", name: "St. James Estates", lore: "Gilded mansions whose clerks ride in each dawn." },
        { id: "lg", name: "Lake Grove Bazaar", lore: "A glass-roofed arcade by the kettle pond." },
        { id: "ce", name: "Centereach Crossroads", lore: "Farm hamlet turned boarding-house town." },
        { id: "ofl", name: "Old Field Lighthouse", lore: "Keepers and fishermen at the edge of the Sound." },
        { id: "ss", name: "Setauket Draughting School", lore: "Apprentices learning to draw boilers." },
        { id: "mp", name: "Mount Sinai Harbour", lore: "Oystermen who rise before the sun." },
      ],
      events: [
        {
          week: 2,
          districtId: "pj",
          title: "The Bridgeport Ferry Arrives",
          description: "A paddle steamer docks with a full deck.",
          multiplier: 3,
          duration: 25,
        },
        {
          week: 4,
          districtId: "sbu",
          title: "Exhibition of Electrical Marvels",
          description: "Students flock to the Institute.",
          multiplier: 3,
          duration: 30,
        },
        {
          week: 6,
          districtId: "lg",
          title: "Harvest Fair at the Bazaar",
          description: "Every shopper on the shore wants in.",
          multiplier: 3.5,
          duration: 30,
        },
      ],
    },
  },
  {
    slug: "manhattan",
    name: "Lower Manhattan & Brooklyn",
    difficulty: "Hard",
    blurb: "Two shores and a river between. Every crossing is costly, so every line must earn its tunnel.",
    start: { track: 1300, locomotives: 2, carriages: 1, bridges: 1, tunnels: 1, interchanges: 0, tubes: 1 },
    districts: [
      d("bat", "Battery Park", "commuter", 40.7045, -74.0145, 1.2),
      d("wall", "Wall Street", "commuter", 40.7065, -74.009, 1.5),
      d("ch", "City Hall", "shopper", 40.713, -74.006, 1.2),
      d("les", "Lower East Side", "commuter", 40.715, -73.987),
      d("gv", "Greenwich Village", "student", 40.7335, -74.001),
      d("us", "Union Square", "shopper", 40.736, -73.9905),
      d("ev", "East Village", "student", 40.7265, -73.9815),
      d("bh", "Brooklyn Heights", "commuter", 40.696, -73.9935),
      d("dumbo", "DUMBO", "shopper", 40.7025, -73.988),
      d("ny", "Brooklyn Navy Yard", "commuter", 40.7, -73.97, 1.3),
      d("wb", "Williamsburg", "commuter", 40.713, -73.957),
      d("fg", "Pratt Institute", "student", 40.691, -73.964),
      d("ps", "Park Slope", "commuter", 40.672, -73.978),
      d("gp", "Greenpoint", "student", 40.73, -73.953),
      d("rh", "Red Hook", "shopper", 40.677, -74.006),
    ],
    scenario: {
      title: "The East River Concession",
      source: "cache",
      demand: { commuter: 1.3, student: 0.9, shopper: 1 },
      districts: [
        { id: "bat", name: "Battery Customs House", lore: "Where steamers unload clerks and cargo." },
        { id: "wall", name: "Exchange Row", lore: "Tickers clatter; brokers sprint for the 8:05." },
        { id: "ch", name: "City Hall Rotunda", lore: "Above Beach's secret pneumatic tunnel of 1870." },
        { id: "les", name: "Tenement Quarter", lore: "Packed lodgings of the garment trade." },
        { id: "gv", name: "Greenwich Studios", lore: "Painters, poets and impoverished inventors." },
        { id: "us", name: "Ladies' Mile Arcade", lore: "The great department stores of Union Square." },
        { id: "ev", name: "Cooper Union Workshops", lore: "Free classes in science and art." },
        { id: "bh", name: "Brooklyn Heights Promenade", lore: "Merchants watch their ships from the bluff." },
        { id: "dumbo", name: "Gaslight Warehouses", lore: "Coffee, cardboard and the clamour of looms." },
        { id: "ny", name: "Navy Yard Foundry", lore: "Ironclads and the men who rivet them." },
        { id: "wb", name: "Williamsburg Refinery", lore: "The sugar works run three shifts." },
        { id: "fg", name: "Pratt Mechanics Institute", lore: "Draughtsmen of tomorrow's engines." },
        { id: "ps", name: "Park Slope Terraces", lore: "Brownstones of the new professional class." },
        { id: "gp", name: "Greenpoint Ropewalk", lore: "Shipwright apprentices and rope makers." },
        { id: "rh", name: "Red Hook Grain Docks", lore: "Elevators and longshoremen's markets." },
      ],
      events: [
        {
          week: 2,
          districtId: "wall",
          title: "Panic on the Exchange",
          description: "Every broker rushes downtown at once.",
          multiplier: 3,
          duration: 25,
        },
        {
          week: 4,
          districtId: "ny",
          title: "Ironclad Launch",
          description: "Crowds gather to see the new hull slide in.",
          multiplier: 3,
          duration: 30,
        },
        {
          week: 6,
          districtId: "us",
          title: "Grand Christmas Sale",
          description: "The Ladies' Mile is mobbed.",
          multiplier: 3.5,
          duration: 30,
        },
      ],
    },
  },
  {
    slug: "nassau",
    name: "Nassau Corridor",
    difficulty: "Medium",
    blurb: "A dense suburban grid with long commutes. Clever hubs earn the best grades.",
    start: { track: 1400, locomotives: 2, carriages: 0, bridges: 1, tunnels: 0, interchanges: 1, tubes: 1 },
    districts: [
      d("hem", "Hempstead", "shopper", 40.7062, -73.6187, 1.3),
      d("gc", "Garden City", "commuter", 40.7268, -73.6343),
      d("hof", "Hofstra University", "student", 40.7146, -73.6004, 1.3),
      d("min", "Mineola", "commuter", 40.749, -73.6407, 1.2),
      d("wb", "Westbury", "commuter", 40.7557, -73.5876),
      d("rvc", "Rockville Centre", "shopper", 40.6587, -73.641),
      d("ff", "Franklin Square", "commuter", 40.7073, -73.676),
      d("uni", "Uniondale", "shopper", 40.7004, -73.5932),
      d("nhp", "New Hyde Park", "commuter", 40.7351, -73.6879),
      d("adl", "Adelphi University", "student", 40.721, -73.652),
      d("wh", "West Hempstead", "commuter", 40.6948, -73.6501),
      d("cp", "Carle Place", "commuter", 40.7512, -73.6104),
      d("lyn", "Lynbrook", "student", 40.6548, -73.6718),
    ],
    scenario: {
      title: "The Hempstead Plains Franchise",
      source: "cache",
      demand: { commuter: 1.4, student: 0.9, shopper: 0.9 },
      districts: [
        { id: "hem", name: "Hempstead Exchange", lore: "The old village seat and its busy market." },
        { id: "gc", name: "Cathedral of Garden City", lore: "A.T. Stewart's planned town of tidy lawns." },
        { id: "hof", name: "Hofstra Academy", lore: "A mansion turned lecture hall." },
        { id: "min", name: "Mineola Junction", lore: "Where every line on the Plains meets." },
        { id: "wb", name: "Westbury Stables", lore: "Polo grounds and the grooms who tend them." },
        { id: "rvc", name: "Rockville Centre Mercantile", lore: "Shops along the south-shore road." },
        { id: "ff", name: "Franklin Square Truck Farms", lore: "Growers bound for city markets." },
        { id: "uni", name: "Uniondale Fairgrounds", lore: "Exhibitions under canvas and iron." },
        { id: "nhp", name: "New Hyde Park Cottages", lore: "Clerks' cottages by the turnpike." },
        { id: "adl", name: "Adelphi College", lore: "Ladies and gentlemen of the sciences." },
        { id: "wh", name: "West Hempstead Mills", lore: "Water wheels on the lake's outflow." },
        { id: "cp", name: "Carle Place Works", lore: "Brick kilns and boiler shops." },
        { id: "lyn", name: "Lynbrook Normal School", lore: "Training the Plains' schoolteachers." },
      ],
      events: [
        {
          week: 2,
          districtId: "uni",
          title: "County Fair",
          description: "Prize hogs and steam threshers draw a crowd.",
          multiplier: 3,
          duration: 25,
        },
        {
          week: 4,
          districtId: "min",
          title: "Junction Strike Ends",
          description: "A backlog of commuters returns at once.",
          multiplier: 3,
          duration: 30,
        },
        {
          week: 6,
          districtId: "hof",
          title: "Commencement Day",
          description: "Families flood the academy lawns.",
          multiplier: 3.5,
          duration: 30,
        },
      ],
    },
  },
];
