// Сверка текстов страницы с кадром макета: координаты каждого текста макета против того же текста на странице.
// В странице: const { cmp } = await import("http://127.0.0.1:3031/cmp.mjs"); await cmp("38:3203")
const norm = (s) => s.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

function domTexts() {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = norm(n.nodeValue || "");
    if (!t) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style,noscript,.visually-hidden,[aria-hidden='true'] .visually-hidden")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({ t, el, x: r.left, y: r.top + scrollY, w: r.width, h: r.height });
  }
  // элемент с несколькими текстовыми узлами (жирное внутри) - еще и целиком
  for (const el of document.querySelectorAll("p,span,b,a,button,h1,h2,h3,li,label,div")) {
    if (el.childElementCount === 0 || el.childElementCount > 4) continue;
    const t = norm(el.textContent || "");
    if (!t || t.length > 120) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({ t, el, x: r.left, y: r.top + scrollY, w: r.width, h: r.height, whole: true });
  }
  return out;
}

// конечные анимации - сразу в конечный кадр: в скрытой вкладке они стоят на первом кадре
export function settle() {
  for (const a of document.getAnimations()) {
    const it = a.effect?.getComputedTiming?.().iterations;
    if (it !== Infinity) {
      try {
        a.finish();
      } catch {}
    }
  }
}

export async function cmp(frameId, { tol = 3, offsetY = 0, only } = {}) {
  settle();
  const all = await (await fetch("http://127.0.0.1:3031/figma-texts.json")).json();
  const mock = all[frameId];
  if (!mock) return `нет кадра ${frameId}`;
  const dom = domTexts();
  const rows = [];
  const missing = [];
  for (const m of mock) {
    const mt = norm(m.t);
    if (only && !only.some((o) => mt.includes(o))) continue;
    const cands = dom.filter((d) => d.t === mt);
    if (!cands.length) {
      missing.push(mt.slice(0, 40));
      continue;
    }
    const mcx = m.x;
    const mcy = m.y + m.h / 2 + offsetY;
    const best = cands.reduce((a, b) => (Math.hypot(a.x - mcx, a.y + a.h / 2 - mcy) <= Math.hypot(b.x - mcx, b.y + b.h / 2 - mcy) ? a : b));
    const dx = Math.round(best.x - m.x);
    const dy = Math.round(best.y + best.h / 2 - mcy);
    const dw = Math.round(best.w - m.w);
    if (Math.abs(dx) > tol || Math.abs(dy) > tol || dw > tol) rows.push(`${mt.slice(0, 34)} | макет ${m.x},${Math.round(mcy)} w${m.w} | у нас ${Math.round(best.x)},${Math.round(best.y + best.h / 2)} w${Math.round(best.w)} | dx ${dx} dy ${dy} dw ${dw}`);
  }
  return { frame: frameId, total: mock.length, off: rows.length, rows, missing };
}
