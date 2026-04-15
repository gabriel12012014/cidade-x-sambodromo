import { loadMunicipiosData } from "./data.js?v=20260213s";
import { createDetailController } from "./detail.js?v=20260213s";

import { createSearchController } from "./search.js?v=20260213s";

const appEl = document.getElementById("app");
const detailScreenEl = document.getElementById("detail-screen");
const detailCardEl = document.querySelector(".detail-card");
const loadingScreenEl = document.getElementById("loading-screen");
const loadingTextEl = document.getElementById("loading-text");


const searchWrapEl = document.getElementById("search-wrap");
const searchInputEl = document.getElementById("municipio-search");
const searchBtnEl = document.getElementById("search-btn");
const searchSuggestionsEl = document.getElementById("search-suggestions");
const searchMsgEl = document.getElementById("search-msg");
const detailTitleEl = document.getElementById("detail-title");

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
  setLoadingState("Carregando dados...");

  const searchController = createSearchController({
    searchWrap: searchWrapEl,
    searchInput: searchInputEl,
    searchBtn: searchBtnEl,
    searchSuggestions: searchSuggestionsEl,
    searchMsg: searchMsgEl,
  });



  let detailController = null;
  const closeDetail = () => {
    if (detailController) detailController.hide();
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

    detailPopulationEl,
    detailGroupTextEl,
    detailShareBtnEl,
    detailCloseBtnEl,
    onClose: closeDetail,
    setSearchMessage: searchController.setSearchMessage,
  });

  searchController.setOpenHandler((code) => {
    const data = csvByCode.get(code);
    if (!data) return;

    const label = `${data["Município"] || ""} (${data["UF"] || ""})`.trim();
    searchController.markSelected(code, label);

    detailController.show({ data });
    appEl.hidden = true;
  });
  searchController.setClearSelectionHandler(() => { });



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
    searchController.clearSuggestions();
  });



  let csvByCode;
  try {
    const data = await loadMunicipiosData();
    csvByCode = data.csvByCode;
    const { searchIndex } = data;

    searchController.setSearchIndex(searchIndex);

    showApp();
  } catch (error) {
    console.error(error);
    setLoadingState("Falha ao carregar dados. Recarregue a página.", true);
  }
}

init();
