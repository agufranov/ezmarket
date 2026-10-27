// Декоративные фигуры кадра: лист-фигура (без детей), которая вылезает за родителя - как «капля» 12:1035
import fs from "node:fs";
const [xmlPath, ...ids] = process.argv.slice(2);
const lines = fs.readFileSync(xmlPath, "utf8").split("\n");
const attr = (l, k) => { const m = l.match(new RegExp(` ${k}="([^"]*)"`)); return m ? m[1] : undefined; };
for (const id of ids) {
  const start = lines.findIndex((l) => /^  <frame /.test(l) && attr(l, "id") === id);
  if (start < 0) continue;
  const stack = [];
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (i > start && /^  <\S/.test(l)) break;
    const m = l.match(/^(\s*)<(frame|rounded-rectangle|ellipse|rectangle|vector)\b/);
    if (!m) continue;
    const ind = m[1].length;
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    const node = { ind, id: attr(l, "id"), name: attr(l, "name"), x: +attr(l, "x"), y: +attr(l, "y"), w: +attr(l, "width"), h: +attr(l, "height"), leaf: /\/>\s*$/.test(l) };
    const p = stack[stack.length - 1];
    if (p && node.leaf && node.w >= 12 && node.h >= 12 && /Background|Overlay|Border|Gradient|Shadow/.test(node.name)) {
      const out1 = node.x < -0.5 || node.y < -0.5 || node.x + node.w > p.w + 0.5 || node.y + node.h > p.h + 0.5;
      if (out1) out.push(`${node.id} ${node.name} ${node.w.toFixed(0)}x${node.h.toFixed(0)} @${node.x.toFixed(1)},${node.y.toFixed(1)} in ${p.id} ${p.name} ${p.w.toFixed(0)}x${p.h.toFixed(0)}`);
    }
    if (!node.leaf) stack.push(node);
  }
  console.log(`== ${id}: ${out.length}`);
  for (const o of out) console.log("  " + o);
}
