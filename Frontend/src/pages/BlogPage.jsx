import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { fetchStorefrontBlog, fetchStorefrontBlogs } from "../api/blogApi";
import { resolveMediaUrl } from "../utils/media";

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
    authorName: blog.authorName || "Avyona Editorial",
    excerpt: blog.excerpt || blog.subtitle || "",
    content: blog.content || "",
    image: blog.featuredImageUrl || blog.image || "",
    publishedAt,
    publishedDate: formatBlogDate(publishedAt),
    publishedDateIso: String(publishedAt || "").slice(0, 10)
  };
}

function getParagraphs(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function BlogPage() {
  const { slug } = useParams();
  const [article, setArticle] = React.useState(null);
  const [relatedBlogs, setRelatedBlogs] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [shareMessage, setShareMessage] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setNotFound(false);

    Promise.all([fetchStorefrontBlog(slug), fetchStorefrontBlogs()])
      .then(([articleResponse, blogsResponse]) => {
        if (!isMounted) return;
        const nextArticle = normalizeBlog(articleResponse.data || {});
        const rows = Array.isArray(blogsResponse.data) ? blogsResponse.data : [];
        const related = rows
          .map(normalizeBlog)
          .filter((blog) => blog.slug && blog.slug !== nextArticle.slug)
          .sort((left, right) => {
            const sameTagLeft = left.tagSlug && left.tagSlug === nextArticle.tagSlug ? 1 : 0;
            const sameTagRight = right.tagSlug && right.tagSlug === nextArticle.tagSlug ? 1 : 0;
            return sameTagRight - sameTagLeft;
          })
          .slice(0, 3);
        setArticle(nextArticle);
        setRelatedBlogs(related);
      })
      .catch(() => {
        if (isMounted) setNotFound(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = article?.title || "Avyona Blog";

  const shareArticle = async () => {
    if (navigator.share) {
      await navigator.share({ title: shareText, url: shareUrl }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(shareUrl).then(() => setShareMessage("Link copied")).catch(() => {});
    window.setTimeout(() => setShareMessage(""), 1800);
  };

  if (notFound) return <Navigate to="/blogs" replace />;

  if (isLoading || !article) {
    return (
      <main className="container blog-page-main">
        <section className="blog-article-shell">
          <p className="eyebrow">Blog Posts</p>
          <h1>Loading article...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="container blog-page-main">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/blogs">Blog Posts</Link>
        <span>/</span>
        <span>{article.title}</span>
      </div>

      <article className="blog-article-shell">
        <div className="blog-article-hero">
          <div className="blog-article-copy">
            {article.tag ? <p className="eyebrow">{article.tag}</p> : null}
            <h1>{article.title}</h1>
            {article.excerpt ? <p className="blog-article-intro">{article.excerpt}</p> : null}
            <div className="blog-article-meta">
              <span>{article.authorName}</span>
              {article.publishedDate ? <time dateTime={article.publishedDateIso}>{article.publishedDate}</time> : null}
              <button type="button" className="blog-share-button" onClick={shareArticle}>Share</button>
            </div>
            {shareMessage ? <p className="blog-share-message">{shareMessage}</p> : null}
          </div>
          {article.image ? (
            <div className="blog-article-image">
              <img src={resolveMediaUrl(article.image)} alt={article.title} />
            </div>
          ) : null}
        </div>

        <div className="blog-article-content">
          {getParagraphs(article.content).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>

      {relatedBlogs.length ? (
        <section className="section-block related-blogs-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Related Blogs</p>
              <h2>Keep reading</h2>
            </div>
          </div>
          <div className="blog-grid">
            {relatedBlogs.map((blog) => (
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
          </div>
        </section>
      ) : null}
    </main>
  );
}
