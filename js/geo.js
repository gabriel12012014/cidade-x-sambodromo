import { HEIGHT, PAD, WIDTH } from "./constants.js";

export function ringsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

export function bbox(features) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    const polygons = ringsFromGeometry(feature.geometry);
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }

  return { minLon, minLat, maxLon, maxLat };
}

function project(lon, lat, bounds) {
  const spanX = bounds.maxLon - bounds.minLon || 1;
  const spanY = bounds.maxLat - bounds.minLat || 1;
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY);
  const usedW = spanX * scale;
  const usedH = spanY * scale;
  const offsetX = (WIDTH - usedW) / 2;
  const offsetY = (HEIGHT - usedH) / 2;

  return {
    x: offsetX + (lon - bounds.minLon) * scale,
    y: offsetY + (bounds.maxLat - lat) * scale,
  };
}

export function pathFromPolygons(polygons, bounds) {
  let d = "";

  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (!ring.length) continue;
      const first = project(ring[0][0], ring[0][1], bounds);
      d += `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
      for (let i = 1; i < ring.length; i++) {
        const p = project(ring[i][0], ring[i][1], bounds);
        d += `L${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      }
      d += "Z";
    }
  }

  return d;
}
