import React from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../../utils/media";
import { buildProductPath, formatCurrency } from "../../utils/storefront";

const PRODUCT_BUTTON_DISPLAY_TYPES = new Set(["view_product", "add_to_cart", "both", "none"]);

function normalizeButtonDisplayType(value, actionMode) {
  if (PRODUCT_BUTTON_DISPLAY_TYPES.has(value)) return value;
  return actionMode === "link" ? "view_product" : "add_to_cart";
}

function ProductCard({ product, context, eyebrow, actionLabel = "Add to Cart", actionMode = "cart", buttonDisplayType, onProductClick }) {
  const firstVariant = product.variants?.[0];
  const ratingValue = Number(product.rating || 0);
  const ratingPercent = `${Math.max(0, Math.min(100, (ratingValue / 5) * 100))}%`;
  const productPath = buildProductPath(product, firstVariant);
  const displayImage = resolveMediaUrl(firstVariant?.image || product.image || "");
  const hasImage = Boolean(String(displayImage || "").trim());
  const resolvedButtonDisplayType = normalizeButtonDisplayType(buttonDisplayType, actionMode);
  const showViewProduct = resolvedButtonDisplayType === "view_product" || resolvedButtonDisplayType === "both";
  const showAddToCart = resolvedButtonDisplayType === "add_to_cart" || resolvedButtonDisplayType === "both";

  return (
    <article className={`product-card ${hasImage ? "has-product-image" : "has-no-product-image"}`}>
      <span className="card-discount-badge">{product.discount}% OFF</span>
      <Link className="product-card-link" to={productPath} onClick={() => onProductClick?.(product)}>
        <div className="product-art">
          {hasImage ? (
            <img src={displayImage} alt={product.name} loading="lazy" decoding="async" />
          ) : (
            <span className="product-no-image">No image</span>
          )}
        </div>
        <p className="product-topline">{eyebrow || product.brand}</p>
        <h3>{product.name}</h3>
        <p>{product.highlights?.[0] || product.feature}</p>
      </Link>
      <div className="product-card-footer">
        <div className="card-pricing">
          <div className="card-price-line">
            <strong>{formatCurrency(firstVariant?.price ?? product.price, context)}</strong>
            <span className="card-mrp">{formatCurrency(firstVariant?.mrp ?? product.mrp, context)}</span>
          </div>
          <span className="card-rating" aria-label={`${ratingValue.toFixed(1)} out of 5 stars`}>
            <span className="card-rating-stars" aria-hidden="true" style={{ "--rating-percent": ratingPercent }} />
            <span className="card-rating-value">{ratingValue.toFixed(1)}</span>
          </span>
        </div>
        {showViewProduct || showAddToCart ? (
          <div className={`product-card-actions ${showViewProduct && showAddToCart ? "has-two-actions" : ""}`}>
            {showViewProduct ? (
              <Link className="add-to-cart product-card-view-button" to={productPath} onClick={() => onProductClick?.(product)}>
                {actionMode === "link" ? actionLabel : "View Product"}
              </Link>
            ) : null}
            {showAddToCart ? (
              <button className="add-to-cart" type="button" onClick={(event) => context.addToCart(product, firstVariant, 1, event.currentTarget)}>
                Add to Cart
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default React.memo(ProductCard);
