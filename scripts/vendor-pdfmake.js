"use strict";

const fs = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "node_modules", "pdfmake");
const target = path.join(__dirname, "..", "vendor", "pdfmake");
fs.mkdirSync(target, { recursive: true });
for (const file of ["build/pdfmake.min.js", "build/vfs_fonts.js", "LICENSE"]) {
  fs.copyFileSync(path.join(source, file), path.join(target, path.basename(file)));
}
const pdfkit = require.resolve("@foliojs-fork/pdfkit", { paths: [source] });
const fontkit = require(require.resolve("@foliojs-fork/fontkit", { paths: [path.dirname(pdfkit)] }));
const fonts = require(path.join(source, "build", "vfs_fonts.js"));
const sets = Object.values(fonts).map(data => new Set(fontkit.create(Buffer.from(data, "base64")).characterSet));
const points = [...sets[0]].filter(point => sets.every(set => set.has(point))).sort((a, b) => a - b);
const ranges = [];
for (const point of points) {
  const last = ranges[ranges.length - 1];
  if (last && point === last[1] + 1) last[1] = point;
  else ranges.push([point, point]);
}
fs.writeFileSync(path.join(target, "roboto-coverage.js"), `window.RobotoCoverage = ${JSON.stringify(ranges)};\n`);
