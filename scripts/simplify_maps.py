"""Create lightweight offline New York maps from the original bundled OSM data.
Run from the project root with python3 scripts/simplify_maps.py. No network needed.
"""
import json
import math
from pathlib import Path


def simplify(points, tolerance):
    if len(points) < 3:
        return points
    if points[0] == points[-1]:
        middle = len(points)//2
        return simplify(points[:middle+1], tolerance)[:-1] + simplify(points[middle:], tolerance)
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    def distance(q):
        t = max(0, min(1, ((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
        return math.hypot(q[0]-a[0]-t*dx, q[1]-a[1]-t*dy)
    distances = [distance(q) for q in points]
    i = max(range(len(points)), key=lambda i: distances[i])
    if distances[i] > tolerance:
        return simplify(points[:i+1], tolerance)[:-1] + simplify(points[i:], tolerance)
    return [a, b]


for path in Path("src/backend/data/maps").glob("*.json"):
    geo = json.loads(path.read_text())
    tolerance = (geo["bbox"][2]-geo["bbox"][0]) * .006
    for key in ["water", "woods", "wetland", "parks"]:
        rings = []
        for ring in geo[key]:
            area = abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))) / 2
            if area < tolerance*tolerance*(2 if key == "water" else 16):
                continue
            result = simplify(ring, tolerance)
            if len(result) >= 4:
                rings.append([[round(x,5),round(y,5)] for x,y in result])
        geo[key] = rings
    elev = geo["elevation"]
    values = [elev["values"][min(elev["rows"]-1,int(y/8*elev["rows"]))*elev["cols"]+min(elev["cols"]-1,int(x/8*elev["cols"]))] for y in range(8) for x in range(8)]
    geo["elevation"] = {"cols":8,"rows":8,"values":values}
    geo["source"] = "Simplified geography © OpenStreetMap contributors"
    target = Path("src/shared/maps") / path.name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(geo,separators=(",",":")))
    print(f"{path.stem}: {target.stat().st_size} bytes")