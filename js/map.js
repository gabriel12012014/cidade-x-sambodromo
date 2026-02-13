import { HEIGHT, WIDTH } from "./constants.js";
import { bbox, pathFromPolygons, ringsFromGeometry } from "./geo.js";
import { clamp, normalizeCode } from "./utils.js";

export function createMapController({ mapEl, groupEl }) {
  let csvByCode = new Map();
  let pathByCode = new Map();
  let detailPathByCode = new Map();
  let detailSnapshotEl = null;
  let detailGroupEl = null;
  let activePath = null;
  let activeCode = "";
  let onMunicipioSelected = () => {};

  function closeSelection() {
    mapEl.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

    for (const path of pathByCode.values()) {
      path.classList.remove("active");
    }
    activePath = null;

    if (detailSnapshotEl) {
      for (const path of detailPathByCode.values()) {
        path.classList.remove("active");
        path.classList.remove("focus-selected");
      }
      if (detailGroupEl) detailGroupEl.classList.remove("focus-mode");
      detailSnapshotEl.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
    }

    activeCode = "";
  }

  function zoomToPath(path) {
    const box = path.getBBox();
    if (!box || !Number.isFinite(box.width) || !Number.isFinite(box.height)) return;

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const rawScale = Math.min(
      WIDTH / Math.max(box.width + 80, 1),
      HEIGHT / Math.max(box.height + 80, 1)
    );
    const scale = clamp(rawScale, 2.4, 12);
    const targetW = WIDTH / scale;
    const targetH = HEIGHT / scale;
    const x = clamp(cx - targetW / 2, 0, WIDTH - targetW);
    const y = clamp(cy - targetH / 2, 0, HEIGHT - targetH);

    mapEl.setAttribute(
      "viewBox",
      `${x.toFixed(3)} ${y.toFixed(3)} ${targetW.toFixed(3)} ${targetH.toFixed(3)}`
    );
  }

  function openMunicipioByCode(code) {
    const path = pathByCode.get(code);
    const data = csvByCode.get(code);
    if (!path || !data) return false;

    if (activePath) activePath.classList.remove("active");

    // Keep selected municipio above all others in the SVG stack.
    groupEl.appendChild(path);
    activePath = path;
    activePath.classList.add("active");
    zoomToPath(path);
    syncDetailSnapshot(code);

    onMunicipioSelected({ code, data });
    return true;
  }

  function render(features) {
    const bounds = bbox(features);
    const frag = document.createDocumentFragment();
    pathByCode = new Map();

    for (const feature of features) {
      const polygons = ringsFromGeometry(feature.geometry);
      if (!polygons.length) continue;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathFromPolygons(polygons, bounds));
      path.setAttribute("fill-rule", "evenodd");

      const code = normalizeCode(feature.properties?.CD_MUN);
      const csvData = csvByCode.get(code);
      const group = String(csvData?.GRUPO ?? csvData?.grupo ?? "")
        .trim()
        .toUpperCase();

      if (group === "A" || group === "B" || group === "C") {
        path.classList.add(`group-${group.toLowerCase()}`);
      }

      path.dataset.code = code;
      pathByCode.set(code, path);
      frag.appendChild(path);
    }

    groupEl.innerHTML = "";
    groupEl.appendChild(frag);
    buildDetailSnapshot();

    groupEl.onclick = (event) => {
      const path = event.target.closest("path");
      if (!path) return;

      const code = path.dataset.code || "";
      const hasCsvData = csvByCode.has(code);
      if (!hasCsvData) {
        closeSelection();
        return;
      }

      openMunicipioByCode(code);
    };
  }

  function setMunicipioData(dataMap) {
    csvByCode = dataMap;
  }

  function setOnMunicipioSelected(handler) {
    onMunicipioSelected = typeof handler === "function" ? handler : () => {};
  }

  function isPathTarget(target) {
    return Boolean(target && target.closest && target.closest("#municipios path"));
  }

  function buildDetailSnapshot() {
    detailSnapshotEl = mapEl.cloneNode(true);
    detailSnapshotEl.id = "detail-map";

    const group = detailSnapshotEl.querySelector("#municipios");
    if (group) {
      group.id = "detail-municipios";
      detailGroupEl = group;
    } else {
      detailGroupEl = null;
    }

    detailPathByCode = new Map();
    const detailPaths = detailSnapshotEl.querySelectorAll("path");
    detailPaths.forEach((path) => {
      detailPathByCode.set(path.dataset.code || "", path);
    });
  }

  function syncDetailSnapshot(code) {
    if (!detailSnapshotEl) return;

    const prev = detailPathByCode.get(activeCode);
    if (prev) {
      prev.classList.remove("active");
      prev.classList.remove("focus-selected");
    }

    const next = detailPathByCode.get(code);
    if (detailGroupEl) detailGroupEl.classList.add("focus-mode");
    if (next) {
      next.classList.remove("active");
      next.classList.add("focus-selected");
    }

    detailSnapshotEl.setAttribute("viewBox", mapEl.getAttribute("viewBox") || `0 0 ${WIDTH} ${HEIGHT}`);
    activeCode = code;
  }

  function createSnapshot() {
    if (!detailSnapshotEl) buildDetailSnapshot();
    return detailSnapshotEl;
  }

  return {
    setMunicipioData,
    setOnMunicipioSelected,
    render,
    openMunicipioByCode,
    closeSelection,
    isPathTarget,
    createSnapshot,
  };
}
