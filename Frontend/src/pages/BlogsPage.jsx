import React from "react";
import { Link } from "react-router-dom";
import { fetchStorefrontBlogs, fetchStorefrontBlogTags } from "../api/blogApi";
import { resolveMediaUrl } from "../utils/media";

const PAGE_SIZE = 9;

function formatBlogDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeBlog(blog) {
  const publishedAt = blog.publishedAt || blog.published_at || blog.createdAt || "";
  return {
    id: String(blog.id || blog.slug || blog.title),
    slug: blog.slug || "",
    title: blog.title || "",
    tag: blog.tagName || blog.tag || "",
    tagSlug: blog.tagSlug || "",
    excerpt: blog.excerpt || blog.subtitle || "",
    image: blog.featuredImageUrl || blog.image || "",
    publishedAt,
    publishedDate: formatBlogDate(publishedAt),
    publishedDateIso: String(publishedAt || "").slice(0, 10)
  };
}

export default function BlogsPage() {
  const [blogs, setBlogs] = React.useState([]);
  const [tags, setTags] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([fetchStorefrontBlogs(), fetchStorefrontBlogTags()])
      .then(([blogsResponse, tagsResponse]) => {
        if (!isMounted) return;
        const blogRows = Array.isArray(blogsResponse.data) ? blogsResponse.data : [];
        const tagRows = Array.isArray(tagsResponse.data) ? tagsResponse.data : [];
        setBlogs(blogRows.map(normalizeBlog).filter((blog) => blog.slug && blog.title));
        setTags(tagRows);
        setMessage("");
      })
      .catch(() => {
        if (!isMounted) return;
        setBlogs([]);
        setTags([]);
        setMessage("Blog posts are not available right now.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBlogs = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return blogs.filter((blog) => {
      const matchesTag = activeTag === "all" || blog.tagSlug === activeTag || blog.tag === activeTag;
      const matchesSearch = !query || [blog.title, blog.excerpt, blog.tag].some((value) => (
        String(value || "").toLowerCase().includes(query)
      ));
      return matchesTag && matchesSearch;
    });
  }, [activeTag, blogs, searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTag, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredBlogs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageBlogs = filteredBlogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <main className="container blog-listing-page">
      <section className="blog-listing-hero">
        <div>
          <p className="eyebrow">Blog Posts</p>
          <h1>Buying guides, product tips, and smart living ideas</h1>
          <p>Explore Avyona articles for product discovery, gift planning, home security, cameras, and audio choices.</p>
        </div>
      </section>

      <section className="blog-listing-controls" aria-label="Blog filters">
        <label className="blog-search-field">
          <span>Search blog</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search articles" />
        </label>
        <div className="blog-tag-filter" aria-label="Tag filters">
          <button type="button" className={activeTag === "all" ? "active" : ""} onClick={() => setActiveTag("all")}>All</button>
          {tags.map((tag) => (
            <button key={tag.id || tag.slug} type="button" className={activeTag === tag.slug ? "active" : ""} onClick={() => setActiveTag(tag.slug)}>
              {tag.name}
            </button>
          ))}
        </div>
      </section>

      {message ? <p className="blog-listing-message">{message}</p> : null}

      {!isLoading && !pageBlogs.length ? (
        <section className="blog-listing-empty">
          <h2>No blog posts found</h2>
          <p>Try a different search term or tag.</p>
        </section>
      ) : null}

      {isLoading ? (
        <section className="blog-listing-empty">
          <h2>Loading blog posts...</h2>
        </section>
      ) : pageBlogs.length ? (
        <>
          <section className="blog-grid blog-listing-grid">
            {pageBlogs.map((blog) => (
              <article key={blog.id} className="blog-card">
                <Link className="blog-card-link" to={`/blogs/${blog.slug}`}>
                  {blog.image ? <div className="blog-art"><img src={resolveMediaUrl(blog.image)} alt={blog.title} loading="lazy" decoding="async" /></div> : null}
                  <div className="blog-card-meta">
                    {blog.tag ? <span>{blog.tag}</span> : null}
                    {blog.publishedDate ? <time dateTime={blog.publishedDateIso}>{blog.publishedDate}</time> : null}
                  </div>
                  <h3>{blog.title}</h3>
                  <p>{blog.excerpt}</p>
                  <span className="blog-read-link">Read More</span>
                </Link>
              </article>
            ))}
          </section>

          {totalPages > 1 ? (
            <nav className="blog-pagination" aria-label="Blog pagination">
              <button type="button" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
              <span>{`Page ${safePage} of ${totalPages}`}</span>
              <button type="button" disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button>
            </nav>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
