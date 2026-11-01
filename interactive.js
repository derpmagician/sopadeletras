(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InteractiveExport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function runInteractive() {
    const puzzle = JSON.parse(document.getElementById("puzzle-data").textContent);
    const grid = document.getElementById("grid"), list = document.getElementById("clues"), status = document.getElementById("status");
    const cells = [], found = new Set();
    const namespace = "http://www.w3.org/2000/svg";
    let paths;
    if (puzzle.type === "wordsearch") {
      paths = document.createElementNS(namespace, "svg");
      paths.setAttribute("class", "paths");
      paths.setAttribute("viewBox", `0 0 ${puzzle.grid[0].length * 100} ${puzzle.grid.length * 100}`);
      paths.setAttribute("aria-hidden", "true");
      grid.append(paths);
    }
    let start = null;
    grid.style.setProperty("--columns", puzzle.grid[0].length);
    const starts = new Map(puzzle.placed.map(p => [`${p.row},${p.col}`, p.number]));
    function say(text) { status.textContent = text; }
    function markWord(p, index) {
      if (found.has(index)) return;
      found.add(index);
      const length = (p.word.length - 1) * 100 * Math.hypot(p.dr, p.dc);
      const group = document.createElementNS(namespace, "g");
      group.setAttribute("transform", `translate(${p.col * 100 + 50} ${p.row * 100 + 50}) rotate(${Math.atan2(p.dr, p.dc) * 180 / Math.PI})`);
      const rect = document.createElementNS(namespace, "rect");
      for (const [name, value] of Object.entries({ x: -33, y: -33, width: length + 66, height: 66, rx: 33 })) rect.setAttribute(name, value);
      const arrow = document.createElementNS(namespace, "path");
      arrow.setAttribute("d", `M ${length + 23} 0 l -13 -9 v 18 z`);
      group.append(rect, arrow);
      paths.append(group);
      list.children[index].classList.add("found-word");
      list.children[index].textContent = `${p.word} (${p.directionLabel})`;
    }
    puzzle.grid.forEach((row, r) => {
      cells[r] = [];
      row.forEach((letter, c) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        const number = starts.get(`${r},${c}`);
        if (puzzle.type === "crossword" && !letter) cell.classList.add("empty");
        else if (puzzle.type === "crossword") {
          if (number) { const n = document.createElement("span"); n.className = "number"; n.textContent = number; cell.append(n); }
          const input = document.createElement("input");
          input.maxLength = 1;
          input.setAttribute("aria-label", `Fila ${r + 1}, columna ${c + 1}${number ? `, inicio ${number}` : ""}`);
          input.addEventListener("input", () => {
            const value = input.value.toLocaleUpperCase("es").normalize("NFD").replace(/N\u0303/g, "Ñ").replace(/[\u0300-\u036f]/g, "");
            if (value && !/^[A-ZÑ]$/.test(value)) { input.value = ""; say("Escribe una letra del alfabeto español."); }
            else input.value = value;
            input.classList.remove("correct", "incorrect");
          });
          cell.append(input);
          cells[r][c] = input;
        } else {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = letter;
          button.setAttribute("aria-label", `Fila ${r + 1}, columna ${c + 1}, ${letter}`);
          button.addEventListener("click", () => {
            if (!start) { start = [r, c]; button.classList.add("start"); say("Selecciona la última letra de la palabra."); return; }
            cells[start[0]][start[1]].classList.remove("start");
            const match = puzzle.placed.findIndex((p, index) => {
              const endR = p.row + p.dr * (p.word.length - 1), endC = p.col + p.dc * (p.word.length - 1);
              return !found.has(index) && ((p.row === start[0] && p.col === start[1] && endR === r && endC === c) ||
                (endR === start[0] && endC === start[1] && p.row === r && p.col === c));
            });
            start = null;
            if (match < 0) { say("No coincide con una palabra pendiente. Inténtalo de nuevo."); return; }
            const p = puzzle.placed[match];
            markWord(p, match);
            say(found.size === puzzle.placed.length ? "¡Encontraste todas las palabras!" : `Encontraste ${p.word}.`);
          });
          cell.append(button);
          cells[r][c] = button;
        }
        grid.append(cell);
      });
    });
    puzzle.placed.forEach(p => {
      const item = document.createElement("li");
      item.textContent = puzzle.type === "crossword" ? `${p.number}. ${p.clue} (${p.directionLabel})` : p.word;
      list.append(item);
    });
    const design = puzzle.design;
    if (design) {
      const targets = {
        title: "h1", secondary: "h2", description: "#description",
        clues: "#clues li", words: "#clues li", grid: ".cell input, .cell button"
      };
      for (const [key, selector] of Object.entries(targets)) {
        if ((key === "clues" && puzzle.type !== "crossword") || (key === "words" && puzzle.type !== "wordsearch")) continue;
        const personalized = Object.hasOwn(design.groups, key);
        const style = personalized ? design.groups[key] : design;
        document.querySelectorAll(selector).forEach(element => {
          element.style.fontFamily = style.font === "original" ? "" : `"${style.font}"`;
          element.style.fontSize = style.size ? (key === "grid" ? `min(${style.size}px, 65cqw)` : `${style.size * (key === "title" || key === "secondary" ? 2 : 1)}px`) : "";
          element.style.fontWeight = style.bold ? "700" : personalized ? "normal" : "";
          element.style.fontStyle = style.italic ? "italic" : personalized ? "normal" : "";
          element.style.textDecoration = style.underline ? "underline" : personalized ? "none" : "";
          element.style.color = style.useColor ? style.color : "";
        });
      }
      document.querySelector("h1").style.textAlign = design.titleAlignment;
      const secondary = document.querySelector("h2");
      if (secondary) secondary.style.textAlign = design.secondaryAlignment;
      const background = design.backdrop;
      grid.style.backgroundColor = background.mode === "solid" ? background.color : "";
      grid.style.backgroundImage = background.mode === "image" && background.image ? `url("${background.image}")` : "";
      grid.style.outline = background.useBorder ? `1px solid ${background.borderColor}` : "";
      if (puzzle.type === "crossword" && background.mode !== "none") grid.classList.add("crossword-backdrop");
    }
    document.getElementById("check").addEventListener("click", () => {
      if (puzzle.type === "wordsearch") { say(`Has encontrado ${found.size} de ${puzzle.placed.length} palabras.`); return; }
      let errors = 0, missing = 0;
      puzzle.grid.forEach((row, r) => row.forEach((letter, c) => {
        if (!letter) return;
        const input = cells[r][c];
        input.classList.remove("correct", "incorrect");
        if (!input.value) missing++;
        else if (input.value === letter) input.classList.add("correct");
        else { input.classList.add("incorrect"); errors++; }
      }));
      say(errors || missing ? `Letras incorrectas: ${errors}. Casillas vacías: ${missing}.` : "¡Crucigrama resuelto!");
    });
    document.getElementById("reveal").addEventListener("click", () => {
      if (puzzle.type === "crossword") puzzle.grid.forEach((row, r) => row.forEach((letter, c) => {
        if (letter) { cells[r][c].value = letter; cells[r][c].classList.remove("incorrect"); cells[r][c].classList.add("correct"); }
      }));
      else puzzle.placed.forEach((p, index) => markWord(p, index));
      say("Solución mostrada.");
    });
  }
  function create(result, directionNames, design) {
    const data = {
      type: result.type, grid: result.grid, design,
      placed: result.placed.map(p => ({ word: p.word, clue: p.clue, row: p.row, col: p.col, dr: p.dr, dc: p.dc, number: p.number, directionLabel: directionNames[p.direction] }))
    };
    const safeJSON = JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
    const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(result.title)}</title>
<style>body{margin:0;background:#f5f4ee;color:#292e27;font:16px/1.5 system-ui,sans-serif}main{max-width:780px;margin:auto;padding:24px}h1{text-align:center;font-family:Georgia,serif}h2,p{text-align:center}.grid{position:relative;display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));max-width:650px;margin:24px auto;background-position:center;background-size:cover;background-repeat:no-repeat}.cell{position:relative;aspect-ratio:1;border:1px solid #bdc9b5;container-type:inline-size}.cell.empty{border-color:transparent}.crossword-backdrop .cell:not(.empty){background:#fffefa}.cell input,.cell button{position:relative;z-index:1;display:block;width:100%;height:100%;padding:0;border:0;background:transparent;text-align:center;font:700 clamp(10px,2vw,20px) system-ui}.number{position:absolute;top:0;left:2px;font-size:8px;pointer-events:none}.cell button{cursor:pointer}.paths{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.paths rect{fill:none;stroke:#42644b;stroke-width:5}.paths path{fill:#42644b}.correct{background:#dcecd6!important}.incorrect{background:#f8d9d4!important}.start{outline:2px solid #6d8061}.found-word{text-decoration:line-through;color:#6d8061}button.action{padding:10px 16px;margin:4px;border:0;border-radius:5px;background:#42583e;color:white;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #94ae86}ul{padding-left:22px}#status{min-height:1.5em;text-align:left}li{overflow-wrap:anywhere}</style></head>
<body><main><h1>${escape(result.title)}</h1>${result.secondaryTitle ? `<h2>${escape(result.secondaryTitle)}</h2>` : ""}${result.description ? `<p id="description">${escape(result.description)}</p>` : ""}
<p>${result.type === "crossword" ? "Escribe las letras y comprueba tus respuestas." : "Selecciona la primera y la última letra de cada palabra."}</p>
<div id="grid" class="grid" aria-label="Cuadrícula del pasatiempo"></div><ul id="clues"></ul>
<button id="check" class="action" type="button">Comprobar</button><button id="reveal" class="action" type="button">Mostrar solución</button><p id="status" role="status" aria-live="polite"></p></main>
<script id="puzzle-data" type="application/json">${safeJSON}</script><script>(${runInteractive.toString()})();</script></body></html>`;
  }
  return { create };
});
