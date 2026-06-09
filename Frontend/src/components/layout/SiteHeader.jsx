import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { fetchHeaderPages } from "../../api/customPageApi";
import { fetchStorefrontProducts } from "../../api/productApi";
import { flattenCategoryTree } from "../../data/category-data";
import { getSuggestionEntries, getSuggestionScore } from "../../utils/storefront";

function headerPx(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number}px` : `${fallback}px`;
}

export default function SiteHeader({ context, allProducts }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [serverSuggestions, setServerSuggestions] = useState([]);
  const [headerPages, setHeaderPages] = useState([]);
  const siteSettings = context.siteSettings || {};
  const general = siteSettings.general || {};
  const shipping = siteSettings.shipping || {};
  const payment = siteSettings.payment || {};
  const tracking = siteSettings.tracking || {};
  const header = siteSettings.header || {};
  const siteCategories = context.siteCategories || [];
  const navigate = useNavigate();
  const location = useLocation();
  const suggestionEntries = useMemo(() => getSuggestionEntries(allProducts), [allProducts]);
  const menuCategories = useMemo(
    () => flattenCategoryTree(siteCategories)
      .filter((category) => category.showInMenu && category.status === "active" && !category.parentId)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)),
    [siteCategories]
  );

  const suggestions = useMemo(() => {
    if (!searchFocused || !query.trim()) return [];
    const localSuggestions = suggestionEntries
      .map((entry) => ({ entry, score: getSuggestionScore(query, entry) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label))
      .map(({ entry }) => entry);
    const merged = new Map();

    serverSuggestions.forEach((entry) => {
      merged.set(`${entry.type}:${entry.label}`, entry);
    });
    localSuggestions.forEach((entry) => {
      merged.set(`${entry.type}:${entry.label}`, entry);
    });

    return [...merged.values()].slice(0, 6);
  }, [query, searchFocused, serverSuggestions, suggestionEntries]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/search") {
      setQuery(params.get("q") || "");
    } else {
      setQuery("");
    }
    setSearchFocused(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let isMounted = true;

    fetchHeaderPages()
      .then((response) => {
        if (!isMounted) return;
        setHeaderPages(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (isMounted) setHeaderPages([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!searchFocused || searchTerm.length < 2) {
      setServerSuggestions([]);
      return undefined;
    }

    let isMounted = true;
    const timerId = window.setTimeout(async () => {
      try {
        const response = await fetchStorefrontProducts({
          status: "active",
          search: searchTerm,
          sort: "relevance",
          limit: 6
        });
        if (!isMounted) return;

        const rows = Array.isArray(response.data) ? response.data : [];
        const nextSuggestions = rows.flatMap((product) => {
          const entries = [
            { label: product.name, type: "Product" },
            { label: product.brand, type: "Brand" },
            { label: product.modelNumber, type: "Model" },
            { label: product.sku || product.asin, type: "SKU" }
          ];

          return entries
            .map((entry) => ({ ...entry, label: String(entry.label || "").trim() }))
            .filter((entry) => entry.label);
        });

        setServerSuggestions(nextSuggestions);
      } catch {
        if (isMounted) setServerSuggestions([]);
      }
    }, 180);

    return () => {
      isMounted = false;
      window.clearTimeout(timerId);
    };
  }, [query, searchFocused]);

  const submitSearch = (value) => {
    const safeQuery = value.trim();
    setSearchFocused(false);
    navigate(safeQuery ? `/search?q=${encodeURIComponent(safeQuery)}` : "/search");
    setMenuOpen(false);
  };

  const headerStyle = {
    "--manual-header-background": header.headerBackground || "#ffffff",
    "--manual-header-text": header.headerTextColor || "#111827",
    "--manual-header-border": header.headerBorderColor || "var(--color-border)",
    "--manual-header-shadow": header.headerShadow || "var(--card-shadow, 0 10px 24px rgba(15, 23, 42, 0.08))",
    "--manual-header-top-padding": headerPx(header.headerTopPadding, 24),
    "--manual-header-bottom-padding": headerPx(header.headerBottomPadding, 22),
    "--manual-header-gap": headerPx(header.headerGap, 28),
    "--manual-logo-width": headerPx(header.logoWidth, 150),
    "--manual-logo-height": headerPx(header.logoHeight, 30),
    "--manual-logo-max-width": headerPx(header.logoMaxWidth, 180),
    "--manual-brand-text-size": headerPx(header.brandTextSize, 24),
    "--manual-search-max-width": headerPx(header.searchMaxWidth, 760),
    "--manual-search-height": headerPx(header.searchHeight, 42),
    "--manual-search-radius": headerPx(header.searchRadius, 999),
    "--manual-search-background": header.searchBackground || "var(--color-surface)",
    "--manual-search-text": header.searchTextColor || "var(--color-text)",
    "--manual-search-border": header.searchBorderColor || "var(--color-border)",
    "--manual-search-icon-size": headerPx(header.searchIconSize, 14),
    "--manual-search-icon-color": header.searchIconColor || "var(--color-muted)",
    "--manual-utility-gap": headerPx(header.utilityGap, 12),
    "--manual-account-button-size": headerPx(header.accountButtonSize, 38),
    "--manual-account-icon-size": headerPx(header.accountIconSize, 17),
    "--manual-account-color": header.accountColor || "var(--manual-header-text)",
    "--manual-account-background": header.accountBackground || "#ffffff",
    "--manual-account-radius": headerPx(header.accountRadius, 999),
    "--manual-wishlist-button-size": headerPx(header.wishlistButtonSize, 38),
    "--manual-wishlist-icon-size": headerPx(header.wishlistIconSize, 17),
    "--manual-wishlist-color": header.wishlistColor || "var(--manual-header-text)",
    "--manual-wishlist-background": header.wishlistBackground || "#ffffff",
    "--manual-wishlist-radius": headerPx(header.wishlistRadius, 999),
    "--manual-cart-button-height": headerPx(header.cartButtonHeight, 30),
    "--manual-cart-padding-x": headerPx(header.cartButtonPaddingX, 10),
    "--manual-cart-icon-size": headerPx(header.cartIconSize, 17),
    "--manual-cart-background": header.cartBackground || "var(--button-primary-bg, var(--brand))",
    "--manual-cart-text": header.cartTextColor || "var(--button-primary-text, #fff)",
    "--manual-cart-radius": headerPx(header.cartRadius, 8),
    "--manual-cart-badge-background": header.cartBadgeBackground || "#ffffff",
    "--manual-cart-badge-text": header.cartBadgeTextColor || "var(--color-primary)"
  };
  const accountLabel = header.accountText || (context.authUser ? "Profile" : "Sign In");
  const cartLabel = header.cartText || "Cart";

  return (
    <>
      <div className="announcement-bar">
        <div className="container announcement-content">
          <p>Free shipping on all orders</p>
          <p>{payment.codEnabled ? "COD available across India" : "Secure prepaid checkout available"}</p>
          <p>{general.brandTagline || "Genuine products from trusted brands"}</p>
          <Link to="/contact-us">Need help? Talk to our team</Link>
        </div>
      </div>
      <header className="site-header" style={headerStyle}>
        <div className="container header-top">
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z" /></svg>
          </button>
          <Link className="brand-lockup" to="/" aria-label={`${general.storeName || "Avyona"} home`}>
            {general.logoUrl ? <img className="brand-logo" src={general.logoUrl} alt={`${general.storeName || "Avyona"} logo`} fetchPriority="high" /> : <span className="brand-text">{general.storeName || "Avyona"}</span>}
          </Link>
          <form className="header-search" role="search" aria-label={`Search ${general.storeName || "Avyona"} products`} onSubmit={(event) => { event.preventDefault(); submitSearch(query); }}>
            <button className="search-icon search-submit-button" type="submit" aria-label="Search">{header.searchIconText || "⌕"}</button>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setSearchFocused(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitSearch(query);
                }
              }}
              placeholder={header.searchPlaceholder || "Search products, brands, ASIN, SKU, features"}
            />
            {suggestions.length ? (
              <div className="search-suggestion-list">
                {suggestions.map((entry) => (
                  <button key={`${entry.type}:${entry.label}`} className="search-suggestion-item" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => submitSearch(entry.label)}>
                    <strong>{entry.label}</strong>
                    <span>{entry.type}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </form>
          <div className="header-utilities">
            <Link className="icon-link" to={context.authUser ? "/profile" : "/account"} aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.86 0-7 2.24-7 5v1h14v-1c0-2.76-3.14-5-7-5Z" /></svg>
              {header.showAccountText ? <span className="header-action-text">{accountLabel}</span> : null}
            </Link>
            <Link className="icon-link" to="/wishlist" aria-label="Wishlist">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.55 10.55 19.2C5.4 14.45 2 11.36 2 7.5A5.5 5.5 0 0 1 7.5 2 6 6 0 0 1 12 4.09 6 6 0 0 1 16.5 2 5.5 5.5 0 0 1 22 7.5c0 3.86-3.4 6.95-8.55 11.7Z" /></svg>
            </Link>
            <button className="cart-button" type="button" data-cart-target="true" onClick={() => context.setIsCartOpen(true)} aria-label="Open cart">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM7.17 14h9.92a2 2 0 0 0 1.95-1.57L21 6H6.21l-.32-2H2v2h2.19l1.72 8.59A2 2 0 0 0 7.88 16H19v-2H7.88Z" /></svg>
              {header.showCartText ? <strong className="header-action-text">{cartLabel}</strong> : null}
              <span>{context.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</span>
            </button>
          </div>
        </div>
        <div className="container nav-row">
          <nav className={`main-nav ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
            {menuCategories.map((category) => (
              <NavLink key={category.slug} to={`/category/${category.slug}`} onClick={() => setMenuOpen(false)}>
                {category.name}
              </NavLink>
            ))}
            {headerPages.map((page) => (
              <NavLink key={page.id || page.slug} to={page.url || `/pages/${page.slug}`} onClick={() => setMenuOpen(false)}>
                {page.title}
              </NavLink>
            ))}
            <NavLink to="/contact-us" onClick={() => setMenuOpen(false)}>Contact Us</NavLink>
            {tracking.trackingPageEnabled ? (
              <NavLink to="/track-order" onClick={() => setMenuOpen(false)}>Track Your Order</NavLink>
            ) : null}
          </nav>
        </div>
      </header>
    </>
  );
}
