const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../engine.js");

test("normaliza tildes y conserva la eñe", () => {
  assert.equal(engine.normalize("  cañón  "), "CAÑON");
  assert.equal(engine.normalize("  arroz con leche  "), "ARROZCONLECHE");
  assert.equal(engine.normalize("  ¡piña-colada! ☀  "), "PIÑACOLADA");
  assert.equal(engine.normalize(" nin\u0303o de azu\u0301car "), "NIÑODEAZUCAR");
});

test("valida entradas, pistas y duplicados normalizados", () => {
  const parsed = engine.parseEntries("café | Bebida\nCAFE | Otro\nmal dato 3 | No\nSOL", "crossword");
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.errors.length, 3);
  assert.equal(engine.parseEntries("LUNA\nSOL", "wordsearch").errors.length, 0);
});

test("normaliza frases y símbolos en ambos pasatiempos sin alterar las pistas", () => {
  for (const type of ["crossword", "wordsearch"]) {
    const parsed = engine.parseEntries("  arroz con leche  |  ¡Postre con canela!  ", type);
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.entries[0], { word: "ARROZCONLECHE", original: "arroz con leche", clue: "¡Postre con canela!" });
    const result = type === "crossword" ? engine.crossword(parsed.entries) : engine.wordsearch(parsed.entries, 15);
    const placed = result.placed[0];
    assert.equal([...placed.word].map((_, i) => result.grid[placed.row + i * placed.dr][placed.col + i * placed.dc]).join(""), "ARROZCONLECHE");
  }
});

test("valida duplicados y límites después de eliminar separadores", () => {
  const parsed = engine.parseEntries("arroz con leche\nARROZ-CON-LECHE\n!!!\nA B\nA Ж\n" + "A ".repeat(25), "wordsearch");
  assert.deepEqual(parsed.entries.map(entry => entry.word), ["ARROZCONLECHE", "AB"]);
  assert.equal(parsed.errors.length, 4);
  assert.match(parsed.errors[0], /repetida/);
});

test("importa sopas con títulos y numeración conservando números internos", () => {
  const input = "## 1. COMPUTACION CUANTICA\n1. QUBIT\n2. IONATRAPADO\n\n## 2. IMPRESION 3D\n1. BOQUILLA0\n2. ESCANER3D";
  const { items, errors } = engine.parseWordsearchBatch(input);
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map(item => item.title), ["COMPUTACION CUANTICA", "IMPRESION 3D"]);
  assert.equal(items[1].entries, "BOQUILLA0\nESCANER3D");
  const parsed = engine.parseEntries(items[1].entries, "wordsearch");
  assert.deepEqual(parsed.errors, []);
  const result = engine.wordsearch(parsed.entries, 12);
  assert.equal(result.omitted.length, 0);
  for (const p of result.placed) {
    assert.equal([...p.word].map((_, i) => result.grid[p.row + p.dr * i][p.col + p.dc * i]).join(""), p.word);
  }
  assert.ok(engine.parseEntries("ESCANER3D | pista", "crossword").errors.length);
});

test("rechaza lotes sin encabezado o con secciones vacías sin descartar datos", () => {
  assert.ok(engine.parseWordsearchBatch("SOL\n## Título\nLUNA").errors.some(error => error.includes("Línea 1")));
  assert.ok(engine.parseWordsearchBatch("## Vacía\n## Otra\nSOL").errors.some(error => error.includes("Vacía")));
});

test("el crucigrama coloca palabras cruzadas sin contacto lateral indebido", () => {
  const entries = engine.parseEntries("GATO | A\nLUNA | B\nSOL | C\nMAR | D\nRÍO | E\nÁRBOL | F\nFLOR | G\nNUBE | H", "crossword").entries;
  for (let trial = 0; trial < 5; trial++) {
    const result = engine.crossword(entries);
    assert.equal(result.placed.length, entries.length);
    for (const p of result.placed) {
      assert.ok(p.number > 0);
      for (let i = 0; i < p.word.length; i++) {
        const row = p.row + (p.direction === "down" ? i : 0);
        const col = p.col + (p.direction === "across" ? i : 0);
        assert.equal(result.grid[row][col], p.word[i]);
        const perpendicular = result.placed.some(q => q !== p && q.direction !== p.direction &&
          (q.direction === "across" ? q.row === row && col >= q.col && col < q.col + q.word.length :
            q.col === col && row >= q.row && row < q.row + q.word.length));
        if (!perpendicular) {
          const neighbors = p.direction === "across" ? [[row - 1, col], [row + 1, col]] : [[row, col - 1], [row, col + 1]];
          neighbors.forEach(([r, c]) => assert.ok(!result.grid[r]?.[c]));
        }
      }
    }
  }
});

test("informa palabras de crucigrama imposibles de cruzar", () => {
  const entries = engine.parseEntries("ABC | A\nXYZ | B", "crossword").entries;
  const result = engine.crossword(entries);
  assert.equal(result.placed.length, 1);
  assert.equal(result.omitted.length, 1);
});

test("la sopa contiene cada palabra en la dirección indicada", () => {
  const entries = engine.parseEntries("CAÑON\nLUNA\nESTRELLA\nSOL", "wordsearch").entries;
  const result = engine.wordsearch(entries, 12);
  assert.equal(result.omitted.length, 0);
  assert.equal(result.grid.length, 12);
  result.placed.forEach(p => {
    const actual = [...p.word].map((_, i) => result.grid[p.row + p.dr * i][p.col + p.dc * i]).join("");
    assert.equal(actual, p.word);
  });
  assert.ok(result.grid.every(row => row.length === 12 && row.every(Boolean)));
});

test("cada dirección seleccionada se respeta en ambos formatos", () => {
  const entries = engine.parseEntries("CAÑON | Una pista", "crossword").entries;
  for (const direction of engine.directions) {
    for (const result of [engine.crossword(entries, [direction.id]), engine.wordsearch(entries, 12, [direction.id])]) {
      assert.equal(result.placed.length, 1, direction.id);
      const placed = result.placed[0];
      assert.equal(placed.direction, direction.id);
      assert.equal(placed.dr, direction.dr);
      assert.equal(placed.dc, direction.dc);
      assert.equal([...placed.word].map((_, i) => result.grid[placed.row + i * placed.dr][placed.col + i * placed.dc]).join(""), placed.word);
    }
  }
});

test("el crucigrama cruza diagonales y direcciones inversas sin solaparse en paralelo", () => {
  const entries = engine.parseEntries("CAÑON | A\nNOCHE | B\nCAMINO | C\nMANO | D\nNIDO | E", "crossword").entries;
  const ids = engine.directions.map(direction => direction.id);
  for (let trial = 0; trial < 10; trial++) {
    const result = engine.crossword(entries, ids);
    assert.equal(result.placed.length, entries.length);
    for (const placed of result.placed) {
      assert.equal([...placed.word].map((_, i) => result.grid[placed.row + i * placed.dr][placed.col + i * placed.dc]).join(""), placed.word);
      assert.ok(placed.number > 0);
    }
    for (let i = 0; i < result.placed.length; i++) for (let j = i + 1; j < result.placed.length; j++) {
      const a = result.placed[i], b = result.placed[j];
      if (a.dr * b.dc !== a.dc * b.dr) continue;
      const cells = new Set([...a.word].map((_, k) => `${a.row + a.dr * k},${a.col + a.dc * k}`));
      assert.ok([...b.word].every((_, k) => !cells.has(`${b.row + b.dr * k},${b.col + b.dc * k}`)));
    }
  }
});

test("rechaza configuraciones de dirección vacías, repetidas o desconocidas", () => {
  const entries = engine.parseEntries("SOL | A", "crossword").entries;
  for (const ids of [[], ["inexistente"], ["across", "across"]]) {
    assert.throws(() => engine.crossword(entries, ids), /dirección válida/);
    assert.throws(() => engine.wordsearch(entries, 12, ids), /dirección válida/);
  }
});
