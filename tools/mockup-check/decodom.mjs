// Декоративные фигуры на странице: без текста, абсолютные или псевдоэлементы, круглые/пунктирные/полупрозрачные,
// хотя бы частично за краем родителя. Координаты - от родителя (как x/y слоя в выгрузке Figma).
const pseudo = (el, which) => {
  const cs = getComputedStyle(el, which);
  if (!cs.content || cs.content === "none" || cs.content === "normal" || cs.display === "none") return null;
  return cs;
};
const isDeco = (cs) =>
  cs.position === "absolute" &&
  (/(50%|\d{2,}px)/.test(cs.borderRadius) || cs.borderStyle === "dashed") &&
  (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none" || cs.borderStyle === "dashed");
const fmt = (n) => (Math.round(n * 10) / 10).toString();
export function decoDom(root = document.body) {
  const out = [];
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const ecs = getComputedStyle(el);
    if (ecs.visibility === "hidden") continue;
    const parts = [];
    // сам элемент без текста
    if (!el.textContent.trim() && el.children.length === 0 && isDeco(ecs)) {
      const p = el.offsetParent || el.parentElement;
      const pr = p.getBoundingClientRect();
      parts.push({ kind: "el", cs: ecs, x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height, pw: pr.width, ph: pr.height });
    }
    for (const which of ["::before", "::after"]) {
      const cs = pseudo(el, which);
      if (!cs || !isDeco(cs)) continue;
      const w = parseFloat(cs.width), h = parseFloat(cs.height);
      if (!w || !h) continue;
      const x = cs.left !== "auto" ? parseFloat(cs.left) : r.width - parseFloat(cs.right) - w;
      const y = cs.top !== "auto" ? parseFloat(cs.top) : r.height - parseFloat(cs.bottom) - h;
      parts.push({ kind: which, cs, x, y, w, h, pw: r.width, ph: r.height });
    }
    for (const p of parts) {
      const outside = p.x < -0.5 || p.y < -0.5 || p.x + p.w > p.pw + 0.5 || p.y + p.h > p.ph + 0.5;
      if (!outside) continue;
      const host = p.kind === "el" ? (el.offsetParent || el.parentElement) : el;
      out.push(
        `${String(host.className).replace(/__\w+/g, "").slice(0, 34)}${p.kind === "el" ? " > ." + String(el.className).replace(/__\w+/g, "").split(" ")[0].replace(/^\w+_/, "") : p.kind} ` +
          `${fmt(p.w)}x${fmt(p.h)} @${fmt(p.x)},${fmt(p.y)} in ${fmt(p.pw)}x${fmt(p.ph)} | bg ${p.cs.backgroundColor}${p.cs.backgroundImage !== "none" ? " img" : ""} op ${p.cs.opacity} r ${p.cs.borderRadius}${p.cs.borderStyle === "dashed" ? " dashed " + p.cs.borderTopWidth + " " + p.cs.borderTopColor : ""}`,
      );
    }
  }
  return [...new Set(out)];
}
