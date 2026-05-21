import React from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../utils/media";
import { buildProductPath, formatCurrency, getProductVariantByKey } from "../utils/storefront";

function resolveWishlistProduct(item, productCatalog = []) {
  return productCatalog.find((product) => product.slug === item.slug || String(product.asin || "") === String(item.asin || "")) || null;
}

export default function WishlistPage({ context }) {
  const productCatalog = Array.isArray(context.allProducts) ? context.allProducts : [];
  const visibleWishlist = context.wishlist.filter((item) => resolveWishlistProduct(item, productCatalog));

  const removeItem = (item) => {
    context.setWishlist((current) =>
      current.filter((entry) => !(entry.slug === item.slug && String(entry.variantLabel || "") === String(item.variantLabel || "")))
    );
    context.notify("Removed from wishlist");
  };

  const moveToCart = (item, triggerElement) => {
    const product = resolveWishlistProduct(item, productCatalog);
    if (!product) return;
    const variant = (product.variants || []).find((entry) => entry.label === item.variantLabel) || getProductVariantByKey(product);
    context.addToCart(product, variant, 1, triggerElement);
  };

  return (
    <main className="container wishlist-page">
      <section className="wishlist-hero">
        <div>
          <p className="eyebrow">Saved Products</p>
          <h1>Your Wishlist</h1>
          <p>Keep track of products you like and move them into cart when you are ready.</p>
        </div>
        <Link className="secondary-button" to="/collections">Continue Shopping</Link>
      </section>

      {visibleWishlist.length ? (
        <section className="wishlist-grid">
          {visibleWishlist.map((item) => {
            const product = resolveWishlistProduct(item, productCatalog);
            const variant = product?.variants?.find((entry) => entry.label === item.variantLabel) || product?.variants?.[0];
            const productPath = product ? buildProductPath(product, variant) : "/collections";

            return (
              <article key={`${item.slug}:${item.variantLabel || ""}`} className="wishlist-card">
                <Link className="wishlist-card-media" to={productPath}>
                  <img src={resolveMediaUrl(item.image)} alt={item.name} />
                </Link>
                <div className="wishlist-card-copy">
                  <p className="product-topline">{item.category}</p>
                  <h2><Link to={productPath}>{item.name}</Link></h2>
                  {item.variantLabel ? <span className="wishlist-variant">{item.variantLabel}</span> : null}
                  <strong>{formatCurrency(item.price, context)}</strong>
                </div>
                <div className="wishlist-card-actions">
                  <button className="primary-button" type="button" onClick={(event) => moveToCart(item, event.currentTarget)}>Add to Cart</button>
                  <button className="wishlist-remove-button" type="button" onClick={() => removeItem(item)}>Remove</button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="wishlist-empty">
          <h2>No saved products yet</h2>
          <p>Use the wishlist action on product pages to save products here.</p>
          <Link className="primary-button" to="/collections">Browse Collections</Link>
        </section>
      )}
    </main>
  );
}
