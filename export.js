(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PuzzleExport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const escape = value => String(value).replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
  const directionNames = {
    across: "Horizontal", "across-reverse": "Horizontal inversa",
    down: "Vertical", "down-reverse": "Vertical inversa",
    "diagonal-down": "Diagonal descendente", "diagonal-down-reverse": "Diagonal descendente inversa",
    "diagonal-up": "Diagonal ascendente", "diagonal-up-reverse": "Diagonal ascendente inversa"
  };
  const defaultPage = Object.freeze({ orientation: "portrait", top: 12, right: 12, bottom: 12, left: 12 });

  function fileName(title, extension) {
    const clean = title.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
    const encoder = new TextEncoder();
    let base = "";
    let bytes = 0;
    for (const char of clean) {
      const length = encoder.encode(char).length;
      if (bytes + length > 180) break;
      base += char;
      bytes += length;
    }
    base = base.replace(/[. ]+$/g, "") || "Pasatiempo";
    if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\s*\.|$)/i.test(base)) base = `_${base}`;
    return `${base}.${extension}`;
  }

  function validPage(page) {
    return !!page && ["portrait", "landscape"].includes(page.orientation) &&
      ["top", "right", "bottom", "left"].every(key => Number.isInteger(page[key]) && page[key] >= 5 && page[key] <= 40);
  }
  function textExport(result, includeSolution) {
    const lines = [result.title, result.secondaryTitle, result.description].filter(Boolean);
    lines.push("", result.type === "crossword" ? "CRUCIGRAMA" : "SOPA DE LETRAS");
    const starts = new Map(result.placed.map(p => [`${p.row},${p.col}`, p.number]));
    const grid = solution => result.grid.map((row, r) => row.map((letter, c) => {
      if (result.type === "wordsearch") return letter;
      if (!letter) return "■";
      if (solution) return letter;
      return starts.has(`${r},${c}`) ? String(starts.get(`${r},${c}`)) : "□";
    }).join(" ")).join("\n");
    lines.push("", grid(false), "");
    if (result.type === "crossword") {
      for (const id of Object.keys(directionNames)) {
        const words = result.placed.filter(p => p.direction === id).sort((a, b) => a.number - b.number);
        if (words.length) {
          lines.push(directionNames[id].toUpperCase());
          words.forEach(p => lines.push(`${p.number}. ${p.clue}`));
          lines.push("");
        }
      }
    } else {
      lines.push("ENCUENTRA LAS PALABRAS");
      result.placed.forEach(p => lines.push(p.word));
    }
    if (includeSolution) {
      lines.push("", "SOLUCIÓN", "", grid(true), "");
      result.placed.forEach(p => lines.push(result.type === "crossword"
        ? `${p.number}. ${p.word} (${directionNames[p.direction]})`
        : `${p.word} (${directionNames[p.direction]})`));
    }
    return lines.join("\n") + "\n";
  }

  function styleFor(design, key) {
    return design.groups?.[key] || design;
  }
  function wrap(text, width, fontSize, measure) {
    const result = [];
    for (const paragraph of String(text).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        let part = word;
        if (line && measure(`${line} ${part}`, fontSize) > width) { result.push(line); line = ""; }
        while (part && measure(part, fontSize) > width) {
          let n = 1;
          while (n < part.length && measure(part.slice(0, n + 1), fontSize) <= width) n++;
          result.push(part.slice(0, n));
          part = part.slice(n);
        }
        if (part) line = line ? `${line} ${part}` : part;
      }
      result.push(line);
    }
    return result;
  }

  function svgPages(result, design, page, includeSolution, measure) {
    if (!validPage(page)) throw new Error("Los márgenes deben estar entre 5 y 40 mm.");
    const width = page.orientation === "portrait" ? 793.7008 : 1122.5197;
    const height = page.orientation === "portrait" ? 1122.5197 : 793.7008;
    const mm = 96 / 25.4, left = page.left * mm, right = page.right * mm;
    const top = page.top * mm, bottom = page.bottom * mm, available = width - left - right;
    const pages = [];
    let parts, textLayers, y;
    function newPage() {
      parts = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>`];
      textLayers = [];
      pages.push({ parts, textLayers });
      y = top;
    }
    function ensure(h) { if (y + h > height - bottom) newPage(); }
    function textLine(text, x, baseline, size, style, align = "left", role = "") {
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const color = style.useColor ? style.color : "#292e27";
      parts.push(`<text x="${x}" y="${baseline}" font-family="Roboto" font-size="${size}" font-weight="${style.bold ? "bold" : "normal"}" font-style="${style.italic ? "italic" : "normal"}" text-decoration="${style.underline ? "underline" : "none"}" fill="${escape(color)}" text-anchor="${anchor}">${escape(text)}</text>`);
      textLayers.push({ text, x, baseline, size, color, align, bold: !!style.bold, italics: !!style.italic, underline: !!style.underline, role });
    }
    function paragraph(text, key, fallback, alignment = "left", scale = 1) {
      if (!text) return;
      const style = styleFor(design, key), size = style.size ? style.size * scale : fallback;
      const lines = wrap(text, available, size, measure), lineHeight = size * 1.35;
      for (const line of lines) {
        ensure(lineHeight);
        const x = alignment === "center" ? left + available / 2 : alignment === "right" ? width - right : left;
        textLine(line, x, y + size, size, style, alignment, key);
        y += lineHeight;
      }
      y += 6;
    }
    function grid(solution) {
      const rows = result.grid.length, cols = result.grid[0].length;
      const gridHeight = height - top - bottom - 30;
      const cell = Math.min(28, available / cols, gridHeight / rows);
      if (cell < 5) throw new Error("La cuadrícula no cabe en la página con los márgenes seleccionados.");
      const w = cell * cols, h = cell * rows;
      ensure(h + 24);
      const x = left + (available - w) / 2, gy = y;
      const bg = design.backdrop;
      if (bg.mode === "solid") parts.push(`<rect x="${x}" y="${gy}" width="${w}" height="${h}" fill="${escape(bg.color)}"/>`);
      if (bg.mode === "image" && bg.image) parts.push(`<svg x="${x}" y="${gy}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden"><image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" xlink:href="${escape(bg.image)}"/></svg>`);
      if (bg.useBorder) parts.push(`<rect x="${x}" y="${gy}" width="${w}" height="${h}" fill="none" stroke="${escape(bg.borderColor)}"/>`);
      const starts = new Map(result.placed.map(p => [`${p.row},${p.col}`, p.number]));
      const gridStyle = styleFor(design, "grid");
      result.grid.forEach((row, r) => row.forEach((letter, c) => {
        const cx = x + c * cell, cy = gy + r * cell;
        if (result.type === "crossword" && letter) {
          parts.push(`<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="#fffefa" stroke="#c6cdc0" stroke-width=".6"/>`);
          if (starts.has(`${r},${c}`)) textLine(String(starts.get(`${r},${c}`)), cx + 1, cy + Math.max(5, cell * .28), Math.max(5, cell * .25), { useColor: false, bold: true });
        }
        if (letter && (result.type === "wordsearch" || solution)) {
          const font = Math.min(gridStyle.size || 14, cell * .65);
          textLine(letter, cx + cell / 2, cy + cell * .5 + font * .35, font, gridStyle, "center");
        }
      }));
      if (result.type === "wordsearch" && solution) for (const p of result.placed) {
        const x1 = x + (p.col + .5) * cell, y1 = gy + (p.row + .5) * cell;
        const distance = (p.word.length - 1) * cell * Math.hypot(p.dr, p.dc);
        const angle = Math.atan2(p.dr, p.dc) * 180 / Math.PI;
        parts.push(`<g transform="translate(${x1} ${y1}) rotate(${angle})"><rect x="${-.33 * cell}" y="${-.33 * cell}" width="${distance + .66 * cell}" height="${.66 * cell}" rx="${.33 * cell}" fill="none" stroke="#42644b" stroke-width="${Math.max(.7, cell * .05)}"/><path d="M ${distance + .23 * cell} 0 l ${-.13 * cell} ${-.09 * cell} v ${.18 * cell} z" fill="#42644b"/></g>`);
      }
      y += h + 24;
    }
    for (const solution of includeSolution ? [false, true] : [false]) {
      newPage();
      paragraph(result.title, "title", 30, design.titleAlignment, 2);
      paragraph(result.secondaryTitle, "secondary", 20, design.secondaryAlignment, 2);
      paragraph(result.description, "description", 13, "center");
      if (solution) paragraph("SOLUCIÓN", "clues", 12);
      y += 8;
      grid(solution);
      if (result.type === "crossword") {
        for (const id of Object.keys(directionNames)) {
          const words = result.placed.filter(p => p.direction === id).sort((a, b) => a.number - b.number);
          if (!words.length) continue;
          paragraph(directionNames[id].toUpperCase(), "clues", 11);
          for (const p of words) paragraph(`${p.number}. ${p.clue}${solution ? ` (${p.word})` : ""}`, "clues", 12);
        }
      } else {
        paragraph("ENCUENTRA LAS PALABRAS", "words", 11);
        for (const p of result.placed) paragraph(solution ? `${p.word} (${directionNames[p.direction]})` : p.word, "words", 12);
      }
    }
    return { width, height, pages: pages.map(item => {
      const svg = item.parts.join("") + "</svg>";
      return { svg, graphics: svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, ""), textLayers: item.textLayers };
    }) };
  }

  function pdfTextItem(line, textWidth) {
    const offset = line.align === "center" ? textWidth / 2 : line.align === "right" ? textWidth : 0;
    return {
      text: line.text, fontSize: line.size * .75, bold: line.bold, italics: line.italics, color: line.color,
      ...(line.underline ? { decoration: "underline" } : {}),
      ...(line.role === "title" || line.role === "secondary" ? { fontFeatures: { kern: false, liga: false, clig: false } } : {}),
      noWrap: true, absolutePosition: { x: (line.x - offset) * .75, y: (line.baseline - line.size) * .75 }
    };
  }

  return { defaultPage, validPage, fileName, textExport, svgPages, pdfTextItem, directionNames };
});
