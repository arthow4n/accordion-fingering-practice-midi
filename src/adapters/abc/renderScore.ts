import { renderAbc } from "abcjs";

export const renderScoreHighlight = (container: HTMLElement): void => {
  const svg = container.querySelector("svg");
  if (!svg) return;

  const previous = svg.querySelector(".note-column-highlight");
  if (previous) {
    previous.remove();
  }

  const markEls = svg.querySelectorAll<SVGGraphicsElement>(".mark");
  if (!markEls.length) return;

  // Keep notes and markings black
  for (const el of markEls) {
    if (el.getAttribute("highlight") === "stroke") {
      el.setAttribute("stroke", "#000000");
    } else {
      el.setAttribute("fill", "#000000");
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of markEls) {
    if (typeof el.getBBox === "function") {
      try {
        const box = el.getBBox();
        if (box.width > 0 || box.height > 0) {
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        }
      } catch {
        // Safe fallback if getBBox is unavailable
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return;
  }

  const staffWrapper = svg.querySelector<SVGGraphicsElement>(".abcjs-staff-wrapper")
    ?? svg.querySelector<SVGGraphicsElement>(".abcjs-staff");
  let staffTop = minY - 12;
  let staffBottom = maxY + 12;

  if (staffWrapper && typeof staffWrapper.getBBox === "function") {
    try {
      const sBox = staffWrapper.getBBox();
      if (sBox.height > 0) {
        staffTop = sBox.y - 4;
        staffBottom = sBox.y + sBox.height + 4;
      }
    } catch {
      // ignore
    }
  }

  const topY = Math.min(staffTop, minY - 8);
  const bottomY = Math.max(staffBottom, maxY + 8);
  const columnHeight = Math.max(1, bottomY - topY);

  const noteWidth = maxX - minX;
  const centerX = minX + noteWidth / 2;
  const columnWidth = Math.max(16, noteWidth + 4);
  const columnX = centerX - columnWidth / 2;

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("class", "note-column-highlight");
  rect.setAttribute("x", String(columnX));
  rect.setAttribute("y", String(topY));
  rect.setAttribute("width", String(columnWidth));
  rect.setAttribute("height", String(columnHeight));
  rect.setAttribute("rx", "3");
  rect.setAttribute("ry", "3");
  rect.setAttribute("fill", "rgba(245, 158, 11, 0.12)");
  rect.setAttribute("stroke", "none");
  rect.setAttribute("stroke-width", "0");
  rect.setAttribute("pointer-events", "none");

  svg.insertBefore(rect, svg.firstChild);
};

export const renderScore = (container: HTMLElement, abc: string): void => {
  renderAbc(container, abc, {
    add_classes: true,
    responsive: "resize",
    selectTypes: [],
  });
  renderScoreHighlight(container);
};
