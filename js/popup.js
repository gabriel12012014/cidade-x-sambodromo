import { GROUP_TEXT } from "./constants.js";
import { clamp, escapeHtml, formatPopulation } from "./utils.js";

export function createPopupController({ popupEl, setSearchMessage }) {
  const setMessage = typeof setSearchMessage === "function" ? setSearchMessage : () => {};

  function overlapArea(a, b) {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  }

  function positionPopup(targetRect) {
    const margin = 10;
    const gap = 14;
    const rect = popupEl.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const clampX = (x) => clamp(x, margin, window.innerWidth - width - margin);
    const clampY = (y) => clamp(y, margin, window.innerHeight - height - margin);

    const expandedTarget = {
      left: targetRect.left - 8,
      top: targetRect.top - 8,
      right: targetRect.right + 8,
      bottom: targetRect.bottom + 8,
    };

    const candidates = [
      {
        left: clampX(targetRect.right + gap),
        top: clampY(targetRect.top + targetRect.height / 2 - height / 2),
      },
      {
        left: clampX(targetRect.left - gap - width),
        top: clampY(targetRect.top + targetRect.height / 2 - height / 2),
      },
      {
        left: clampX(targetRect.left + targetRect.width / 2 - width / 2),
        top: clampY(targetRect.top - gap - height),
      },
      {
        left: clampX(targetRect.left + targetRect.width / 2 - width / 2),
        top: clampY(targetRect.bottom + gap),
      },
    ];

    let best = candidates[0];
    let minOverlap = Number.POSITIVE_INFINITY;

    for (const cand of candidates) {
      const box = {
        left: cand.left,
        top: cand.top,
        right: cand.left + width,
        bottom: cand.top + height,
      };

      const area = overlapArea(box, expandedTarget);
      if (area < minOverlap) {
        minOverlap = area;
        best = cand;
      }
      if (area === 0) break;
    }

    popupEl.style.left = `${best.left}px`;
    popupEl.style.top = `${best.top}px`;
  }

  async function generateShareImage({ municipio, uf, shareBtn }) {
    if (typeof window.html2canvas !== "function") {
      setMessage("Não foi possível compartilhar agora.", true);
      return;
    }

    try {
      shareBtn.disabled = true;
      shareBtn.textContent = "Gerando...";

      const captureWidth = Math.min(800, window.innerWidth);
      const captureX = Math.max(0, Math.floor((window.innerWidth - captureWidth) / 2));
      const captureHeight = window.innerHeight;

      const canvas = await window.html2canvas(document.body, {
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        scale: Math.max(1, window.devicePixelRatio || 1),
        x: captureX + window.scrollX,
        y: window.scrollY,
        width: captureWidth,
        height: captureHeight,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });

      const safeName = `${municipio}-${uf}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

      const link = document.createElement("a");
      link.download = `${safeName || "municipio"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error(error);
      setMessage("Falha ao gerar imagem para compartilhamento.", true);
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = "Compartilhar";
    }
  }

  function show(targetRect, data, onClose) {
    const grupo = String(data["GRUPO"] ?? data.grupo ?? "").toUpperCase();
    const grupoDesc = GROUP_TEXT[grupo] || "Grupo não classificado.";
    const municipio = data["Município"] || "Município sem nome";
    const uf = data["UF"] || "N/A";
    const regiao = data["região"] || "N/A";

    popupEl.innerHTML = `
      <div class="popup-head">
        <div class="popup-heading">
          <p class="popup-kicker">A sua cidade:</p>
          <h2 class="popup-title">${escapeHtml(`${municipio} - ${uf} (${regiao})`)}</h2>
        </div>
        <button type="button" class="popup-close" aria-label="Fechar popup">×</button>
      </div>
      <ul class="popup-list">
        <li><strong>População:</strong> <span class="pop-number">${formatPopulation(data["População 2022"])} </span></li>
      </ul>
      <div class="grupo-desc">${escapeHtml(grupoDesc)}</div>
      <div class="popup-actions">
        <button type="button" class="share-btn" id="share-btn">Compartilhar</button>
      </div>
    `;

    popupEl.classList.add("show");
    requestAnimationFrame(() => positionPopup(targetRect));

    const closeBtn = popupEl.querySelector(".popup-close");
    if (closeBtn) closeBtn.addEventListener("click", onClose);

    const shareBtn = popupEl.querySelector("#share-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () =>
        generateShareImage({ municipio, uf, shareBtn })
      );
    }
  }

  function hide() {
    popupEl.classList.remove("show");
    popupEl.innerHTML = "";
  }

  function isOpen() {
    return popupEl.classList.contains("show");
  }

  function contains(target) {
    return popupEl.contains(target);
  }

  return {
    show,
    hide,
    isOpen,
    contains,
  };
}
