import { loadMunicipiosData } from "./data.js?v=20260213s";
import { createDetailController } from "./detail.js?v=20260213s";
import { createMapController } from "./map.js?v=20260213s";
import { createSearchController } from "./search.js?v=20260213s";

const appEl = document.getElementById("app");
const detailScreenEl = document.getElementById("detail-screen");
const detailCardEl = document.querySelector(".detail-card");
const loadingScreenEl = document.getElementById("loading-screen");
const loadingTextEl = document.getElementById("loading-text");

const mapEl = document.getElementById("mapa");
const municipiosGroupEl = document.getElementById("municipios");
const searchWrapEl = document.getElementById("search-wrap");
const searchInputEl = document.getElementById("municipio-search");
const searchBtnEl = document.getElementById("search-btn");
const searchSuggestionsEl = document.getElementById("search-suggestions");
const searchMsgEl = document.getElementById("search-msg");
const detailTitleEl = document.getElementById("detail-title");
const detailMapPreviewEl = document.getElementById("detail-map-preview");
const detailPopulationEl = document.getElementById("detail-population");
const detailGroupTextEl = document.getElementById("detail-group-text");
const detailShareBtnEl = document.getElementById("detail-share-btn");
const detailCloseBtnEl = document.getElementById("detail-close-btn");

function setLoadingState(text, isError = false) {
  loadingTextEl.textContent = text;
  loadingScreenEl.classList.toggle("error", isError);
}

function showApp() {
  appEl.hidden = false;
  detailScreenEl.hidden = true;
  loadingScreenEl.hidden = true;
  requestAnimationFrame(() => {
    appEl.classList.add("ready");
  });
}

function showLoading() {
  appEl.classList.remove("ready");
  appEl.hidden = true;
  detailScreenEl.hidden = true;
  loadingScreenEl.hidden = false;
}

async function init() {
  showLoading();
  setLoadingState("Carregando dados do mapa...");

  const searchController = createSearchController({
    searchWrap: searchWrapEl,
    searchInput: searchInputEl,
    searchBtn: searchBtnEl,
    searchSuggestions: searchSuggestionsEl,
    searchMsg: searchMsgEl,
  });

  const mapController = createMapController({
    mapEl,
    groupEl: municipiosGroupEl,
  });

  let detailController = null;
  const closeDetail = () => {
    if (detailController) detailController.hide();
    mapController.closeSelection();
    searchController.clearSelectedMunicipio();
    appEl.hidden = false;
    requestAnimationFrame(() => {
      appEl.classList.add("ready");
    });
  };

  detailController = createDetailController({
    detailScreenEl,
    detailCardEl,
    detailTitleEl,
    detailMapPreviewEl,
    detailPopulationEl,
    detailGroupTextEl,
    detailShareBtnEl,
    detailCloseBtnEl,
    onClose: closeDetail,
    setSearchMessage: searchController.setSearchMessage,
  });

  searchController.setOpenHandler((code) => mapController.openMunicipioByCode(code));
  searchController.setClearSelectionHandler(() => mapController.closeSelection());

  mapController.setOnMunicipioSelected(({ code, data }) => {
    const label = `${data["Município"] || ""} (${data["UF"] || ""})`.trim();
    searchController.markSelected(code, label);

    const mapSnapshot = mapController.createSnapshot();
    detailController.show({ data, mapSnapshot });
    appEl.hidden = true;
  });

  document.addEventListener("click", (event) => {
    if (searchController.contains(event.target)) return;
    searchController.clearSuggestions();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (detailController.isOpen()) {
      closeDetail();
      return;
    }
    searchController.clearSuggestions();
    mapController.closeSelection();
  });

  window.addEventListener("resize", () => {
    if (detailController.isOpen()) return;
    mapController.closeSelection();
  });

  try {
    const { features, csvByCode, searchIndex } = await loadMunicipiosData();

    mapController.setMunicipioData(csvByCode);
    mapController.render(features);
    searchController.setSearchIndex(searchIndex);

    showApp();
  } catch (error) {
    console.error(error);
    setLoadingState("Falha ao carregar dados do mapa. Recarregue a página.", true);
  }
}

init();
