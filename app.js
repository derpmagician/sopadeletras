(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = window.PuzzleEngine;
  const exporter = window.PuzzleExport;
  const elements = {
    title: $("title"), secondaryTitle: $("secondary-title"), description: $("description"), entries: $("entries"), size: $("size"),
    grid: $("puzzle-grid"), content: $("paper-content"), message: $("message")
  };
  let type = "crossword";
  let result = null;
  let solution = false;
  let dirty = false;
  let batch = null;
  const selections = {
    crossword: [...engine.defaults.crossword],
    wordsearch: [...engine.defaults.wordsearch]
  };
  const defaultDesign = Object.freeze({ font: "original", size: 0, bold: false, italic: false, underline: false, useColor: false, color: "#292e27" });
  const fonts = ["original", "Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"];
  const sizes = [0, 8, 10, 12, 14, 16, 18, 20, 24];
  const designTargets = ["title", "secondary", "description", "clues", "words", "grid"];
  const selectors = {
    title: "#paper-title", secondary: "#paper-secondary-title", description: "#paper-description",
    clues: ".clue-group h3, .clue-group li", words: ".word-list h3, .word-list-items",
    grid: ".cell-letter"
  };
  const maxImageBytes = 2 * 1024 * 1024;
  const defaultBackdrop = Object.freeze({ mode: "none", color: "#ffffff", image: "", useBorder: false, borderColor: "#292e27" });
  let designState = { ...defaultDesign, groups: {}, titleAlignment: "center", secondaryAlignment: "center", backdrop: { ...defaultBackdrop } };
  let imageRequest = 0;
  let imageLoading = false;

  const editorTabs = [...document.querySelectorAll(".editor-tab")];
  function selectEditorTab(selected) {
    for (const tab of editorTabs) {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute("aria-controls")).hidden = !active;
    }
  }
  editorTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectEditorTab(tab));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % editorTabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + editorTabs.length) % editorTabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = editorTabs.length - 1;
      else return;
      event.preventDefault();
      selectEditorTab(editorTabs[next]);
      editorTabs[next].focus();
    });
  });

  function readTextStyle() {
    return {
      font: $("design-font").value, size: Number($("design-size").value),
      bold: $("design-bold").checked, italic: $("design-italic").checked,
      underline: $("design-underline").checked, useColor: $("design-use-color").checked,
      color: $("design-color").value
    };
  }
  function validTextStyle(design) {
    return design && typeof design === "object" && fonts.includes(design.font) && sizes.includes(design.size) &&
      ["bold", "italic", "underline", "useColor"].every(key => typeof design[key] === "boolean") &&
      typeof design.color === "string" && /^#[0-9a-f]{6}$/i.test(design.color);
  }
  function validImageData(data) {
    if (data === "") return true;
    if (typeof data !== "string" || data.length > Math.ceil(maxImageBytes / 3) * 4 + 30) return false;
    const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if (!match || match[1].length % 4 !== 0) return false;
    return match[1].length / 4 * 3 - (match[1].endsWith("==") ? 2 : match[1].endsWith("=") ? 1 : 0) <= maxImageBytes;
  }
  function validDesign(design) {
    if (!validTextStyle(design)) return false;
    if (design.groups !== undefined && (!design.groups || typeof design.groups !== "object" || Array.isArray(design.groups) ||
      Object.entries(design.groups).some(([key, value]) => !designTargets.includes(key) || !validTextStyle(value)))) return false;
    if (design.titleAlignment !== undefined && !["left", "center", "right"].includes(design.titleAlignment)) return false;
    if (design.secondaryAlignment !== undefined && !["left", "center", "right"].includes(design.secondaryAlignment)) return false;
    if (design.backdrop !== undefined) {
      const b = design.backdrop;
      if (!b || !["none", "solid", "image"].includes(b.mode) || !/^#[0-9a-f]{6}$/i.test(b.color) ||
        typeof b.useBorder !== "boolean" || !/^#[0-9a-f]{6}$/i.test(b.borderColor) || !validImageData(b.image) ||
        (b.mode === "image" && !b.image)) return false;
    }
    return true;
  }
  function readDesign() {
    return structuredClone(designState);
  }
  function updateDesignControls() {
    const target = $("design-target").value;
    const override = target !== "all" && Object.hasOwn(designState.groups, target);
    const style = override ? designState.groups[target] : designState;
    $("design-override-row").hidden = target === "all";
    $("design-override").checked = override;
    $("design-font").value = style.font;
    $("design-size").value = String(style.size);
    for (const key of ["bold", "italic", "underline"]) $(`design-${key}`).checked = style[key];
    $("design-use-color").checked = style.useColor;
    $("design-color").value = style.color;
    const disabled = target !== "all" && !override;
    for (const id of ["design-font", "design-size", "design-bold", "design-italic", "design-underline", "design-use-color"]) $(id).disabled = disabled;
    $("design-color").disabled = disabled || !style.useColor;
    $("title-alignment").value = designState.titleAlignment;
    $("secondary-alignment").value = designState.secondaryAlignment;
    $("backdrop-mode").value = designState.backdrop.mode;
    $("backdrop-color").value = designState.backdrop.color;
    $("backdrop-use-border").checked = designState.backdrop.useBorder;
    $("backdrop-border-color").value = designState.backdrop.borderColor;
    $("backdrop-border-color").disabled = !designState.backdrop.useBorder;
    $("backdrop-solid-row").hidden = designState.backdrop.mode !== "solid";
    $("backdrop-image-row").hidden = designState.backdrop.mode !== "image";
    $("backdrop-image-status").textContent = designState.backdrop.image ? "Imagen seleccionada. PNG, JPEG o WebP; máximo 2 MB." : "PNG, JPEG o WebP; máximo 2 MB.";
  }
  function applyDesign() {
    const paper = $("paper");
    for (const target of designTargets) {
      const personalized = Object.hasOwn(designState.groups, target);
      const style = personalized ? designState.groups[target] : designState;
      paper.querySelectorAll(selectors[target]).forEach(element => {
        element.style.fontFamily = style.font === "original" ? "" : `"${style.font}"`;
        element.style.fontSize = style.size ? (target === "grid" ? `min(${style.size}px, 65cqw)` : `${style.size * (target === "title" || target === "secondary" ? 2 : 1)}px`) : "";
        element.style.fontWeight = style.bold ? "700" : personalized ? "normal" : "";
        element.style.fontStyle = style.italic ? "italic" : personalized ? "normal" : "";
        element.style.textDecoration = style.underline ? "underline" : personalized ? "none" : "";
        element.style.color = style.useColor ? style.color : "";
      });
    }
    $("paper-title").style.textAlign = designState.titleAlignment;
    $("paper-secondary-title").style.textAlign = designState.secondaryAlignment;
    const backdrop = designState.backdrop;
    elements.grid.style.backgroundColor = backdrop.mode === "solid" ? backdrop.color : "";
    elements.grid.style.backgroundImage = backdrop.mode === "image" && backdrop.image ? `url("${backdrop.image}")` : "";
    elements.grid.style.outline = backdrop.useBorder ? `1px solid ${backdrop.borderColor}` : "";
    elements.grid.classList.toggle("has-backdrop", backdrop.mode === "solid" || (backdrop.mode === "image" && !!backdrop.image));
    updateDesignControls();
  }
  function setDesign(design) {
    imageRequest++;
    imageLoading = false;
    designState = {
      font: design.font, size: design.size, bold: design.bold, italic: design.italic, underline: design.underline,
      useColor: design.useColor, color: design.color, groups: structuredClone(design.groups ?? {}),
      titleAlignment: design.titleAlignment ?? "center", secondaryAlignment: design.secondaryAlignment ?? "center",
      backdrop: { ...(design.backdrop ?? defaultBackdrop) }
    };
    $("backdrop-image").value = "";
    applyDesign();
  }
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
    });
  }
  async function checkImage(data) {
    const image = new Image();
    image.src = data;
    try { await image.decode(); } catch { throw new Error("La imagen no es válida o no se puede abrir."); }
  }

  function showMessage(text, kind) {
    elements.message.textContent = text;
    elements.message.className = `message${kind ? ` ${kind}` : ""}`;
  }
  function updateCount() {
    const lines = elements.entries.value.split(/\r?\n/);
    const count = lines.filter(line => line.trim()).length;
    $("word-count").textContent = `${count} ${count === 1 ? "PALABRA" : "PALABRAS"}`;
    $("line-numbers").textContent = lines.map((_, index) => index + 1).join("\n");
    $("line-numbers").style.transform = `translateY(${-elements.entries.scrollTop}px)`;
  }
  function renderDirections() {
    const container = $("directions");
    container.replaceChildren();
    engine.directions.forEach(direction => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = direction.id;
      input.checked = selections[type].includes(direction.id);
      input.addEventListener("change", () => {
        selections[type] = [...container.querySelectorAll("input:checked")].map(item => item.value);
        markDirty();
      });
      label.append(input, document.createTextNode(direction.label));
      container.appendChild(label);
    });
  }
  function setType(value) {
    type = value;
    document.querySelectorAll(".type-option").forEach(button => {
      const selected = button.dataset.type === type;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("search-settings").hidden = type !== "wordsearch";
    $("entry-help").textContent = type === "crossword"
      ? "Una por línea, separada de su pista por una barra vertical |."
      : "Una palabra por línea. También puedes conservar las pistas después de |.";
    renderDirections();
    markDirty();
  }
  function markDirty() {
    dirty = true;
    syncBatch();
    updateCount();
    showMessage("Hay cambios sin generar. Actualiza el pasatiempo antes de exportar.", "notice");
  }
  function syncBatch() {
    if (!batch) return;
    const item = batch.items[batch.index];
    Object.assign(item, { title: elements.title.value, secondaryTitle: elements.secondaryTitle.value,
      description: elements.description.value, entries: elements.entries.value });
    const option = $("batch-select").options[batch.index];
    if (option) option.textContent = item.title.trim() || `Sopa ${batch.index + 1}`;
  }
  function renderBatch() {
    $("batch-controls").hidden = !batch;
    $("export-batch-pdf").hidden = !batch;
    const select = $("batch-select");
    select.replaceChildren();
    if (!batch) return;
    batch.items.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = item.title.trim() || `Sopa ${index + 1}`;
      select.append(option);
    });
    select.value = String(batch.index);
  }
  function selectBatch(index) {
    batch.index = index;
    const item = batch.items[index];
    elements.title.value = item.title;
    elements.secondaryTitle.value = item.secondaryTitle;
    elements.description.value = item.description;
    elements.entries.value = item.entries;
    setType("wordsearch");
    setSolution(false);
    generate();
  }
  function generate() {
    const { entries, errors } = engine.parseEntries(elements.entries.value, type);
    if (!selections[type].length) errors.push("Selecciona al menos una dirección.");
    if (type === "wordsearch") {
      const tooLong = entries.filter(entry => entry.word.length > Number(elements.size.value));
      if (tooLong.length) errors.push(`No caben en la cuadrícula: ${tooLong.map(entry => entry.original).join(", ")}. Elige un tamaño mayor.`);
    }
    if (errors.length) { showMessage(errors.join(" "), "error"); return false; }
    result = type === "crossword" ? engine.crossword(entries, selections[type]) : engine.wordsearch(entries, Number(elements.size.value), selections[type]);
    result.title = elements.title.value.trim() || "Pasatiempo";
    result.secondaryTitle = elements.secondaryTitle.value.trim();
    result.description = elements.description.value.trim();
    dirty = false;
    render();
    if (result.omitted.length) showMessage(`No se pudieron colocar: ${result.omitted.map(entry => entry.original).join(", ")}. Prueba otra distribución o modifica las palabras.`, "error");
    else showMessage(`¡Listo! Se colocaron ${result.placed.length} ${result.placed.length === 1 ? "palabra" : "palabras"}.`, "success");
    return true;
  }
  function append(tag, parent, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }
  function drawWordsearchSolution(grid, rows, cols, words) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("class", "solution-paths");
    svg.setAttribute("viewBox", `0 0 ${cols * 100} ${rows * 100}`);
    svg.setAttribute("aria-hidden", "true");
    for (const word of words) {
      const x = word.col * 100 + 50, y = word.row * 100 + 50;
      const distance = (word.word.length - 1) * 100 * Math.hypot(word.dr, word.dc);
      const angle = Math.atan2(word.dr, word.dc) * 180 / Math.PI;
      const transform = `translate(${x} ${y}) rotate(${angle})`;
      const group = document.createElementNS(namespace, "g");
      group.setAttribute("transform", transform);
      const outline = document.createElementNS(namespace, "rect");
      outline.setAttribute("x", "-33");
      outline.setAttribute("y", "-33");
      outline.setAttribute("width", String(distance + 66));
      outline.setAttribute("height", "66");
      outline.setAttribute("rx", "33");
      outline.setAttribute("class", "solution-outline");
      const arrow = document.createElementNS(namespace, "path");
      arrow.setAttribute("d", `M ${distance + 23} 0 l -13 -9 v 18 z`);
      arrow.setAttribute("class", "solution-arrow");
      group.append(outline, arrow);
      svg.appendChild(group);
    }
    grid.appendChild(svg);
  }
  function render() {
    if (!result) return;
    $("paper-title").textContent = result.title;
    $("paper-secondary-title").textContent = result.secondaryTitle;
    $("paper-description").textContent = result.description;
    $("paper-type").textContent = `${result.type === "crossword" ? "CRUCIGRAMA" : "SOPA DE LETRAS"}${solution ? " · SOLUCIÓN" : ""}`;
    elements.grid.replaceChildren();
    elements.content.replaceChildren();
    const rows = result.grid.length, cols = result.grid[0].length;
    elements.grid.style.setProperty("--columns", cols);
    elements.grid.style.setProperty("--rows", rows);
    elements.grid.style.setProperty("--fit-width", Math.floor(480 * cols / Math.max(rows, cols)));
    elements.grid.style.setProperty("--print-fit-width", Math.floor(370 * cols / Math.max(rows, cols)));
    elements.grid.className = `puzzle-grid ${result.type}`;
    elements.grid.setAttribute("aria-label", `${result.type === "crossword" ? "Crucigrama" : "Sopa de letras"} de ${rows} filas y ${cols} columnas${solution ? ", con solución" : ""}`);
    const starts = new Map(result.placed.map(p => [`${p.row},${p.col}`, p.number]));
    result.grid.forEach((row, r) => row.forEach((letter, c) => {
      const cell = append("div", elements.grid, undefined, "cell");
      if (result.type === "crossword" && !letter) cell.classList.add("empty");
      if (result.type === "crossword" && starts.has(`${r},${c}`)) append("span", cell, String(starts.get(`${r},${c}`)), "cell-number");
      if (letter && (result.type === "wordsearch" || solution)) append("span", cell, letter, "cell-letter");
    }));
    if (result.type === "wordsearch" && solution) drawWordsearchSolution(elements.grid, rows, cols, result.placed);
    if (result.type === "crossword") {
      engine.directions.forEach(direction => {
        const words = result.placed.filter(p => p.direction === direction.id).sort((a, b) => a.number - b.number);
        if (!words.length) return;
        const group = append("section", elements.content, undefined, "clue-group");
        append("h3", group, direction.label.toLocaleUpperCase("es"));
        const list = append("ol", group);
        words.forEach(p => {
          append("li", list, `${p.number}. ${p.clue}${solution ? ` (${p.word})` : ""}`);
        });
      });
    } else {
      const group = append("section", elements.content, undefined, "word-list");
      append("h3", group, "ENCUENTRA LAS PALABRAS");
      const list = append("div", group, undefined, "word-list-items");
      result.placed.forEach(p => {
        const direction = engine.directions.find(item => item.id === p.direction);
        const item = append("span", list, solution ? `${p.word} ${direction.label.slice(-1)}` : p.word);
        if (solution) item.setAttribute("aria-label", `${p.word}, ${direction.label}`);
      });
    }
    applyDesign();
  }
  function setSolution(value) {
    solution = value;
    $("show-puzzle").classList.toggle("active", !value);
    $("show-solution").classList.toggle("active", value);
    $("show-puzzle").setAttribute("aria-pressed", String(!value));
    $("show-solution").setAttribute("aria-pressed", String(value));
    render();
  }
  function save() {
    if (imageLoading) { showMessage("Espera a que termine de cargar la imagen.", "notice"); return; }
    if (designState.backdrop.mode === "image" && !designState.backdrop.image) { showMessage("Selecciona una imagen de fondo antes de guardar.", "error"); return; }
    const page = readPage();
    if (!exporter.validPage(page)) { showMessage("Los márgenes deben ser números enteros entre 5 y 40 mm.", "error"); return; }
    syncBatch();
    const project = { format: "cuadricula", version: 1, type, title: elements.title.value, secondaryTitle: elements.secondaryTitle.value, description: elements.description.value, entries: elements.entries.value, size: Number(elements.size.value), printSolution: $("export-solution").checked, directions: selections, design: readDesign(), page };
    if (batch) project.batch = structuredClone(batch);
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    if (blob.size > 3 * 1024 * 1024) { showMessage("El proyecto supera el límite de 3 MB. Reduce la colección o la imagen de fondo.", "error"); return; }
    download(blob, exporter.fileName(project.title, "json"));
    showMessage("Proyecto descargado. Puedes volver a abrirlo cuando quieras.", "success");
  }
  async function open(file) {
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("El archivo supera el límite de 3 MB.");
      const project = JSON.parse(await file.text());
      if (!project || project.format !== "cuadricula" || project.version !== 1 ||
          !["crossword", "wordsearch"].includes(project.type) ||
          typeof project.title !== "string" || project.title.length > 100 ||
          (project.secondaryTitle !== undefined && (typeof project.secondaryTitle !== "string" || project.secondaryTitle.length > 100)) ||
          typeof project.description !== "string" || project.description.length > 180 ||
          typeof project.entries !== "string" || project.entries.length > 20000 ||
          ![12, 15, 18, 20, 24].includes(project.size) ||
          typeof project.printSolution !== "boolean" ||
          (project.batch !== undefined && (!project.batch || !Array.isArray(project.batch.items) ||
            project.batch.items.length < 1 || project.batch.items.length > 100 ||
            !Number.isInteger(project.batch.index) || project.batch.index < 0 || project.batch.index >= project.batch.items.length ||
            project.batch.items.some(item => !item || typeof item.title !== "string" || item.title.length > 100 ||
              typeof item.secondaryTitle !== "string" || item.secondaryTitle.length > 100 ||
              typeof item.description !== "string" || item.description.length > 180 ||
              typeof item.entries !== "string" || item.entries.length > 20000))) ||
          (project.page !== undefined && !exporter.validPage(project.page)) ||
          (project.design !== undefined && !validDesign(project.design)) ||
          (project.directions !== undefined && (!project.directions || typeof project.directions !== "object" ||
            !["crossword", "wordsearch"].every(key => Array.isArray(project.directions[key]) &&
              new Set(project.directions[key]).size === project.directions[key].length &&
              project.directions[key].every(id => engine.directions.some(direction => direction.id === id)))))) throw new Error("El archivo no es un proyecto compatible de Cuadrícula.");
      if (project.design?.backdrop?.image) await checkImage(project.design.backdrop.image);
      batch = project.batch ? structuredClone(project.batch) : null;
      renderBatch();
      for (const key of ["crossword", "wordsearch"]) selections[key] = [...(project.directions?.[key] ?? engine.defaults[key])];
      elements.title.value = project.title;
      elements.secondaryTitle.value = project.secondaryTitle ?? "";
      elements.description.value = project.description;
      elements.entries.value = project.entries;
      elements.size.value = String(project.size);
      $("export-solution").checked = project.printSolution;
      setPage(project.page ?? exporter.defaultPage);
      setDesign(project.design ?? defaultDesign);
      setType(project.type);
      setSolution(false);
      generate();
    } catch (error) {
      showMessage(`No se pudo abrir el proyecto: ${error.message}`, "error");
    } finally { $("project-file").value = ""; }
  }
  function readPage() {
    const page = { orientation: $("page-orientation").value };
    for (const key of ["top", "right", "bottom", "left"]) page[key] = Number($(`margin-${key}`).value);
    return page;
  }
  function setPage(page) {
    $("page-orientation").value = page.orientation;
    for (const key of ["top", "right", "bottom", "left"]) $(`margin-${key}`).value = String(page[key]);
    $("page-caption").textContent = `FORMATO A4 ${page.orientation === "portrait" ? "VERTICAL" : "HORIZONTAL"} ✳`;
  }
  function canExport({ page = true, background = true } = {}) {
    if (dirty || !result) { showMessage("Genera primero el pasatiempo con los cambios actuales.", "error"); return false; }
    if (result.omitted.length) { showMessage("Hay palabras sin colocar. Modifica la lista y vuelve a generar antes de exportar.", "error"); return false; }
    if (background && imageLoading) { showMessage("Espera a que termine de cargar la imagen.", "notice"); return false; }
    if (background && designState.backdrop.mode === "image" && !designState.backdrop.image) { showMessage("Selecciona una imagen de fondo antes de exportar.", "error"); return false; }
    if (page && !exporter.validPage(readPage())) { showMessage("Los márgenes deben ser números enteros entre 5 y 40 mm.", "error"); return false; }
    return true;
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function makePages(puzzle = result, design = readDesign(), page = readPage(), includeSolution = $("export-solution").checked) {
    if (!Array.isArray(window.RobotoCoverage)) throw new Error("No se encontró la cobertura de la fuente PDF local.");
    const text = [puzzle.title, puzzle.secondaryTitle, puzzle.description,
      ...puzzle.placed.flatMap(entry => [entry.word, puzzle.type === "crossword" ? entry.clue : ""])].join("\n");
    for (const char of text) {
      if (/[\r\n\t]/.test(char)) continue;
      const code = char.codePointAt(0);
      if (!window.RobotoCoverage.some(([start, end]) => code >= start && code <= end)) {
        throw new Error(`La fuente de PDF e imagen no admite el carácter ${char} (U+${code.toString(16).toUpperCase()}).`);
      }
    }
    const context = document.createElement("canvas").getContext("2d");
    if (design.backdrop.mode === "image" && design.backdrop.image.startsWith("data:image/webp;")) {
      const image = new Image(); image.src = design.backdrop.image; await image.decode();
      if (image.naturalWidth * image.naturalHeight > 32000000) throw new Error("La imagen de fondo tiene demasiados píxeles para exportar.");
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      design.backdrop.image = canvas.toDataURL("image/png");
    }
    return exporter.svgPages(puzzle, design, page, includeSolution, (text, size) => {
      context.font = `${size}px Arial`;
      return context.measureText(text).width;
    });
  }
  async function exportPdf() {
    if (!canExport()) return;
    const filename = exporter.fileName(result.title, "pdf");
    try {
      const blob = await createPdf(result, readDesign(), readPage(), $("export-solution").checked);
      download(blob, filename);
      showMessage("PDF descargado.", "success");
    } catch (error) { showMessage(`No se pudo crear el PDF: ${error.message || error}`, "error"); }
  }
  async function createPdf(puzzle, design, page, includeSolution) {
      const { pages } = await makePages(puzzle, design, page, includeSolution);
      const width = page.orientation === "portrait" ? 595.28 : 841.89;
      const context = document.createElement("canvas").getContext("2d");
      const content = pages.map((item, index) => ({
        stack: [
          { svg: item.graphics, width },
          ...item.textLayers.map(line => {
            context.font = `${line.bold ? "bold " : ""}${line.italics ? "italic " : ""}${line.size}px Arial`;
            const textWidth = context.measureText(line.text).width;
            return exporter.pdfTextItem(line, textWidth);
          })
        ],
        ...(index < pages.length - 1 ? { pageBreak: "after" } : {})
      }));
      if (!window.pdfMake) throw new Error("No se encontró la biblioteca PDF local.");
      return new Promise(resolve => window.pdfMake.createPdf({ pageSize: "A4", pageOrientation: page.orientation, pageMargins: 0, content }).getBlob(resolve));
  }
  async function exportBatchPdf() {
    if (!batch) return;
    syncBatch();
    if (imageLoading) { showMessage("Espera a que termine de cargar la imagen.", "notice"); return; }
    const design = readDesign(), page = readPage(), size = Number(elements.size.value);
    if (design.backdrop.mode === "image" && !design.backdrop.image) { showMessage("Selecciona una imagen de fondo antes de exportar.", "error"); return; }
    if (!exporter.validPage(page)) { showMessage("Los márgenes deben ser números enteros entre 5 y 40 mm.", "error"); return; }
    const directions = [...selections.wordsearch], items = structuredClone(batch.items);
    const includeSolution = $("export-solution").checked;
    if (!directions.length) { showMessage("Selecciona al menos una dirección para las sopas.", "error"); return; }
    const button = $("export-batch-pdf");
    button.disabled = true;
    let completed = 0;
    let title = "";
    try {
      const puzzles = [];
      for (const item of items) {
        title = item.title.trim() || "Pasatiempo";
        const { entries, errors } = engine.parseEntries(item.entries, "wordsearch");
        const tooLong = entries.filter(entry => entry.word.length > size);
        if (tooLong.length) errors.push(`No caben en la cuadrícula: ${tooLong.map(entry => entry.original).join(", ")}.`);
        if (errors.length) throw new Error(errors.join(" "));
        const puzzle = engine.wordsearch(entries, size, directions);
        if (puzzle.omitted.length) throw new Error(`No se pudieron colocar: ${puzzle.omitted.map(entry => entry.original).join(", ")}. Aumenta el tamaño o prueba otra vez.`);
        Object.assign(puzzle, { title, secondaryTitle: item.secondaryTitle.trim(), description: item.description.trim() });
        puzzles.push(puzzle);
      }
      for (const puzzle of puzzles) {
        title = puzzle.title;
        showMessage(`Preparando PDF ${completed + 1} de ${puzzles.length}: ${title}.`, "notice");
        const blob = await createPdf(puzzle, structuredClone(design), page, includeSolution);
        download(blob, exporter.fileName(title, "pdf"));
        completed++;
      }
      showMessage(`Se solicitaron ${completed} descargas de PDF. Si falta alguna, permite las descargas múltiples en el navegador.`, "success");
    } catch (error) {
      showMessage(`No se pudo exportar «${title}»: ${error.message || error}. Descargas iniciadas: ${completed} de ${items.length}.`, "error");
    } finally { button.disabled = false; }
  }
  async function exportImage() {
    if (!canExport()) return;
    const filename = exporter.fileName(result.title, "png");
    try {
      const { width, height, pages } = await makePages();
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height) * pages.length;
      if (canvas.height > 16384) throw new Error("El documento es demasiado largo para una imagen PNG.");
      const context = canvas.getContext("2d");
      for (let i = 0; i < pages.length; i++) {
        const url = URL.createObjectURL(new Blob([pages[i].svg], { type: "image/svg+xml" }));
        try {
          const image = new Image(); image.src = url; await image.decode();
          context.drawImage(image, 0, Math.ceil(height) * i, width, height);
        } finally { URL.revokeObjectURL(url); }
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("El navegador no pudo generar la imagen.");
      download(blob, filename);
      showMessage("Imagen PNG descargada.", "success");
    } catch (error) { showMessage(`No se pudo crear la imagen: ${error.message}`, "error"); }
  }
  function print() {
    if (!canExport()) return;
    const page = readPage();
    let rule = $("print-page-rule");
    if (!rule) { rule = document.createElement("style"); rule.id = "print-page-rule"; document.head.append(rule); }
    rule.textContent = `@page { size: A4 ${page.orientation}; margin: ${page.top}mm ${page.right}mm ${page.bottom}mm ${page.left}mm; }`;
    const original = solution;
    const root = $("print-root");
    root.replaceChildren();
    const appendPrintPage = () => {
      const page = $("paper").cloneNode(true);
      page.removeAttribute("id");
      page.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
      root.appendChild(page);
    };
    setSolution(false);
    appendPrintPage();
    if ($("export-solution").checked) {
      setSolution(true);
      appendPrintPage();
    }
    setSolution(original);
    window.print();
  }
  document.querySelectorAll(".type-option").forEach(button => button.addEventListener("click", () => setType(button.dataset.type)));
  [elements.title, elements.secondaryTitle, elements.description, elements.entries, elements.size].forEach(element => element.addEventListener("input", markDirty));
  elements.entries.addEventListener("scroll", updateCount);
  $("design-target").addEventListener("change", updateDesignControls);
  $("design-override").addEventListener("change", () => {
    const target = $("design-target").value;
    if ($("design-override").checked) designState.groups[target] = { ...readTextStyle() };
    else delete designState.groups[target];
    applyDesign();
  });
  ["design-font", "design-size", "design-bold", "design-italic", "design-underline", "design-use-color", "design-color"].forEach(id => $(id).addEventListener("input", () => {
    const target = $("design-target").value;
    if (target === "all") Object.assign(designState, readTextStyle());
    else designState.groups[target] = readTextStyle();
    applyDesign();
  }));
  $("title-alignment").addEventListener("change", () => { designState.titleAlignment = $("title-alignment").value; applyDesign(); });
  $("secondary-alignment").addEventListener("change", () => { designState.secondaryAlignment = $("secondary-alignment").value; applyDesign(); });
  $("backdrop-mode").addEventListener("change", () => {
    designState.backdrop.mode = $("backdrop-mode").value;
    applyDesign();
    if (designState.backdrop.mode === "image" && !designState.backdrop.image) showMessage("Selecciona una imagen de fondo para la cuadrícula.", "notice");
    else showMessage("Fondo de la cuadrícula actualizado.", "success");
  });
  $("backdrop-color").addEventListener("input", () => { designState.backdrop.color = $("backdrop-color").value; applyDesign(); });
  $("backdrop-use-border").addEventListener("change", () => { designState.backdrop.useBorder = $("backdrop-use-border").checked; applyDesign(); });
  $("backdrop-border-color").addEventListener("input", () => { designState.backdrop.borderColor = $("backdrop-border-color").value; applyDesign(); });
  $("backdrop-image").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const request = ++imageRequest;
    imageLoading = true;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Usa una imagen PNG, JPEG o WebP.");
      if (file.size > maxImageBytes) throw new Error("La imagen supera el límite de 2 MB.");
      const data = await readImageFile(file);
      if (!validImageData(data)) throw new Error("La imagen no tiene un formato compatible.");
      await checkImage(data);
      if (request !== imageRequest) return;
      designState.backdrop.image = data;
      applyDesign();
      showMessage("Imagen de fondo seleccionada.", "success");
    } catch (error) {
      if (request === imageRequest) showMessage(`No se pudo cargar la imagen: ${error.message}`, "error");
    } finally {
      if (request === imageRequest) imageLoading = false;
      event.target.value = "";
    }
  });
  $("design-reset").addEventListener("click", () => { setDesign(defaultDesign); showMessage("Diseño original restaurado.", "success"); });
  $("generate").addEventListener("click", generate);
  $("show-puzzle").addEventListener("click", () => setSolution(false));
  $("show-solution").addEventListener("click", () => setSolution(true));
  $("save-project").addEventListener("click", save);
  $("batch-select").addEventListener("change", event => {
    syncBatch();
    selectBatch(Number(event.target.value));
  });
  $("open-project").addEventListener("click", () => $("project-file").click());
  $("project-file").addEventListener("change", event => { if (event.target.files[0]) open(event.target.files[0]); });
  $("print").addEventListener("click", exportPdf);
  $("browser-print").addEventListener("click", print);
  $("export-image").addEventListener("click", exportImage);
  $("export-batch-pdf").addEventListener("click", exportBatchPdf);
  $("export-text").addEventListener("click", () => {
    if (!canExport({ page: false, background: false })) return;
    download(new Blob([exporter.textExport(result, $("export-solution").checked)], { type: "text/plain;charset=utf-8" }), exporter.fileName(result.title, "txt"));
    showMessage("Archivo de texto descargado.", "success");
  });
  $("export-web").addEventListener("click", () => {
    if (!canExport({ page: false })) return;
    download(new Blob([window.InteractiveExport.create(result, exporter.directionNames, readDesign())], { type: "text/html;charset=utf-8" }), exporter.fileName(result.title, "html"));
    showMessage("Web interactiva descargada.", "success");
  });
  $("page-orientation").addEventListener("change", () => {
    $("page-caption").textContent = `FORMATO A4 ${$("page-orientation").value === "portrait" ? "VERTICAL" : "HORIZONTAL"} ✳`;
  });
  function showImport(text) {
    $("import-text").value = text;
    $("import-error").textContent = "";
    document.querySelectorAll('input[name="import-mode"]').forEach(input => { input.checked = false; });
    $("import-dialog").showModal();
  }
  $("import-file-button").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("El archivo supera el límite de 1 MB.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      showImport(text.replace(/^\uFEFF/, ""));
    } catch (error) { showMessage(`No se pudo importar el archivo: ${error.message}`, "error"); }
    finally { event.target.value = ""; }
  });
  $("import-paste-button").addEventListener("click", () => showImport(""));
  $("import-apply").addEventListener("click", () => {
    const value = $("import-text").value.trim(), mode = document.querySelector('input[name="import-mode"]:checked');
    if (!value) { $("import-error").textContent = "Pega o selecciona una lista que no esté vacía."; return; }
    if (!mode) { $("import-error").textContent = "Elige si deseas añadir o reemplazar la lista."; return; }
    if (mode.value === "batch") {
      const { items, errors } = engine.parseWordsearchBatch(value);
      if (errors.length) { $("import-error").textContent = errors.join(" "); return; }
      batch = { items, index: 0 };
      renderBatch();
      $("import-dialog").close();
      selectBatch(0);
      return;
    }
    const combined = mode.value === "append" && elements.entries.value.trim() ? `${elements.entries.value.trimEnd()}\n${value}` : value;
    if (combined.length > 20000) { $("import-error").textContent = "La lista supera el límite de 20 000 caracteres."; return; }
    elements.entries.value = combined;
    $("import-dialog").close();
    markDirty();
  });
  renderDirections();
  updateCount();
  generate();
})();
