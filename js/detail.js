import { formatPopulation } from "./utils.js";

export function createDetailController({
  detailScreenEl,
  detailCardEl,
  detailTitleEl,

  detailPopulationEl,
  detailGroupTextEl,
  detailShareBtnEl,
  detailCloseBtnEl,
  onClose,
  setSearchMessage,
}) {
  let currentData = null;
  let shareObjectUrl = "";
  let renderVersion = 0;
  const closeHandler = typeof onClose === "function" ? onClose : () => { };
  const setMessage = typeof setSearchMessage === "function" ? setSearchMessage : () => { };





  function safeName(municipio, uf) {
    return `${municipio}-${uf}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function hide() {
    renderVersion += 1;
    detailScreenEl.hidden = true;
    clearShareCache();
  }

  function isOpen() {
    return !detailScreenEl.hidden;
  }

  function show({ data }) {
    renderVersion += 1;
    currentData = data;
    clearShareCache();

    const municipio = data["Município"] || "Município sem nome";
    const uf = data["UF"] || "N/A";
    const grupoDesc = String(data.TEXTO || data.texto || "").trim() || "Grupo não classificado.";

    detailTitleEl.textContent = `${municipio} - ${uf}`;
    detailPopulationEl.textContent = formatPopulation(data["População 2022"]);
    detailGroupTextEl.textContent = grupoDesc;
    detailCloseBtnEl.textContent = "Voltar";
    detailShareBtnEl.textContent = "Baixar imagem";



    detailScreenEl.hidden = false;
  }

  async function renderShareImage(versionSnapshot = renderVersion) {
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";
    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas indisponível");
    }

    // Let the button label paint before generating the export.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

    const cardWidth = Math.max(1, Math.round(detailCardEl.getBoundingClientRect().width));

    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-20000px";
    exportHost.style.top = "0";
    exportHost.style.width = `${cardWidth}px`;
    exportHost.style.pointerEvents = "none";
    exportHost.style.opacity = "1";
    exportHost.style.zIndex = "-1";

    const exportCard = detailCardEl.cloneNode(true);
    exportCard.style.width = "100%";
    exportCard.style.height = "auto";
    exportCard.style.maxHeight = "none";
    exportCard.style.transform = "none";
    exportCard.style.transition = "none";
    exportCard.querySelectorAll('[data-hide-on-share="true"]').forEach((el) => el.remove());



    exportHost.appendChild(exportCard);
    document.body.appendChild(exportHost);

    let canvas = null;
    try {
      const rect = exportCard.getBoundingClientRect();
      canvas = await window.html2canvas(exportCard, {
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        scale: 1,
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        windowWidth: Math.max(1, Math.round(rect.width)),
        windowHeight: Math.max(1, Math.round(rect.height)),
        scrollX: 0,
        scrollY: 0,
        removeContainer: true,
      });
    } finally {
      exportHost.remove();
    }
    if (!canvas) throw new Error("Falha ao gerar imagem para compartilhamento.");
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      throw new Error("Falha ao converter imagem para JPG");
    }
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

    if (shareObjectUrl) URL.revokeObjectURL(shareObjectUrl);
    shareObjectUrl = URL.createObjectURL(blob);
    return shareObjectUrl;
  }

  async function downloadImage() {
    if (!currentData) return;

    try {
      detailShareBtnEl.disabled = true;
      detailShareBtnEl.textContent = shareObjectUrl ? "Baixando..." : "Gerando...";
      if (!shareObjectUrl) await renderShareImage(renderVersion);

      const municipio = currentData["Município"] || "municipio";
      const uf = currentData["UF"] || "uf";
      const link = document.createElement("a");
      link.download = `${safeName(municipio, uf) || "municipio"}.jpg`;
      link.href = shareObjectUrl;
      link.click();
    } catch (error) {
      console.error(error);
      setMessage("Falha ao gerar imagem para compartilhamento.", true);
    } finally {
      detailShareBtnEl.disabled = false;
      detailShareBtnEl.textContent = "Baixar imagem";
    }
  }

  detailCloseBtnEl.addEventListener("click", closeHandler);
  detailShareBtnEl.addEventListener("click", downloadImage);

  function clearShareCache() {
    if (shareObjectUrl) {
      URL.revokeObjectURL(shareObjectUrl);
      shareObjectUrl = "";
    }
  }

  return {
    show,
    hide,
    isOpen,
  };
}
