import { escapeHtml, normalizeText } from "./utils.js";

export function createSearchController({
  searchWrap,
  searchInput,
  searchBtn,
  searchSuggestions,
  searchMsg,
}) {
  let searchIndex = [];
  let visibleSuggestions = [];
  let selectedCode = "";
  let highlightedSuggestion = -1;
  let suggestionIdPrefix = `sug-${Date.now().toString(36)}`;
  let openMunicipioByCode = () => false;
  let clearSelection = () => {};

  function setSearchMessage(text, isError = false) {
    searchMsg.textContent = text;
    searchMsg.classList.toggle("error", isError);
  }

  function clearSuggestions() {
    visibleSuggestions = [];
    highlightedSuggestion = -1;
    searchSuggestions.innerHTML = "";
    searchSuggestions.classList.remove("show");
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function setSuggestionHighlight(index) {
    highlightedSuggestion = index;

    const items = searchSuggestions.querySelectorAll(".sug-item");
    items.forEach((item, idx) => {
      const isActive = idx === index;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (index >= 0 && index < items.length) {
      searchInput.setAttribute("aria-activedescendant", items[index].id);
    } else {
      searchInput.removeAttribute("aria-activedescendant");
    }
  }

  function renderSuggestions(query) {
    const normQuery = normalizeText(query);
    if (!normQuery) {
      clearSuggestions();
      return;
    }

    const tokens = normQuery.split(/\s+/).filter(Boolean);
    const matches = [];

    for (const item of searchIndex) {
      const ok = tokens.every(
        (token) => item.normMunicipio.includes(token) || item.normLabel.includes(token)
      );
      if (ok) matches.push(item);
      if (matches.length >= 10) break;
    }

    visibleSuggestions = matches;
    highlightedSuggestion = -1;

    if (!matches.length) {
      clearSuggestions();
      return;
    }

    searchSuggestions.innerHTML = matches
      .map(
        (item, index) => `
          <li
            class="sug-item"
            id="${suggestionIdPrefix}-${index}"
            data-index="${index}"
            data-code="${item.code}"
            role="option"
            aria-selected="false"
          >
            <span>${escapeHtml(item.municipio)}</span>
            <span class="sug-uf">${escapeHtml(item.uf)}</span>
          </li>
        `
      )
      .join("");

    searchSuggestions.classList.add("show");
    searchInput.setAttribute("aria-expanded", "true");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function findCodeFromSearchInput() {
    const typed = normalizeText(searchInput.value);
    if (!typed) return "";

    if (selectedCode) {
      const selected = searchIndex.find((item) => item.code === selectedCode);
      if (selected && (selected.normLabel === typed || selected.normMunicipio === typed)) {
        return selectedCode;
      }
    }

    const exact = searchIndex.find(
      (item) => item.normLabel === typed || item.normMunicipio === typed
    );
    if (exact) return exact.code;

    const startsWith = searchIndex.find(
      (item) => item.normLabel.startsWith(typed) || item.normMunicipio.startsWith(typed)
    );
    if (startsWith) return startsWith.code;

    const contains = searchIndex.find(
      (item) => item.normLabel.includes(typed) || item.normMunicipio.includes(typed)
    );

    return contains ? contains.code : "";
  }

  function pickSuggestion(item) {
    if (!item) return;
    selectedCode = item.code;
    searchInput.value = item.label;
    clearSuggestions();
    runSearch(item.code);
  }

  function runSearch(preferredCode = "") {
    const code = preferredCode || findCodeFromSearchInput();
    if (!code) {
      setSearchMessage("Município não encontrado. Escolha uma sugestão da lista.", true);
      clearSelection();
      return false;
    }

    const opened = openMunicipioByCode(code);
    if (!opened) {
      setSearchMessage("Não foi possível abrir esse município no mapa.", true);
      return false;
    }

    const item = searchIndex.find((entry) => entry.code === code);
    if (item) {
      searchInput.value = item.label;
      selectedCode = item.code;
      setSearchMessage(`Selecionado: ${item.label}`);
    } else {
      setSearchMessage("Município selecionado.");
    }

    clearSuggestions();
    return true;
  }

  function markSelected(code, label) {
    selectedCode = code;
    searchInput.value = label;
    setSearchMessage(`Selecionado: ${label}`);
    clearSuggestions();
  }

  function clearSelectedMunicipio() {
    selectedCode = "";
    searchInput.value = "";
    setSearchMessage("");
    clearSuggestions();
  }

  function setSearchIndex(index) {
    searchIndex = Array.isArray(index) ? index : [];
    suggestionIdPrefix = `sug-${Date.now().toString(36)}`;
  }

  function setOpenHandler(handler) {
    openMunicipioByCode = typeof handler === "function" ? handler : () => false;
  }

  function setClearSelectionHandler(handler) {
    clearSelection = typeof handler === "function" ? handler : () => {};
  }

  function contains(target) {
    return searchWrap.contains(target);
  }

  searchInput.addEventListener("input", () => {
    selectedCode = "";
    setSearchMessage("");
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSuggestions();
      return;
    }

    if (!visibleSuggestions.length) {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next =
        highlightedSuggestion >= visibleSuggestions.length - 1
          ? 0
          : highlightedSuggestion + 1;
      setSuggestionHighlight(next);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev =
        highlightedSuggestion <= 0
          ? visibleSuggestions.length - 1
          : highlightedSuggestion - 1;
      setSuggestionHighlight(prev);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedSuggestion >= 0) {
        pickSuggestion(visibleSuggestions[highlightedSuggestion]);
      } else {
        runSearch();
      }
    }
  });

  searchSuggestions.addEventListener("mousedown", (event) => {
    const itemEl = event.target.closest(".sug-item");
    if (!itemEl) return;

    event.preventDefault();
    const idx = Number(itemEl.dataset.index || "-1");
    if (idx >= 0 && idx < visibleSuggestions.length) {
      pickSuggestion(visibleSuggestions[idx]);
    }
  });

  searchBtn.addEventListener("click", () => {
    runSearch();
  });

  return {
    setSearchIndex,
    setOpenHandler,
    setClearSelectionHandler,
    setSearchMessage,
    clearSuggestions,
    clearSelectedMunicipio,
    markSelected,
    runSearch,
    contains,
  };
}
