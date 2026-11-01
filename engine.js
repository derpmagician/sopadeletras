(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PuzzleEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalize(value) {
    return value.trim().toLocaleUpperCase("es").normalize("NFD")
      .replace(/N\u0303/g, "Ñ")
      .replace(/\p{M}/gu, "")
      .replace(/[\s\p{P}\p{S}\p{Cf}]/gu, "");
  }

  function parseEntries(text, type) {
    const entries = [];
    const errors = [];
    const seen = new Set();
    text.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      const separator = line.indexOf("|");
      const original = (separator < 0 ? line : line.slice(0, separator)).trim();
      const word = normalize(original);
      const clue = separator < 0 ? "" : line.slice(separator + 1).trim();
      const valid = type === "wordsearch" ? /^[A-ZÑ0-9]{2,24}$/ : /^[A-ZÑ]{2,24}$/;
      if (!valid.test(word)) errors.push(type === "wordsearch"
        ? `Línea ${index + 1}: usa entre 2 y 24 letras del alfabeto español o números.`
        : `Línea ${index + 1}: usa entre 2 y 24 letras del alfabeto español; no se admiten números ni otros alfabetos.`);
      else if (seen.has(word)) errors.push(`Línea ${index + 1}: la palabra ${original} está repetida.`);
      else if (type === "crossword" && !clue) errors.push(`Línea ${index + 1}: añade una pista después de |.`);
      else { entries.push({ word, original, clue }); seen.add(word); }
    });
    if (!entries.length && !errors.length) errors.push("Añade al menos una palabra.");
    if (entries.length > 40) errors.push("Puedes añadir hasta 40 palabras.");
    return { entries, errors };
  }

  function parseWordsearchBatch(text) {
    const items = [], errors = [];
    let current = null;
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      const line = raw.trim();
      if (!line) continue;
      const heading = /^#{1,6}\s+(?:\d+[.)]\s+)?(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        const title = heading[1].trim();
        if (title.length > 100) errors.push(`Línea ${index + 1}: el título supera 100 caracteres.`);
        current = { title, secondaryTitle: "", description: "", entries: "" };
        items.push(current);
      } else if (!current) {
        errors.push(`Línea ${index + 1}: escribe un título con ## antes de las palabras.`);
      } else {
        const word = line.replace(/^\d+[.)]\s+/, "");
        current.entries += `${current.entries ? "\n" : ""}${word}`;
      }
    }
    if (!items.length) errors.push("Añade al menos un título con ## y sus palabras.");
    if (items.length > 100) errors.push("Puedes importar hasta 100 sopas a la vez.");
    items.forEach(item => {
      if (!item.entries.trim()) errors.push(`La sopa «${item.title}» no tiene palabras.`);
      if (item.entries.length > 20000) errors.push(`La lista de «${item.title}» supera 20 000 caracteres.`);
    });
    return { items, errors };
  }

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  const directions = Object.freeze([
    { id: "across", dr: 0, dc: 1, label: "Horizontal →" },
    { id: "across-reverse", dr: 0, dc: -1, label: "Horizontal inversa ←" },
    { id: "down", dr: 1, dc: 0, label: "Vertical ↓" },
    { id: "down-reverse", dr: -1, dc: 0, label: "Vertical inversa ↑" },
    { id: "diagonal-down", dr: 1, dc: 1, label: "Diagonal descendente ↘" },
    { id: "diagonal-down-reverse", dr: -1, dc: -1, label: "Diagonal descendente inversa ↖" },
    { id: "diagonal-up", dr: -1, dc: 1, label: "Diagonal ascendente ↗" },
    { id: "diagonal-up-reverse", dr: 1, dc: -1, label: "Diagonal ascendente inversa ↙" }
  ].map(Object.freeze));
  const defaults = Object.freeze({
    crossword: Object.freeze(["across", "down"]),
    wordsearch: Object.freeze(directions.map(direction => direction.id))
  });

  function selectedDirections(ids) {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length ||
        ids.some(id => !directions.some(direction => direction.id === id))) {
      throw new Error("Selecciona al menos una dirección válida.");
    }
    return directions.filter(direction => ids.includes(direction.id));
  }

  function crossword(entries, directionIds = defaults.crossword) {
    const allowed = selectedDirections(directionIds);
    const width = 51;
    let best = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const grid = Array.from({ length: width }, () => Array(width).fill(null));
      const placed = [];
      const ordered = shuffle(entries).sort((a, b) => b.word.length - a.word.length);
      const first = ordered.shift();
      const firstDirection = allowed[Math.floor(Math.random() * allowed.length)];
      const offset = Math.floor((first.word.length - 1) / 2);
      const firstRow = 25 - firstDirection.dr * offset;
      const firstCol = 25 - firstDirection.dc * offset;
      for (let i = 0; i < first.word.length; i++) grid[firstRow + i * firstDirection.dr][firstCol + i * firstDirection.dc] = first.word[i];
      placed.push({ ...first, row: firstRow, col: firstCol, direction: firstDirection.id, dr: firstDirection.dr, dc: firstDirection.dc });
      let remaining = ordered;
      let progress = true;
      while (progress && remaining.length) {
        progress = false;
        const next = [];
        for (const entry of remaining) {
          const candidates = [];
          for (let row = 1; row < width - 1; row++) for (let col = 1; col < width - 1; col++) {
            if (!grid[row][col]) continue;
            for (let i = 0; i < entry.word.length; i++) {
              if (grid[row][col] !== entry.word[i]) continue;
              for (const direction of allowed) {
                const { dr, dc } = direction;
                const r = row - i * dr, c = col - i * dc;
                const endR = r + (entry.word.length - 1) * dr, endC = c + (entry.word.length - 1) * dc;
                if (Math.min(r, endR, c, endC) < 1 || Math.max(r, endR, c, endC) >= width - 1 || grid[r - dr][c - dc] || grid[endR + dr][endC + dc]) continue;
                let crossings = 0, valid = true;
                for (let j = 0; j < entry.word.length; j++) {
                  const rr = r + j * dr, cc = c + j * dc, current = grid[rr][cc];
                  if (current) {
                    if (current !== entry.word[j] || placed.some(p =>
                      p.dr * dc === p.dc * dr && [...p.word].some((_, k) => p.row + p.dr * k === rr && p.col + p.dc * k === cc))) { valid = false; break; }
                    crossings++;
                  } else if (grid[rr + dc][cc - dr] || grid[rr - dc][cc + dr]) { valid = false; break; }
                }
                if (valid && crossings) candidates.push({ row: r, col: c, direction: direction.id, dr, dc, crossings });
              }
            }
          }
          if (!candidates.length) { next.push(entry); continue; }
          candidates.sort((a, b) => b.crossings - a.crossings);
          const top = candidates.filter(c => c.crossings === candidates[0].crossings);
          const choice = top[Math.floor(Math.random() * top.length)];
          for (let i = 0; i < entry.word.length; i++) grid[choice.row + choice.dr * i][choice.col + choice.dc * i] = entry.word[i];
          placed.push({ ...entry, ...choice });
          progress = true;
        }
        remaining = next;
      }
      if (!best || placed.length > best.placed.length) best = { grid, placed, omitted: remaining };
      if (!remaining.length) break;
    }
    const rows = best.placed.flatMap(p => [p.row, p.row + p.dr * (p.word.length - 1)]);
    const cols = best.placed.flatMap(p => [p.col, p.col + p.dc * (p.word.length - 1)]);
    const minRow = Math.min(...rows), minCol = Math.min(...cols);
    best.grid = best.grid.slice(minRow, Math.max(...rows) + 1).map(row => row.slice(minCol, Math.max(...cols) + 1));
    best.placed.forEach(p => { p.row -= minRow; p.col -= minCol; });
    const starts = [...new Set(best.placed.map(p => `${p.row},${p.col}`))]
      .map(value => value.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    best.placed.forEach(p => { p.number = starts.findIndex(([row, col]) => row === p.row && col === p.col) + 1; });
    return { ...best, type: "crossword" };
  }

  function wordsearch(entries, size, directionIds = defaults.wordsearch) {
    const allowed = selectedDirections(directionIds);
    let best = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(null));
      const placed = [], omitted = [];
      const ordered = shuffle(entries).sort((a, b) => b.word.length - a.word.length);
      for (const entry of ordered) {
        const candidates = [];
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) for (const { id, dr, dc } of allowed) {
          const endRow = row + dr * (entry.word.length - 1), endCol = col + dc * (entry.word.length - 1);
          if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
          if ([...entry.word].every((letter, i) => !grid[row + dr * i][col + dc * i] || grid[row + dr * i][col + dc * i] === letter)) candidates.push({ row, col, dr, dc, direction: id });
        }
        if (!candidates.length) { omitted.push(entry); continue; }
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        [...entry.word].forEach((letter, i) => { grid[choice.row + choice.dr * i][choice.col + choice.dc * i] = letter; });
        placed.push({ ...entry, ...choice });
      }
      if (!best || placed.length > best.placed.length) best = { grid, placed, omitted };
      if (!omitted.length) break;
    }
    const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
    best.grid.forEach(row => row.forEach((cell, i) => { if (!cell) row[i] = alphabet[Math.floor(Math.random() * alphabet.length)]; }));
    return { ...best, type: "wordsearch" };
  }
  return { normalize, parseEntries, parseWordsearchBatch, crossword, wordsearch, directions, defaults };
});
