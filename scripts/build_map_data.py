#!/usr/bin/env python3
"""
Pre-bakes real map data for every charter into src/backend/data/maps/<slug>.json.

Sources
  - OpenStreetMap via Overpass: coastline, inland water, woods, wetlands, parks.
  - Open-Meteo elevation API: a coarse elevation grid for hills/slope costs.

Usage:  pip install shapely requests && python3 scripts/build_map_data.py [slug ...]
Add a new map by appending to BBOXES and adding its districts in src/server/data/districts.ts.
Output is static JSON so the game never depends on a live API at demo time.
"""
import json, sys, time, pathlib, requests
from shapely.geometry import LineString, Polygon, box, mapping, Point
from shapely.ops import polygonize, unary_union, linemerge

# slug: (south, west, north, east)
BBOXES = {
    # Keep each bbox roughly 11:7 on screen (width_deg * cos(lat) / height_deg ~= 1.57).
    "setauket": (40.845, -73.235, 40.975, -72.965),
    "manhattan": (40.66, -74.083, 40.755, -73.886),
    "nassau": (40.64, -73.773, 40.77, -73.503),
}
OUT = pathlib.Path(__file__).resolve().parent.parent / "src/backend/data/maps"
OVERPASS = "https://overpass-api.de/api/interpreter"
SIMPLIFY = 0.00025  # degrees (~25 m)


def overpass(bbox):
    s, w, n, e = bbox
    b = f"({s},{w},{n},{e})"
    q = f"""[out:json][timeout:120];
    (way["natural"="coastline"]{b};
     way["natural"="water"]{b}; relation["natural"="water"]{b};
     way["natural"="wood"]{b}; way["landuse"="forest"]{b};
     way["natural"="wetland"]{b};
     way["leisure"="park"]{b};);
    out geom;"""
    for attempt in range(4):
        r = requests.post(OVERPASS, data={"data": q}, timeout=180, headers={"User-Agent": "brassworks-transit/1.0"})
        if r.ok:
            return r.json()["elements"]
        time.sleep(5 * (attempt + 1))
    r.raise_for_status()


def coords(el):
    return [(p["lon"], p["lat"]) for p in el.get("geometry", [])]


def sea_polygons(coast_ways, bbox):
    s, w, n, e = bbox
    frame = box(w, s, e, n)
    lines = [LineString(coords(c)) for c in coast_ways if len(coords(c)) > 1]
    if not lines:
        return []
    merged = linemerge(lines)
    pieces = list(polygonize(unary_union([merged.intersection(frame), frame.boundary])))
    # OSM coastline keeps land on the LEFT and water on the RIGHT of each way.
    # Vote per piece: points just right of coastline segments are water, just left are land.
    from shapely.strtree import STRtree
    tree = STRtree(pieces)
    votes = [0] * len(pieces)
    eps = 2e-5
    for ln in lines:
        cs = list(ln.coords)
        for (x1, y1), (x2, y2) in zip(cs, cs[1:]):
            dx, dy = x2 - x1, y2 - y1
            L = (dx * dx + dy * dy) ** 0.5
            if L == 0:
                continue
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            nx, ny = dy / L * eps, -dx / L * eps  # right-hand normal
            for px, py, v in ((mx + nx, my + ny, 1), (mx - nx, my - ny, -1)):
                pt = Point(px, py)
                for i in tree.query(pt):
                    if pieces[i].contains(pt):
                        votes[i] += v
    return [p for p, v in zip(pieces, votes) if v > 0]


def polys(els, frame):
    out = []
    for el in els:
        if el["type"] == "way":
            cs = coords(el)
            if len(cs) >= 4 and cs[0] == cs[-1]:
                out.append(Polygon(cs))
        elif el["type"] == "relation":
            outers = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in el.get("members", [])
                      if m.get("role") == "outer" and m.get("geometry")]
            out += list(polygonize(linemerge(outers))) if outers else []
    res = []
    for p in out:
        p = p.buffer(0).intersection(frame)
        if not p.is_empty and p.area > 2e-7:
            res.append(p)
    return res


def to_rings(geoms, min_area=2e-7):
    rings = []
    for g in geoms:
        g = g.simplify(SIMPLIFY)
        parts = getattr(g, "geoms", [g])
        for p in parts:
            if isinstance(p, Polygon) and p.area > min_area:
                rings.append([[round(x, 5), round(y, 5)] for x, y in p.exterior.coords])
    return rings


def elevation(bbox, cols=28, rows=18):
    s, w, n, e = bbox
    pts = [(s + (n - s) * (r + 0.5) / rows, w + (e - w) * (c + 0.5) / cols) for r in range(rows) for c in range(cols)]
    vals = []
    for i in range(0, len(pts), 100):
        chunk = pts[i:i + 100]
        r = requests.get("https://api.open-meteo.com/v1/elevation", params={
            "latitude": ",".join(f"{p[0]:.4f}" for p in chunk),
            "longitude": ",".join(f"{p[1]:.4f}" for p in chunk)}, timeout=60)
        for wait in (20, 40, 60):
            if r.status_code != 429:
                break
            time.sleep(wait)  # rate limited: back off and retry
            r = requests.get(r.url, timeout=60)
        r.raise_for_status()
        vals += r.json()["elevation"]
        time.sleep(1)
    return {"cols": cols, "rows": rows, "values": [round(max(0, v), 1) for v in vals]}


def build(slug):
    bbox = BBOXES[slug]
    s, w, n, e = bbox
    frame = box(w, s, e, n)
    els = overpass(bbox)
    tag = lambda el, k, v: el.get("tags", {}).get(k) == v
    coast = [el for el in els if tag(el, "natural", "coastline")]
    sea = sea_polygons(coast, bbox)
    lakes = polys([el for el in els if tag(el, "natural", "water")], frame)
    water = unary_union(sea + lakes)
    woods = polys([el for el in els if tag(el, "natural", "wood") or tag(el, "landuse", "forest")], frame)
    wet = polys([el for el in els if tag(el, "natural", "wetland")], frame)
    parks = polys([el for el in els if tag(el, "leisure", "park")], frame)
    data = {
        "slug": slug, "bbox": [w, s, e, n],
        "water": to_rings([water], 1e-7),
        "woods": to_rings(woods, 1e-6),
        "wetland": to_rings(wet, 1e-6),
        "parks": to_rings(parks, 1e-6),
        "elevation": elevation(bbox),
        "source": "© OpenStreetMap contributors; elevation Open-Meteo/Copernicus DEM",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{slug}.json").write_text(json.dumps(data, separators=(",", ":")))
    print(slug, {k: len(v) for k, v in data.items() if isinstance(v, list)})


if __name__ == "__main__":
    for slug in sys.argv[1:] or BBOXES:
        build(slug)
