// Тексты кадров макета с абсолютными координатами внутри кадра: node figma-texts.mjs <figma.xml> <out.json> <id> [id...]
// В выгрузке get_metadata x/y ребенка - относительно родителя, поэтому складываем по пути от кадра
import fs from "node:fs";
const [xmlPath, outPath, ...ids] = process.argv.slice(2);
const lines = fs.readFileSync(xmlPath, "utf8").split("\n");
const attr = (l, k) => {
  const m = l.match(new RegExp(` ${k}="([^"]*)"`));
  return m ? m[1] : undefined;
};
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const out = {};
for (const id of ids) {
  const start = lines.findIndex((l) => /^  <frame /.test(l) && attr(l, "id") === id);
  if (start < 0) continue;
  const texts = [];
  const stack = []; // [indent, absX, absY]
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (i > start && /^  <\S/.test(l)) break; // следующий кадр верхнего уровня
    const m = l.match(/^(\s*)<(frame|text|rounded-rectangle|rectangle|ellipse|vector|instance|group|line|star|polygon|boolean-operation|section|slice)\b/);
    if (!m) continue;
    const indent = m[1].length;
    while (stack.length && stack[stack.length - 1][0] >= indent) stack.pop();
    const px = stack.length ? stack[stack.length - 1][1] : 0;
    const py = stack.length ? stack[stack.length - 1][2] : 0;
    const x = i === start ? 0 : px + Number(attr(l, "x") || 0);
    const y = i === start ? 0 : py + Number(attr(l, "y") || 0);
    if (m[2] === "text") {
      texts.push({ t: decode(attr(l, "name") || ""), x: Math.round(x), y: Math.round(y), w: Math.round(Number(attr(l, "width"))), h: Math.round(Number(attr(l, "height"))) });
    }
    if (!/\/>\s*$/.test(l)) stack.push([indent, x, y]);
  }
  out[id] = texts;
}
fs.writeFileSync(outPath, JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k, v.length, "texts");
