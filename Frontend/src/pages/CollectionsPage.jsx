import React from "react";
import { Link } from "react-router-dom";
import { flattenCategoryTree, fallbackCategoryTree } from "../data/category-data";
import { resolveMediaUrl } from "../utils/media";

function handleCategoryImageError(event) {
  event.currentTarget.closest(".category-art")?.classList.add("category-art-missing");
  event.currentTarget.remove();
}

export default function CollectionsPage({ context }) {
  const categories = flattenCategoryTree(context?.siteCategories || fallbackCategoryTree)
    .filter((category) => !category.parentId && category.status === "active")
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

  return (
    <main className="container">
      <section className="section-block">
        <div className="section-heading section-heading-centered">
          <div>
            <p className="eyebrow category-heading-tag">Collections</p>
            <h1 className="section-title-large">Explore All Collections</h1>
            <p className="collections-intro">Browse every Avyona category from audio and cameras to smart frames and reading lights.</p>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((category) => {
            const categoryImage = resolveMediaUrl(category.bannerImageUrl || category.imageUrl);

            return (
              <Link key={category.slug} className="category-card category-card-link" to={`/category/${category.slug}`}>
                {categoryImage ? <div className="category-art"><img src={categoryImage} alt={category.name} loading="lazy" decoding="async" onError={handleCategoryImageError} /></div> : null}
                <div className="category-copy">
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                </div>
                <div className="category-meta">
                  <span className="category-meta-label">{category.featuredCategory ? "Featured Collection" : "Collection"}</span>
                  <span className="category-action-chip">Explore Now</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
