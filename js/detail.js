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
  let shareRenderPromise = null;
  let prewarmTimer = 0;
  let prewarmIdleId = 0;
  let renderVersion = 0;
  const closeHandler = typeof onClose === "function" ? onClose : () => {};
  const setMessage = typeof setSearchMessage === "function" ? setSearchMessage : () => {};

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
    clearPrewarm();
    detailScreenEl.hidden = true;
    clearShareCache();
  }

  function isOpen() {
    return !detailScreenEl.hidden;
  }

  function show({ data, mapSnapshot }) {
    renderVersion += 1;
    clearPrewarm();
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
    scheduleSharePrewarm(renderVersion);
  }

  function clearPrewarm() {
    if (prewarmTimer) {
      window.clearTimeout(prewarmTimer);
      prewarmTimer = 0;
    }
    if (prewarmIdleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(prewarmIdleId);
      prewarmIdleId = 0;
    }
  }

  function scheduleSharePrewarm(versionSnapshot) {
    clearPrewarm();
    const runPrewarm = () => {
      if (versionSnapshot !== renderVersion) return;
      if (detailScreenEl.hidden) return;
      if (shareObjectUrl || shareRenderPromise) return;

      const prewarmPromise = renderShareImage(versionSnapshot);
      shareRenderPromise = prewarmPromise;

      prewarmPromise
        .catch((error) => {
          if (versionSnapshot === renderVersion) console.error(error);
        })
        .finally(() => {
          if (shareRenderPromise === prewarmPromise) shareRenderPromise = null;
        });
    };

    if (typeof window.requestIdleCallback === "function") {
      prewarmIdleId = window.requestIdleCallback(
        () => {
          prewarmIdleId = 0;
          runPrewarm();
        },
        { timeout: 1800 }
      );
      return;
    }

    prewarmTimer = window.setTimeout(() => {
      prewarmTimer = 0;
      runPrewarm();
    }, 1000);
  }

  async function renderShareImage(versionSnapshot = renderVersion) {
    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas indisponível");
    }
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

    // Let the button label paint before the heavy capture starts.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

    const captureTarget = detailCardEl || detailScreenEl;
    const sourceCanvas = await window.html2canvas(captureTarget, {
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scale: 1,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: window.innerHeight,
      scrollX: 0,
      scrollY: 0,
      removeContainer: true,
      ignoreElements: (el) => el?.dataset?.hideOnShare === "true",
    });
    if (versionSnapshot !== renderVersion || detailScreenEl.hidden) return "";

    const canvas = document.createElement("canvas");
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Falha ao criar contexto da imagem");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);

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
      if (!shareObjectUrl && shareRenderPromise) await shareRenderPromise;
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
    shareRenderPromise = null;
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
