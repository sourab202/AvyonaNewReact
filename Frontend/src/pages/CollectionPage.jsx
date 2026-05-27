import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { trackAnalyticsEvent } from "../api/analyticsApi";
import { fetchStorefrontProducts } from "../api/productApi";
import ProductCard from "../components/product/ProductCard";
import { flattenCategoryTree, fallbackCategoryTree } from "../data/category-data";
import { resolveMediaList, resolveMediaUrl } from "../utils/media";
import { formatCurrency } from "../utils/storefront";

function normalizeBackendProduct(product) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price || 0);
  const stockQuantity = Number(product.stockQuantity || 0);
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const gallery = resolveMediaList(product.galleryUrls);
  const primaryImage = gallery[0] || resolveMediaUrl(product.imageUrl);

  return {
    asin: product.asin,
    sku: product.asin || product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.categoryName || "Products",
    collectionSlug: product.categorySlug || "",
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

function collectCategoryProducts(category, categoryLookup, productCatalog) {
  const directSlugs = new Set(category.productSlugs || []);
  const collectionSlugs = new Set([category.slug]);

  function includeCategoryTree(item) {
    (item.children || []).forEach((child) => {
      (child.productSlugs || []).forEach((productSlug) => directSlugs.add(productSlug));
      collectionSlugs.add(child.slug);
      includeCategoryTree(child);
    });
  }

  includeCategoryTree(category);

  const matched = productCatalog.filter((product) =>
    directSlugs.has(product.slug) || collectionSlugs.has(product.collectionSlug)
  );

  if (matched.length) {
    return matched;
  }

  if (!category.parentId) {
    return productCatalog.filter((product) => product.collectionSlug === category.slug);
  }

  const parent = categoryLookup.get(category.parentId);
  return parent ? productCatalog.filter((product) => (category.productSlugs || []).includes(product.slug)) : [];
}

function getCategoryTreeFromContext(context) {
  return context.siteCategories && context.siteCategories.length ? context.siteCategories : fallbackCategoryTree;
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

export default function CollectionPage({ context }) {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const pageRef = useRef(null);
  const trackedCategoryRef = useRef("");
  const trackedFilterRef = useRef("");
  const categoryTree = getCategoryTreeFromContext(context);
  const productCatalog = Array.isArray(context.allProducts) ? context.allProducts : [];
  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const categoryLookup = useMemo(() => new Map(flatCategories.map((category) => [category.id, category])), [flatCategories]);
  const currentCategory = flatCategories.find((category) => category.slug === slug);
  const currentCategoryBannerUrl = resolveMediaUrl(currentCategory?.bannerImageUrl || currentCategory?.imageUrl);
  const childCategories = currentCategory?.children || [];
  const selectedSubcategories = useMemo(() => getListParam(searchParams, "subcategory"), [searchParamString]);
  const selectedBrands = useMemo(() => getListParam(searchParams, "brand"), [searchParamString]);
  const availability = useMemo(() => {
    const stockValues = getListParam(searchParams, "stock");
    return stockValues.length ? stockValues : getListParam(searchParams, "availability");
  }, [searchParamString]);
  const rating = getNumberParam(searchParams, "rating", 0);
  const sortBy = searchParams.get("sort") || "latest";
  const page = Math.max(1, getNumberParam(searchParams, "page", 1));
  const [filterOpen, setFilterOpen] = useState(false);
  const [animationSeed, setAnimationSeed] = useState(0);
  const [serverProducts, setServerProducts] = useState([]);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 24, total: 0, totalPages: 1 });

  const fallbackBaseProducts = useMemo(() => {
    if (!currentCategory) return [];
    return collectCategoryProducts(currentCategory, categoryLookup, productCatalog);
  }, [currentCategory, categoryLookup, productCatalog]);
  const baseProducts = serverUnavailable ? fallbackBaseProducts : serverProducts;

  const productsWithSubcategory = useMemo(() => {
    if (!currentCategory) return [];

    const subcategoryBySlug = new Map();
    childCategories.forEach((child) => {
      (child.productSlugs || []).forEach((productSlug) => {
        subcategoryBySlug.set(productSlug, child.slug);
      });
    });

    return baseProducts.map((product) => ({
      ...product,
      subcategorySlug: subcategoryBySlug.get(product.slug) || ""
    }));
  }, [baseProducts, childCategories, currentCategory]);

  const prices = productsWithSubcategory.map((product) => product.price);
  const brands = [...new Set(productsWithSubcategory.map((product) => product.brand))];
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const priceRange = useMemo(() => [
    searchParams.has("minPrice") ? getNumberParam(searchParams, "minPrice", minPrice) : minPrice,
    searchParams.has("maxPrice") ? getNumberParam(searchParams, "maxPrice", maxPrice) : maxPrice
  ], [maxPrice, minPrice, searchParamString]);
  const totalProductCount = baseProducts.length;

  const filtered = serverUnavailable ? productsWithSubcategory
    .filter((product) => !selectedSubcategories.length || selectedSubcategories.includes(product.subcategorySlug))
    .filter((product) => !selectedBrands.length || selectedBrands.includes(product.brand))
    .filter((product) => !availability.length || availability.includes(product.stockTone))
    .filter((product) => Number(product.rating || 0) >= rating)
    .filter((product) => Number(product.price || 0) >= priceRange[0] && Number(product.price || 0) <= priceRange[1])
    .sort((left, right) => {
      if (["price", "price-low-high", "price-asc"].includes(sortBy)) return left.price - right.price;
      if (["price-high-low", "price-desc"].includes(sortBy)) return right.price - left.price;
      if (sortBy === "rating-high-low") return Number(right.rating || 0) - Number(left.rating || 0);
      if (["popularity", "popular"].includes(sortBy)) return Number(right.reviewCount || 0) - Number(left.reviewCount || 0);
      return 0;
    }) : productsWithSubcategory;

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

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
    setFilterOpen(false);
  };

  useEffect(() => {
    setFilterOpen(false);
  }, [slug]);

  useEffect(() => {
    if (!currentCategory) return undefined;
    let isMounted = true;

    async function loadCategoryProducts() {
      try {
        const response = await fetchStorefrontProducts({
          status: "active",
          categorySlug: selectedSubcategories.length ? selectedSubcategories.join(",") : currentCategory.slug,
          brand: selectedBrands.join(","),
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
        setServerUnavailable(false);
      } catch {
        if (isMounted) {
          setServerUnavailable(true);
        }
      }
    }

    loadCategoryProducts();

    return () => {
      isMounted = false;
    };
  }, [availability, currentCategory, page, priceRange, rating, searchParamString, selectedBrands, selectedSubcategories, sortBy]);

  useEffect(() => {
    document.body.classList.add("collection-page");
    document.body.classList.toggle("collection-filters-open", filterOpen);
    return () => {
      document.body.classList.remove("collection-page");
      document.body.classList.remove("collection-filters-open");
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!currentCategory) return undefined;
    if (!pageRef.current || typeof window === "undefined" || !("IntersectionObserver" in window)) return undefined;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
    );

    const animatedItems = pageRef.current.querySelectorAll("[data-animate]");
    animatedItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [currentCategory, filtered.length, slug]);

  useEffect(() => {
    setAnimationSeed((current) => current + 1);
  }, [slug, selectedSubcategories, selectedBrands, availability, rating, sortBy, priceRange]);

  useEffect(() => {
    if (!currentCategory || trackedCategoryRef.current === currentCategory.slug) return;
    trackedCategoryRef.current = currentCategory.slug;

    trackAnalyticsEvent({
      eventType: "category_view",
      categoryId: currentCategory.id,
      categorySlug: currentCategory.slug,
      metadata: {
        categoryId: currentCategory.id,
        categoryName: currentCategory.name,
        categorySlug: currentCategory.slug,
        productCount: totalProductCount
      }
    });
  }, [currentCategory, totalProductCount]);

  useEffect(() => {
    if (!currentCategory) return;

    const hasFilter = selectedSubcategories.length
      || selectedBrands.length
      || availability.length
      || rating
      || sortBy !== "latest"
      || priceRange[0] !== minPrice
      || priceRange[1] !== maxPrice;
    if (!hasFilter) return;

    const filterKey = JSON.stringify({
      category: currentCategory.slug,
      selectedSubcategories,
      selectedBrands,
      availability,
      rating,
      sortBy,
      priceRange
    });
    if (trackedFilterRef.current === filterKey) return;
    trackedFilterRef.current = filterKey;

    trackAnalyticsEvent({
      eventType: "filter_applied",
      categoryId: currentCategory.id,
      categorySlug: currentCategory.slug,
      metadata: {
        surface: "collection",
        categorySlug: currentCategory.slug,
        filters: {
          selectedSubcategories,
          selectedBrands,
          availability,
          rating,
          sortBy,
          minPrice: priceRange[0],
          maxPrice: priceRange[1]
        },
        resultCount: filtered.length
      }
    });
  }, [availability, currentCategory, filtered.length, maxPrice, minPrice, priceRange, rating, selectedBrands, selectedSubcategories, sortBy]);

  if (!currentCategory) {
    if (context.isCategoryCatalogLoading) {
      return (
        <main className="container">
          <section className="section-block">
            <div className="collection-empty-state">Loading collection...</div>
          </section>
        </main>
      );
    }

    return <Navigate to="/collections" replace />;
  }

  return (
    <main ref={pageRef} className="container collection-page">
      <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>{currentCategory.name}</span></div>
      <section className="page-section">
        <div className="collection-reference-layout">
          <section className="collection-reference-shell collection-shell-glow" data-animate="shell">
            {currentCategoryBannerUrl ? (
              <div className="collection-hero-media" style={bannerShellStyle} data-animate="intro">
                <img src={currentCategoryBannerUrl} alt={currentCategory.name} style={bannerImageStyle} />
              </div>
            ) : null}

            <div className="collection-summary collection-hero-copy" data-animate="intro">
              <p className="collection-product-count">{`${totalProductCount} PRODUCTS`}</p>
              <h1>{currentCategory.name}</h1>
              <p>{currentCategory.description || "Browse products inside this category."}</p>
            </div>
          </section>

          <section className="collection-products-shell" data-animate="panel">
            <div className="collection-reference-head">
              <div className="collection-summary secondary">
                <h2>All Products</h2>
                <p>Browse the complete featured selection from this collection.</p>
              </div>
              <div className="collection-toolbar-actions" data-animate="intro">
                <button
                  className="collection-mobile-filter-toggle"
                  type="button"
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen(true)}
                >
                  Filters
                </button>
                <label className="collection-sort-control">
                  <span className="collection-sort-label">Sort By</span>
                  <select className="collection-sort-select" value={sortBy} onChange={(event) => updateFilters({ sort: event.target.value })}>
                    <option value="latest">Latest</option>
                    <option value="price-low-high">Price: Low to High</option>
                    <option value="price-high-low">Price: High to Low</option>
                    <option value="popularity">Popularity</option>
                    <option value="rating-high-low">Top Rated</option>
                  </select>
                </label>
                <button className="collection-reset-button" type="button" onClick={resetFilters}>Reset Filters</button>
              </div>
            </div>

            {filterOpen ? <div className="collection-filter-backdrop" onClick={() => setFilterOpen(false)} /> : null}
            <aside className={`filter-panel ${filterOpen ? "is-open" : ""}`}>
              <div className="filter-panel-header">
                <div><h2>Filters</h2></div>
                <button className="collection-filter-close" type="button" onClick={() => setFilterOpen(false)}>Close</button>
              </div>

              <div className="filter-group collection-filter-sort-group">
                <label className="collection-sort-control">
                  <span className="collection-sort-label">Sort By</span>
                  <select className="collection-sort-select" value={sortBy} onChange={(event) => updateFilters({ sort: event.target.value })}>
                    <option value="latest">Latest</option>
                    <option value="price-low-high">Price: Low to High</option>
                    <option value="price-high-low">Price: High to Low</option>
                    <option value="popularity">Popularity</option>
                    <option value="rating-high-low">Top Rated</option>
                  </select>
                </label>
              </div>

              {childCategories.length ? (
                <div className="filter-group">
                  <h3>Subcategories</h3>
                  <div className="filter-options">
                    {childCategories.map((child) => (
                      <label key={child.slug} className="filter-option">
                        <input
                          type="checkbox"
                          checked={selectedSubcategories.includes(child.slug)}
                          onChange={() => toggleFilterValue("subcategory", child.slug, selectedSubcategories)}
                        />
                        <span>{child.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="filter-group">
                <h3>Brands</h3>
                <div className="filter-options">
                  {brands.map((brand) => (
                    <label key={brand} className="filter-option">
                      <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand)}
                          onChange={() => toggleFilterValue("brand", brand, selectedBrands)}
                        />
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
                      <input
                        type="checkbox"
                        checked={availability.includes(value)}
                        onChange={() => toggleFilterValue("stock", value, availability)}
                      />
                      <span>{value === "in-stock" ? "In Stock" : "Out of Stock"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <div className="filter-group-head">
                  <h3>Price</h3>
                  <span>{`${formatCurrency(priceRange[0], context)} - ${formatCurrency(priceRange[1], context)}`}</span>
                </div>
                <div className="range-slider-group">
                  <div className="range-track"></div>
                  <input type="range" min={minPrice} max={maxPrice} value={priceRange[0]} onChange={(event) => updateFilters({ minPrice: Math.min(Number(event.target.value), priceRange[1]) })} disabled={!productsWithSubcategory.length || minPrice === maxPrice} />
                  <input type="range" min={minPrice} max={maxPrice} value={priceRange[1]} onChange={(event) => updateFilters({ maxPrice: Math.max(Number(event.target.value), priceRange[0]) })} disabled={!productsWithSubcategory.length || minPrice === maxPrice} />
                </div>
              </div>

              <div className="filter-group">
                <h3>Ratings</h3>
                <div className="filter-options rating-options">
                  {[
                    { label: "All Ratings", value: 0 },
                    { label: "4.5 & Up", value: 4.5 },
                    { label: "4.0 & Up", value: 4 },
                    { label: "3.5 & Up", value: 3.5 }
                  ].map((option) => (
                    <label key={option.label} className="filter-option rating-option">
                      <input
                        type="radio"
                        name="collection-rating"
                        checked={rating === option.value}
                        onChange={() => updateFilters({ rating: option.value })}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button className="collection-reset-button filter-reset" type="button" onClick={resetFilters}>Reset Filters</button>
            </aside>

            <div className="collection-results-content">
              <div className="collection-toolbar collection-filter-toolbar">
                <div className="collection-results-meta">
                  <span>{serverUnavailable ? `${filtered.length} matching products` : `${pagination.total} matching products`}</span>
                </div>
              </div>
              <div className="product-grid">
                {filtered.map((product, index) => (
                  <div
                    key={`${product.slug}-${animationSeed}`}
                    className="collection-card-reveal"
                    style={{ "--card-index": index }}
                  >
                    <ProductCard product={product} context={context} />
                  </div>
                ))}
              </div>
              {!filtered.length ? <div className="collection-empty-state">No products match the selected filters.</div> : null}
              {!serverUnavailable && pagination.totalPages > 1 ? (
                <div className="dashboard-toolbar-actions" style={{ justifyContent: "center", marginTop: "24px" }}>
                  <button className="collection-reset-button" type="button" disabled={page <= 1} onClick={() => updateFilters({ page: Math.max(1, page - 1) }, { resetPage: false })}>Previous</button>
                  <span>{`Page ${pagination.page} of ${pagination.totalPages}`}</span>
                  <button className="collection-reset-button" type="button" disabled={!pagination.hasNextPage} onClick={() => updateFilters({ page: page + 1 }, { resetPage: false })}>Next</button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

const bannerShellStyle = {
  width: "100%",
  borderRadius: "22px",
  overflow: "hidden",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.12)"
};

const bannerImageStyle = {
  width: "100%",
  height: "260px",
  objectFit: "cover",
  display: "block"
};
