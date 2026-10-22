"use client";

import Image from "next/image";
import type { Product } from "@/data/mocks";
import { routes } from "@/config/routes";
import { useModal } from "@/lib/modal";
import { formatPrice } from "@/lib/format";
import { Button } from "./Button";
import s from "./ProductCard.module.scss";

type Props = { product: Product; priority?: boolean; className?: string };

export function ProductCard({ product, priority, className }: Props) {
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
      {product.discount && <span className={s.discount}>-{product.discount}%</span>}
      {product.badge && <span className={s.badge}>{product.badge}</span>}
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
