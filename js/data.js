import { normalizeCode, normalizeText, parseCsv } from "./utils.js";

export async function loadMunicipiosData() {
  const [geoResponse, csvResponse] = await Promise.all([
    fetch("./Regions-geometry.geojson"),
    fetch("./cidades-x-escola-de-samba.csv"),
  ]);

  if (!geoResponse.ok) throw new Error(`GeoJSON HTTP ${geoResponse.status}`);
  if (!csvResponse.ok) throw new Error(`CSV HTTP ${csvResponse.status}`);

  const geojson = await geoResponse.json();
  const csvRows = parseCsv(await csvResponse.text());
  const features = Array.isArray(geojson.features) ? geojson.features : [];

  if (!features.length) throw new Error("GeoJSON sem features");

  const csvByCode = new Map(csvRows.map((row) => [normalizeCode(row.CD_MUN), row]));
  const searchIndex = csvRows
    .map((row) => {
      const code = normalizeCode(row.CD_MUN);
      const municipio = row["Município"] || "";
      const uf = row["UF"] || "";
      const label = `${municipio} (${uf})`;

      return {
        code,
        municipio,
        uf,
        label,
        normMunicipio: normalizeText(municipio),
        normLabel: normalizeText(label),
      };
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"));

  return { features, csvByCode, searchIndex };
}
