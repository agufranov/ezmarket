// Поддерево узла макета с абсолютными координатами (относительно кадра верхнего уровня):
// node figma-tree.mjs <figma.xml> <frameId> <nodeId> [maxDepth]
import fs from "node:fs";
const [xmlPath, frameId, nodeId, maxDepthArg] = process.argv.slice(2);
const maxDepth = Number(maxDepthArg || 3);
const lines = fs.readFileSync(xmlPath, "utf8").split("\n");
const attr = (l, k) => { const m = l.match(new RegExp(` ${k}="([^"]*)"`)); return m ? m[1] : undefined; };
const start = lines.findIndex((l) => /^  <frame /.test(l) && attr(l, "id") === frameId);
const stack = [];
let inNode = -1;
for (let i = start; i < lines.length; i++) {
  const l = lines[i];
  if (i > start && /^  <\S/.test(l)) break;
  const m = l.match(/^(\s*)<([a-z-]+)\b/);
  if (!m) continue;
  const indent = m[1].length;
  while (stack.length && stack[stack.length - 1][0] >= indent) stack.pop();
  const px = stack.length ? stack[stack.length - 1][1] : 0;
  const py = stack.length ? stack[stack.length - 1][2] : 0;
  const x = i === start ? 0 : px + Number(attr(l, "x") || 0);
  const y = i === start ? 0 : py + Number(attr(l, "y") || 0);
  if (attr(l, "id") === nodeId) inNode = indent;
  else if (inNode >= 0 && indent <= inNode) inNode = -1;
  if (inNode >= 0) {
    const depth = (indent - inNode) / 2;
    if (depth <= maxDepth) console.log(`${"  ".repeat(depth)}${m[2]} ${attr(l, "id")} "${(attr(l, "name") || "").slice(0, 28)}" x${Math.round(x)} y${Math.round(y)} ${Math.round(Number(attr(l, "width")))}x${Math.round(Number(attr(l, "height")))}`);
  }
  if (!/\/>\s*$/.test(l)) stack.push([indent, x, y]);
}
