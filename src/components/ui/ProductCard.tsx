"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/data/mocks";
import { routes } from "@/config/routes";
import { useModal } from "@/lib/modal";
import { formatPrice } from "@/lib/format";
import { Button } from "./Button";
import s from "./ProductCard.module.scss";

type Props = { product: Product; priority?: boolean; className?: string };

export function ProductCard({ product, priority, className }: Props) {
  const [fav, setFav] = useState(false);
  const { openModal } = useModal();
  const href = routes.product(product.slug);
  const { cover } = product;

  return (
    <article className={[s.card, className].filter(Boolean).join(" ")}>
      <a href={href} className={s.cover} aria-label={product.title} tabIndex={-1}>
        {cover.kind === "art" ? (
          <Image
            src={cover.src}
            alt=""
            fill
            sizes="(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 216px"
            className={s.art}
            priority={priority}
          />
        ) : (
          <span className={s.brand} style={{ backgroundImage: cover.gradient }}>
            <span className={s.brandRing} />
            <span className={s.brandDash} />
            <span className={s.brandTile}>
              <Image src={cover.src} alt="" width={50} height={50} className={s.brandLogo} />
            </span>
          </span>
        )}
      </a>
      {product.discount && <span className={s.discount}>−{product.discount}%</span>}
      {product.badge && <span className={s.badge}>{product.badge}</span>}
      <button
        type="button"
        className={[s.fav, fav && s.favOn, product.badge && s.favLow].filter(Boolean).join(" ")}
        aria-pressed={fav}
        aria-label={fav ? "Убрать из избранного" : "В избранное"}
        onClick={() => setFav((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.4 2.4h1.6c.8-1.3 2.3-2.4 4.4-2.4 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" />
        </svg>
      </button>
      <div className={s.body}>
        <p className={s.meta}>
          {product.brand} · {product.type}
        </p>
        <h3 className={s.title}>
          <a href={href}>{product.title}</a>
        </h3>
        <p className={s.prices}>
          <span className={s.price}>{formatPrice(product.price)}</span>
          {product.oldPrice && <s className={s.old}>{formatPrice(product.oldPrice)}</s>}
        </p>
        <Button variant="soft" size="sm" block className={s.buy} onClick={() => openModal("quick-buy")}>
          Купить
        </Button>
      </div>
    </article>
  );
}
