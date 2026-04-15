import { normalizeCode, normalizeText, parseCsv } from "./utils.js";

export async function loadMunicipiosData() {
  const response = await fetch("./cidades-x-escola-de-samba.csv");

  if (!response.ok) throw new Error(`CSV HTTP ${response.status}`);

  const csvRows = parseCsv(await response.text());
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

  return { csvByCode, searchIndex };
}
