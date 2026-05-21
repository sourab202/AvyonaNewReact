import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trackAnalyticsEvent } from "../api/analyticsApi";
import { fetchStorefrontProducts } from "../api/productApi";
import ProductCard from "../components/product/ProductCard";
import { resolveMediaList, resolveMediaUrl } from "../utils/media";
import { formatCurrency, getSearchResults } from "../utils/storefront";

function normalizeBackendProduct(product) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price || 0);
  const stockQuantity = Number(product.stockQuantity || 0);
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const collectionSlug = product.categorySlug || String(product.categoryName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const gallery = resolveMediaList(product.galleryUrls);
  const primaryImage = gallery[0] || resolveMediaUrl(product.imageUrl);

  return {
    id: product.id,
    asin: product.asin,
    sku: product.asin || product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.categoryName || "Products",
    collectionSlug,
    price,
    mrp,
    discount,
    image: primaryImage,
    gallery,
    highlights: [product.shortDescription || "New Avyona product"].filter(Boolean),
    description: product.description ? String(product.description).split(/\n+/).filter(Boolean) : [product.shortDescription || "Product details will be updated soon."],
    rating: Number(product.rating || 0),
    reviewCount: Number(product.reviewCount || 0),
    availableStock: stockQuantity,
    stockTone: stockQuantity > 0 ? "in-stock" : "out-of-stock",
    variants: [],
    specGroups: [],
    reviews: [],
    faqs: []
  };
}

function getListParam(searchParams, key) {
  return String(searchParams.get(key) || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNumberParam(searchParams, key, fallback = 0) {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) ? value : fallback;
}

export default function SearchPage({ context }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const query = searchParams.get("q") || "";
  const brandFilter = useMemo(() => getListParam(searchParams, "brand"), [searchParamString]);
  const categoryFilter = useMemo(() => getListParam(searchParams, "category"), [searchParamString]);
  const availability = useMemo(() => {
    const stockValues = getListParam(searchParams, "stock");
    return stockValues.length ? stockValues : getListParam(searchParams, "availability");
  }, [searchParamString]);
  const rating = getNumberParam(searchParams, "rating", 0);
  const sortBy = searchParams.get("sort") || "latest";
  const page = Math.max(1, getNumberParam(searchParams, "page", 1));
  const productCatalog = Array.isArray(context.allProducts) ? context.allProducts : [];
  const fallbackResults = useMemo(() => getSearchResults(productCatalog, query), [productCatalog, query]);
  const [serverProducts, setServerProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 24, total: 0, totalPages: 1 });
  const [facets, setFacets] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const trackedQueryRef = useRef("");
  const trackedFilterRef = useRef("");
  const products = serverUnavailable ? fallbackResults.map((entry) => entry.product) : serverProducts;
  const facetPrice = facets?.price || null;
  const fallbackPrices = products.map((product) => product.price).filter((price) => Number.isFinite(Number(price)));
  const minPrice = Number(facetPrice?.min ?? (fallbackPrices.length ? Math.min(...fallbackPrices) : 0));
  const maxPrice = Number(facetPrice?.max ?? (fallbackPrices.length ? Math.max(...fallbackPrices) : 0));
  const priceRange = useMemo(() => [
    searchParams.has("minPrice") ? getNumberParam(searchParams, "minPrice", minPrice) : minPrice,
    searchParams.has("maxPrice") ? getNumberParam(searchParams, "maxPrice", maxPrice) : maxPrice
  ], [maxPrice, minPrice, searchParamString]);

  const updateFilters = (updates, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length) next.set(key, value.join(","));
        else next.delete(key);
        return;
      }
      if (value === undefined || value === null || value === "" || value === 0) next.delete(key);
      else next.set(key, String(value));
    });
    if (resetPage) next.delete("page");
    setSearchParams(next);
  };

  const toggleFilterValue = (key, value, current) => {
    updateFilters({
      [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function loadSearchResults() {
      setIsLoading(true);
      try {
        const response = await fetchStorefrontProducts({
          status: "active",
          search: query,
          brand: brandFilter.join(","),
          category: categoryFilter.join(","),
          stock: availability.join(","),
          minPrice: searchParams.has("minPrice") ? priceRange[0] : "",
          maxPrice: searchParams.has("maxPrice") ? priceRange[1] : "",
          rating: rating || "",
          sort: sortBy,
          page,
          limit: 24
        });
        if (!isMounted) return;
        setServerProducts((Array.isArray(response.data) ? response.data : []).map(normalizeBackendProduct));
        setPagination(response.pagination || { page, limit: 24, total: 0, totalPages: 1 });
        setFacets(response.facets || null);
        setServerUnavailable(false);
        if (query.trim() && trackedQueryRef.current !== query.trim().toLowerCase()) {
          trackedQueryRef.current = query.trim().toLowerCase();
          trackAnalyticsEvent({
            eventType: "search",
            query: query.trim(),
            metadata: {
              resultCount: Number(response.pagination?.total ?? response.count ?? 0)
            }
          });
        }
      } catch {
        if (!isMounted) return;
        setServerUnavailable(true);
        if (query.trim() && trackedQueryRef.current !== query.trim().toLowerCase()) {
          trackedQueryRef.current = query.trim().toLowerCase();
          trackAnalyticsEvent({
            eventType: "search",
            query: query.trim(),
            metadata: {
              resultCount: fallbackResults.length,
              source: "fallback"
            }
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSearchResults();

    return () => {
      isMounted = false;
    };
  }, [availability, brandFilter, categoryFilter, page, priceRange, query, rating, searchParamString, sortBy]);

  const brands = facets?.brands?.length ? facets.brands.map((brand) => brand.value) : [...new Set(products.map((product) => product.brand))];
  const categories = facets?.categories?.length ? facets.categories : [];

  const trackSearchResultClick = (product) => {
    if (!query.trim()) return;

    trackAnalyticsEvent({
      eventType: "product_view",
      productId: product.id,
      productAsin: product.asin,
      productSlug: product.slug,
      clickedProductId: product.id,
      clickedProductAsin: product.asin,
      clickedProductSlug: product.slug,
      query: query.trim(),
      resultCount: pagination.total || filtered.length,
      metadata: {
        surface: "search_results",
        productName: product.name,
        resultCount: pagination.total || filtered.length
      }
    });
  };

  useEffect(() => {
    document.body.classList.toggle("search-filters-open", filterOpen);
    return () => document.body.classList.remove("search-filters-open");
  }, [filterOpen]);

  const filtered = serverUnavailable ? products.filter((product) => {
    const brandPass = !brandFilter.length || brandFilter.includes(product.brand);
    const categoryPass = !categoryFilter.length || categoryFilter.includes(product.collectionSlug);
    const availabilityPass = !availability.length || availability.includes(product.stockTone);
    const ratingPass = Number(product.rating || 0) >= rating;
    const pricePass = Number(product.price || 0) >= priceRange[0] && Number(product.price || 0) <= priceRange[1];
    return brandPass && categoryPass && availabilityPass && ratingPass && pricePass;
  }).sort((left, right) => {
    if (["price", "price-low-high", "price-asc"].includes(sortBy)) return Number(left.price || 0) - Number(right.price || 0);
    if (["price-high-low", "price-desc"].includes(sortBy)) return Number(right.price || 0) - Number(left.price || 0);
    if (sortBy === "rating-high-low") return Number(right.rating || 0) - Number(left.rating || 0);
    if (["popularity", "popular"].includes(sortBy)) return Number(right.reviewCount || 0) - Number(left.reviewCount || 0);
    return 0;
  }) : products;

  useEffect(() => {
    const hasFilter = brandFilter.length || categoryFilter.length || availability.length || rating || sortBy !== "latest" || priceRange[0] !== minPrice || priceRange[1] !== maxPrice;
    if (!hasFilter) return;

    const filterKey = JSON.stringify({
      query: query.trim(),
      brandFilter,
      categoryFilter,
      availability,
      rating,
      priceRange,
      sortBy
    });
    if (trackedFilterRef.current === filterKey) return;
    trackedFilterRef.current = filterKey;

    trackAnalyticsEvent({
      eventType: "filter_applied",
      query: query.trim(),
      metadata: {
        surface: "search",
        filters: {
          brands: brandFilter,
          categories: categoryFilter,
          availability,
          minPrice: priceRange[0],
          maxPrice: priceRange[1],
          rating,
          sortBy
        },
        resultCount: serverUnavailable ? filtered.length : pagination.total
      }
    });
  }, [availability, brandFilter, categoryFilter, filtered.length, maxPrice, minPrice, pagination.total, priceRange, query, rating, serverUnavailable, sortBy]);

  return (
    <main className="container search-page">
      <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>Search</span></div>
      <section className="search-hero">
        <div className="search-hero-copy">
          <h1>{query ? `Results for "${query}"` : "Search Products"}</h1>
          <p className="search-summary">{serverUnavailable ? filtered.length : pagination.total} products matched your search.</p>
          <p className="search-helper-note">You can search by product name, brand, category, SKU, or ASIN.</p>
        </div>
      </section>
      <section className="section-block search-panel">
        <div className="search-results-layout">
          <button className="search-mobile-filter-toggle" type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}>Filter</button>
          {filterOpen ? <div className="search-filter-backdrop" onClick={() => setFilterOpen(false)} /> : null}
          <aside className={`filter-panel ${filterOpen ? "is-open" : ""}`}>
            <div className="filter-panel-head">
              <h2>Filters</h2>
              <button className="search-filter-close" type="button" onClick={() => setFilterOpen(false)}>Close</button>
            </div>
            {categories.length ? (
              <div className="filter-group">
                <h3>Categories</h3>
                <div className="filter-options">
                  {categories.map((category) => (
                    <label key={category.value} className="filter-option">
                      <input type="checkbox" checked={categoryFilter.includes(category.value)} onChange={() => toggleFilterValue("category", category.value, categoryFilter)} />
                      <span>{category.label || category.value}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="filter-group">
              <h3>Sort By</h3>
              <select value={sortBy} onChange={(event) => updateFilters({ sort: event.target.value })}>
                <option value="latest">Latest</option>
                <option value="price-low-high">Price: Low to High</option>
                <option value="price-high-low">Price: High to Low</option>
                <option value="popularity">Popularity</option>
                <option value="rating-high-low">Top Rated</option>
              </select>
            </div>
            <div className="filter-group">
              <h3>Brands</h3>
              <div className="filter-options">
                {brands.map((brand) => (
                  <label key={brand} className="filter-option">
                    <input type="checkbox" checked={brandFilter.includes(brand)} onChange={() => toggleFilterValue("brand", brand, brandFilter)} />
                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h3>Availability</h3>
              <div className="filter-options">
                {["in-stock", "out-of-stock"].map((value) => (
                  <label key={value} className="filter-option">
                    <input type="checkbox" checked={availability.includes(value)} onChange={() => toggleFilterValue("stock", value, availability)} />
                    <span>{value === "in-stock" ? "In Stock" : "Out of Stock"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <div className="filter-group-head">
                <h3>Price</h3>
                <span>{products.length ? `${formatCurrency(priceRange[0])} - ${formatCurrency(priceRange[1])}` : "No products"}</span>
              </div>
              <div className="range-slider-group">
                <div className="range-track"></div>
                <input type="range" min={minPrice} max={maxPrice} value={priceRange[0]} onChange={(event) => updateFilters({ minPrice: Math.min(Number(event.target.value), priceRange[1]) })} disabled={!products.length || minPrice === maxPrice} />
                <input type="range" min={minPrice} max={maxPrice} value={priceRange[1]} onChange={(event) => updateFilters({ maxPrice: Math.max(Number(event.target.value), priceRange[0]) })} disabled={!products.length || minPrice === maxPrice} />
              </div>
            </div>
            <div className="filter-group">
              <h3>Minimum Rating</h3>
              <select value={rating} onChange={(event) => updateFilters({ rating: Number(event.target.value) })}>
                <option value="0">All Ratings</option>
                <option value="4.5">4.5 and up</option>
                <option value="4">4.0 and up</option>
                <option value="3.5">3.5 and up</option>
              </select>
            </div>
            <button
              className="text-link filter-reset"
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                ["brand", "category", "stock", "availability", "rating", "minPrice", "maxPrice", "sort", "page"].forEach((key) => next.delete(key));
                setSearchParams(next);
                setFilterOpen(false);
              }}
            >
              Reset
            </button>
          </aside>
          <div className="search-results-content">
            <div className="section-heading"><div><h2>Products</h2>{isLoading ? <p>Loading products...</p> : null}</div></div>
            <div className="product-grid">
              {filtered.length ? filtered.map((product) => <ProductCard key={product.slug} product={product} context={context} eyebrow={`${product.brand} | ${product.category}`} actionLabel="Open Product" actionMode="link" onProductClick={trackSearchResultClick} />) : <div className="empty-state"><h3>No matching products found</h3><p>Try another keyword.</p></div>}
            </div>
            {!serverUnavailable && pagination.totalPages > 1 ? (
              <div className="dashboard-toolbar-actions" style={{ justifyContent: "center", marginTop: "24px" }}>
                <button className="collection-reset-button" type="button" disabled={page <= 1} onClick={() => updateFilters({ page: Math.max(1, page - 1) }, { resetPage: false })}>Previous</button>
                <span>{`Page ${pagination.page} of ${pagination.totalPages}`}</span>
                <button className="collection-reset-button" type="button" disabled={!pagination.hasNextPage} onClick={() => updateFilters({ page: page + 1 }, { resetPage: false })}>Next</button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
