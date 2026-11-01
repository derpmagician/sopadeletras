"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { inflateSync } = require("node:zlib");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");
const exporter = require("../export.js");
const interactive = require("../interactive.js");

const style = { font: "original", size: 0, bold: false, italic: false, underline: false, useColor: false, color: "#292e27" };
const design = { ...style, groups: {}, titleAlignment: "center", secondaryAlignment: "right", backdrop: { mode: "none", color: "#ffffff", image: "", useBorder: false, borderColor: "#292e27" } };
const puzzle = {
  type: "wordsearch", title: "Niñez & educación", secondaryTitle: "Prueba", description: "¡Hola!",
  grid: [["S", "O", "L"], ["A", "Ñ", "O"], ["L", "U", "Z"]],
  placed: [
    { word: "SOL", row: 0, col: 0, dr: 0, dc: 1, direction: "across" },
    { word: "AÑO", row: 1, col: 0, dr: 0, dc: 1, direction: "across" }
  ], omitted: []
};
const measure = (text, size) => text.length * size * 0.6;

test("nombra las descargas a partir del título de forma compatible", () => {
  for (const extension of ["pdf", "png", "txt", "html", "json"]) {
    assert.equal(exporter.fileName("  Niñez y educación  ", extension), `Niñez y educación.${extension}`);
  }
  assert.equal(exporter.fileName('Animales / plantas: ¿qué son?', "pdf"), "Animales plantas ¿qué son.pdf");
  assert.equal(exporter.fileName("... / *", "pdf"), "Pasatiempo.pdf");
  assert.equal(exporter.fileName("", "json"), "Pasatiempo.json");
  assert.equal(exporter.fileName("CON", "pdf"), "_CON.pdf");
  assert.equal(exporter.fileName("LPT1.txt", "pdf"), "_LPT1.txt.pdf");
  assert.equal(exporter.fileName("com¹", "txt"), "_com¹.txt");
  const name = exporter.fileName("😀".repeat(100), "pdf");
  assert.equal(new TextEncoder().encode(name.slice(0, -4)).length, 180);
  assert.equal(name, "😀".repeat(45) + ".pdf");
});

test("valida orientación y márgenes de página", () => {
  assert.equal(exporter.validPage(exporter.defaultPage), true);
  assert.equal(exporter.validPage({ ...exporter.defaultPage, orientation: "landscape", left: 40 }), true);
  assert.equal(exporter.validPage({ ...exporter.defaultPage, right: 41 }), false);
  assert.equal(exporter.validPage({ ...exporter.defaultPage, top: 5.5 }), false);
});

test("exporta texto con solución opcional y conserva Ñ", () => {
  const plain = exporter.textExport(puzzle, false);
  const solved = exporter.textExport(puzzle, true);
  assert.match(plain, /A Ñ O/);
  assert.doesNotMatch(plain, /SOLUCIÓN/);
  assert.match(solved, /SOLUCIÓN/);
  assert.match(solved, /AÑO \(Horizontal\)/);
});

test("genera páginas y contornos independientes con texto separado", () => {
  const pages = exporter.svgPages(puzzle, design, exporter.defaultPage, true, measure);
  assert.equal(pages.pages.length, 2);
  assert.match(pages.pages[0].svg, /Niñez &amp; educación/);
  assert.doesNotMatch(pages.pages[0].graphics, /<text/);
  assert.ok(pages.pages[0].textLayers.some(line => line.text === puzzle.title));
  assert.equal((pages.pages[1].svg.match(/<g transform=/g) || []).length, 2);
});

test("mantiene cada línea de los títulos como texto continuo en PDF", () => {
  const pages = exporter.svgPages(puzzle, design, exporter.defaultPage, true, measure);
  for (const page of pages.pages) {
    for (const role of ["title", "secondary"]) {
      const line = page.textLayers.find(item => item.role === role);
      const item = exporter.pdfTextItem(line, measure(line.text, line.size));
      assert.equal(item.text, role === "title" ? puzzle.title : puzzle.secondaryTitle);
      assert.deepEqual(item.fontFeatures, { kern: false, liga: false, clig: false });
    }
    const description = page.textLayers.find(item => item.role === "description");
    assert.equal(exporter.pdfTextItem(description, measure(description.text, description.size)).fontFeatures, undefined);
  }
});

test("el PDF contiene una sola secuencia de glifos por línea de título", async () => {
  const lines = [
    { role: "title", text: "AVATAR Oficina Niñez", bold: false, italics: false },
    { role: "secondary", text: "AVATAR Oficina Niñez", bold: true, italics: true }
  ].map((line, index) => ({
    ...line, size: 20, x: 100, baseline: 100 + index * 30, color: "#292e27", align: "left", underline: false
  }));
  const doc = pdfMake.createPdf({ content: lines.map(line => exporter.pdfTextItem(line, 0)) }, null, null, pdfFonts);
  const bytes = await new Promise(resolve => doc.getBuffer(resolve));
  const pdf = Buffer.from(bytes).toString("latin1");
  const streams = [...pdf.matchAll(/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/gs)]
    .filter(match => match[1].includes("/FlateDecode"))
    .map(match => inflateSync(Buffer.from(match[2], "latin1")).toString("latin1"));
  const runs = streams.flatMap(stream => [...stream.matchAll(/BT\s[\s\S]*?\sET/g)].map(match => match[0]));
  assert.equal(runs.length, lines.length);
  for (const run of runs) assert.match(run, /\[<[0-9a-f]+>\s+0\]\s+TJ/i);
});

test("pagina pistas extensas sin truncar contenido", () => {
  const entries = Array.from({ length: 40 }, (_, i) => ({
    word: "SOL", clue: `Pista ${i + 1} ${"extensa ".repeat(20)}`,
    row: 0, col: 0, dr: 0, dc: 1, direction: "across", number: i + 1
  }));
  const crossword = { ...puzzle, type: "crossword", placed: entries };
  const pages = exporter.svgPages(crossword, design, exporter.defaultPage, false, measure);
  assert.ok(pages.pages.length > 1);
  assert.ok(pages.pages.flatMap(p => p.textLayers).some(line => line.text.includes("40. Pista 40")));
});

test("web interactiva escapa contenido y no depende de archivos externos", () => {
  const html = interactive.create({ ...puzzle, title: "</script><script>alert(1)</script>" }, exporter.directionNames);
  assert.ok(html.includes("&lt;/script&gt;&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes(' src="'));
  assert.ok(html.includes('id="check"'));
});
