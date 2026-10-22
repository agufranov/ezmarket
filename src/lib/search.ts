import { searchGames, searchProducts, searchQueries } from "@/data/search";

export const searchConfig = { minChars: 2, debounceMs: 300, recentMax: 10, recentShow: 3, suggestShow: 3, productsShow: 3 };

// trim, схлопывание пробелов, нижний регистр, буква «е» с точками = «е»
export const normalize = (q: string) => q.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");

const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = "йцукенгшщзхъфывапролджэячсмитьбю";

// Перевод строки по раскладке RU↔EN («икфцд» → «brawl», «ыеуфь» → «steam»)
export function switchLayout(q: string) {
  return Array.from(q)
    .map((ch) => {
      const i = RU.indexOf(ch);
      if (i >= 0) return EN[i];
      const j = EN.indexOf(ch);
      return j >= 0 ? RU[j] : ch;
    })
    .join("");
}

// Расстояние Дамерау-Левенштейна (вариант с перестановкой соседних символов)
export function damerau(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export type Suggest = ReturnType<typeof suggest>;

function find(q: string) {
  const all = searchQueries.filter((s) => normalize(s.text).includes(q));
  const queries = all.slice(0, searchConfig.suggestShow);
  const products = searchProducts
    .filter((p) => normalize(`${p.title} ${p.subtitle}`).includes(q))
    .slice(0, searchConfig.productsShow);
  // всего результатов - по самому широкому совпавшему запросу (в макете «Все 2 410 результатов» для «brawl»)
  const total = Math.max(0, ...all.map((s) => s.count), products.length);
  return { queries, products, total };
}

// Мок GET /search/suggest: подсказки, товары, а при пустом ответе - исправления и «возможно, вы искали»
export function suggest(raw: string) {
  const q = normalize(raw);
  const found = find(q);
  if (found.total > 0) return { ...found, corrections: [] as string[], didYouMean: [] as typeof searchGames };

  const corrections: string[] = [];
  const switched = switchLayout(q);
  if (switched !== q && find(switched).total > 0) corrections.push(switched);

  // опечатки: сравниваем запрос с началом популярных запросов той же длины
  const limit = q.length <= 5 ? 1 : 2;
  searchQueries
    .map((s) => ({ text: s.text, count: s.count, dist: damerau(q, normalize(s.text).slice(0, q.length)) }))
    .filter((s) => s.dist <= limit && s.text !== q)
    .sort((a, b) => a.dist - b.dist || a.text.split(" ").length - b.text.split(" ").length || b.count - a.count)
    .forEach((s) => corrections.length < 2 && !corrections.includes(s.text) && corrections.push(s.text));

  // ничего похожего - предлагаем популярное, чтобы экран не был пустым (правки 22.10)
  if (!corrections.length)
    [...searchQueries]
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .forEach((s) => corrections.push(s.text));

  const base = normalize(corrections[0] ?? "").split(" ")[0];
  const didYouMean = base ? searchGames.filter((g) => normalize(g.title).includes(base)).slice(0, 2) : [];
  // всегда 2 карточки: добираем популярными (с бейджем «хит»)
  for (const g of searchGames.filter((x) => x.hit)) if (didYouMean.length < 2 && !didYouMean.includes(g)) didYouMean.push(g);
  return { ...found, corrections, didYouMean };
}

// --- недавние запросы ---

const KEY = "ez_recent_searches";

export function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, searchConfig.recentMax)));
  } catch {}
}

// новый запрос - в начало, дубликаты без учета регистра и пробелов поднимаются
export function pushRecent(list: string[], q: string) {
  const text = q.trim().replace(/\s+/g, " ");
  if (!text) return list;
  return [text, ...list.filter((x) => normalize(x) !== normalize(text))].slice(0, searchConfig.recentMax);
}
