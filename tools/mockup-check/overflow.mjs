// Ищет горизонтальный скролл страницы и элементы, вылезающие за край экрана (кроме содержимого лент со скроллом)
export function overflow() {
  const vw = document.documentElement.clientWidth;
  const scrollers = [...document.querySelectorAll("*")].filter((e) => {
    const cs = getComputedStyle(e);
    return /auto|scroll|hidden|clip/.test(cs.overflowX) && e !== document.documentElement && e !== document.body;
  });
  const inScroller = (el) => scrollers.some((s) => s !== el && s.contains(el));
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
      bad.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(" ")[0].slice(0, 30)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  }
  return { vw, docScroll: document.documentElement.scrollWidth, bad: bad.slice(0, 12), total: bad.length };
}
