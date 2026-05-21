import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { isCouponActive } from "../../../shared/coupons";
import ProductCard from "../components/product/ProductCard";
import { resolveMediaUrl } from "../utils/media";
import { copyText } from "../utils/storefront";

function resolveOfferImageUrl(value) {
  return resolveMediaUrl(value);
}

function couponMatchesProduct(coupon, product) {
  const categories = Array.isArray(coupon?.eligibleCategories) ? coupon.eligibleCategories : [];
  if (!categories.length) return true;
  const productValues = [product?.category, product?.categorySlug, product?.collectionSlug]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return categories.some((category) => productValues.includes(String(category || "").trim().toLowerCase()));
}

export default function OffersPage({ context }) {
  const [searchParams] = useSearchParams();
  const selectedOffer = String(searchParams.get("offer") || searchParams.get("code") || "").trim().toLowerCase();
  const offers = (Array.isArray(context.coupons) ? context.coupons : [])
    .filter((coupon) => isCouponActive(coupon))
    .sort((left, right) => Number(left.homepageSortOrder || left.productPageSortOrder || 0) - Number(right.homepageSortOrder || right.productPageSortOrder || 0));
  const config = offers.find((coupon) =>
    [coupon.id, coupon.code, coupon.title, coupon.offerBadgeText]
      .filter(Boolean)
      .some((value) => String(value).trim().toLowerCase() === selectedOffer)
  ) || offers[0] || null;
  const products = config && Array.isArray(context.allProducts)
    ? context.allProducts.filter((product) => couponMatchesProduct(config, product))
    : [];

  return (
    <main className="container offers-page">
      <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>Offers</span></div>
      {config ? <section className="offer-page-hero">
        <div className="offer-page-copy">
          <p className="eyebrow">{config.offerBadgeText || config.title}</p>
          <h1>{config.offerCardTitle || config.title}</h1>
          <p>{config.offerCardDescription || config.description}</p>
          <div className="offer-page-actions">
            <button className="offer-copy-button" type="button" onClick={() => copyText(config.code, () => context.notify("Coupon copied"))}>Copy {config.code}</button>
            <span className="offer-page-code">{config.code}</span>
          </div>
        </div>
        {config.backgroundImageUrl ? <div className="offer-page-visual"><img src={resolveOfferImageUrl(config.backgroundImageUrl)} alt={config.title} /></div> : null}
      </section> : null}
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Eligible Products</p><h2>{config ? `${config.title} Products` : "Current Offers"}</h2></div></div>
        <div className="product-grid">{products.map((product) => <ProductCard key={product.slug} product={product} context={context} actionLabel="Explore" actionMode="link" />)}</div>
      </section>
    </main>
  );
}
