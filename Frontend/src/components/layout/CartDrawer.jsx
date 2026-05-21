import React from "react";
import { useNavigate } from "react-router-dom";
import { resolveMediaUrl } from "../../utils/media";
import { formatCurrency } from "../../utils/storefront";

export default function CartDrawer({ context }) {
  const navigate = useNavigate();
  const total = context.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

  return (
    <aside className="cart-drawer" aria-hidden={!context.isCartOpen} style={{ transform: context.isCartOpen ? "translateX(0)" : "" }}>
      <div className="cart-header">
        <div>
          <p className="eyebrow">Your Cart</p>
          <h2>Ready to checkout</h2>
          <p className="cart-subtitle">{context.cart.length ? `${context.cart.length} item${context.cart.length > 1 ? "s" : ""} ready for checkout` : "Add products to continue shopping."}</p>
        </div>
        <button className="close-cart" type="button" onClick={() => context.setIsCartOpen(false)} aria-label="Close cart">
          <span aria-hidden="true">&times;</span>
          <span className="close-cart-label">Close</span>
        </button>
      </div>
      <div className="cart-items">
        {context.cart.length ? context.cart.map((item) => (
          <article key={`${item.slug}:${item.variantLabel || ""}`} className="summary-item">
            <div className="summary-item-art"><img src={resolveMediaUrl(item.image)} alt={item.name} /></div>
            <div className="cart-item-content">
              <div className="cart-item-head">
                <div className="summary-item-copy">
                  <h3>{item.name}</h3>
                  <p className="summary-meta">{item.variantLabel || item.category}</p>
                  <p className="cart-item-unit-price">{formatCurrency(Number(item.price || 0), context)} each</p>
                </div>
                <strong className="cart-item-price">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 1), context)}</strong>
              </div>
              <div className="cart-item-actions">
                <div className="cart-qty-controls">
                  <span className="cart-qty-label">Qty</span>
                  <button type="button" aria-label="Decrease quantity" onClick={() => context.updateCartQuantity(item.slug, item.variantLabel, Number(item.quantity || 1) - 1)}>-</button>
                  <span className="cart-qty-value">{item.quantity}</span>
                  <button type="button" aria-label="Increase quantity" onClick={() => context.updateCartQuantity(item.slug, item.variantLabel, Number(item.quantity || 1) + 1)}>+</button>
                </div>
                <button type="button" className="cart-remove-button" onClick={() => context.removeCartItem(item.slug, item.variantLabel)}>Remove</button>
              </div>
            </div>
          </article>
        )) : <div className="empty-state"><h3>Your cart is empty</h3><p>Add products to continue.</p></div>}
      </div>
      <div className="cart-footer">
        <div className="cart-total"><span>Total</span><strong>{formatCurrency(total, context)}</strong></div>
        <button
          className="primary-button checkout-button"
          type="button"
          onClick={() => {
            context.setIsCartOpen(false);
            navigate("/checkout");
          }}
        >
          Proceed to Checkout
        </button>
      </div>
    </aside>
  );
}
