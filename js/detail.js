import { formatPopulation } from "./utils.js";

export function createDetailController({
  detailScreenEl,
  detailCardEl,
  detailTitleEl,
  detailMapPreviewEl,
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
  const closeHandler = typeof onClose === "function" ? onClose : () => {};
  const setMessage = typeof setSearchMessage === "function" ? setSearchMessage : () => {};

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Falha ao carregar imagem do mapa"));
      image.src = src;
    });
  }

  async function rasterizeMapPreview() {
    const svgEl = detailMapPreviewEl.querySelector("svg");
    if (!svgEl) return "";

    const rect = detailMapPreviewEl.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const svgClone = svgEl.cloneNode(true);
    svgClone.setAttribute("width", String(width));
    svgClone.setAttribute("height", String(height));
    svgClone.style.display = "block";
    svgClone.style.width = "100%";
    svgClone.style.height = "100%";

    // Inline computed styles so the SVG keeps the same look without external CSS.
    const sourcePaths = svgEl.querySelectorAll("path");
    const clonePaths = svgClone.querySelectorAll("path");
    for (let i = 0; i < clonePaths.length; i += 1) {
      const sourcePath = sourcePaths[i];
      const clonePath = clonePaths[i];
      if (!sourcePath || !clonePath) continue;

      const computed = window.getComputedStyle(sourcePath);
      clonePath.setAttribute("fill", computed.fill);
      clonePath.setAttribute("stroke", computed.stroke);
      clonePath.setAttribute("stroke-width", computed.strokeWidth);
      clonePath.setAttribute("stroke-linejoin", computed.strokeLinejoin);
      clonePath.setAttribute("stroke-linecap", computed.strokeLinecap);
      clonePath.setAttribute("fill-opacity", computed.fillOpacity);
      clonePath.setAttribute("stroke-opacity", computed.strokeOpacity);
    }

    const serialized = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await loadImage(svgUrl);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      ctx.fillStyle = "#fefefb";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error(error);
      return "";
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

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

  function show({ data, mapSnapshot }) {
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

    detailMapPreviewEl.innerHTML = "";
    if (mapSnapshot) detailMapPreviewEl.appendChild(mapSnapshot);

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
    const mapPreviewHeight = Math.max(1, Math.round(detailMapPreviewEl.getBoundingClientRect().height));

    const mapDataUrl = await rasterizeMapPreview();
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

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

    const exportMapBlock = exportCard.querySelector(".detail-block-map");
    if (exportMapBlock) {
      exportMapBlock.style.flex = "0 0 auto";
      exportMapBlock.style.minHeight = "0";
    }

    const exportPreview = exportCard.querySelector("#detail-map-preview");
    if (exportPreview) {
      exportPreview.style.flex = "0 0 auto";
      exportPreview.style.height = `${mapPreviewHeight}px`;
      exportPreview.style.minHeight = `${mapPreviewHeight}px`;
      exportPreview.style.maxHeight = `${mapPreviewHeight}px`;
    }

    const exportMap = exportCard.querySelector("#detail-map");
    if (exportMap && mapDataUrl) {
      const exportMapImage = document.createElement("img");
      exportMapImage.id = "detail-map";
      exportMapImage.alt = "";
      exportMapImage.src = mapDataUrl;
      exportMapImage.style.display = "block";
      exportMapImage.style.width = "100%";
      exportMapImage.style.height = "100%";
      exportMapImage.style.borderRadius = "14px";
      exportMap.replaceWith(exportMapImage);
    }

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
