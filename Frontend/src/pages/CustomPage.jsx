import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchCustomPage } from "../api/customPageApi";
import { resolveMediaUrl } from "../utils/media";

function titleFromSlug(slug = "") {
  return String(slug || "custom-page")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function plainText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(value = "") {
  if (!value) return window.location.href;
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${window.location.origin}${normalized}`;
}

function normalizeBlockType(block = {}) {
  return String(block.blockType || block.type || "")
    .toLowerCase()
    .replace(/\s*\+\s*/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_block$|_section$/g, "")
    .replace("full_width_banner", "banner")
    .replace("cta_button", "button");
}

function getBlockContent(block = {}) {
  if (block.content && typeof block.content === "object") return block.content;
  return { text: String(block.content || "") };
}

function getHeading(block = {}) {
  const content = getBlockContent(block);
  return block.textHeading || block.imageTextHeading || content.heading || block.blockTitle || block.title || "";
}

function getParagraph(block = {}) {
  const content = getBlockContent(block);
  return block.paragraphText || block.imageTextParagraph || content.paragraph || content.body || content.text || "";
}

function getImageAlt(block = {}) {
  return block.imageAlt || block.imageAltText || block.imageTitle || block.blockTitle || block.title || "";
}

function getLayoutPosition(block = {}) {
  return block.layoutPosition || block.imageTextLayout || block.imagePosition || "image-left";
}

function getTextAlignment(block = {}) {
  return block.textAlignment || block.textAlign || block.imageTextAlign || "left";
}

function getBlockStyle(block = {}) {
  return {
    "--custom-block-text": block.textColor || "var(--text)",
    "--custom-block-bg": block.backgroundColor || "transparent",
    "--custom-block-font-size": `${Number(block.fontSize || 16)}px`,
    "--custom-block-padding": `${Number(block.padding ?? 0)}px`
  };
}

function isSafeCustomPageCss(value = "") {
  const css = String(value || "").trim();
  if (!css) return false;
  if (css.length > 10000) return false;
  if (!/\.avyona-custom-page[\s.#:[,{>+~]/i.test(`${css} `)) return false;
  if (!/[{}]/.test(css)) return false;
  return !/(<\s*script\b|javascript\s*:|@import\b|\biframe\b|\sonclick\s*=|\sonerror\s*=)/i.test(css);
}

function applyCustomPageSeo(page, slug) {
  const title = page.metaTitle || page.ogTitle || page.title || titleFromSlug(slug);
  const description = plainText(page.metaDescription || page.ogDescription || getParagraph(page.blocks?.[0]) || `${title} | Avyona`);
  const canonical = toAbsoluteUrl(page.canonicalUrl || `/pages/${page.slug || slug}`);
  const image = resolveMediaUrl(page.ogImageUrl || "");

  document.title = title;

  const setMeta = ({ name, property, content }) => {
    const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      if (name) element.setAttribute("name", name);
      if (property) element.setAttribute("property", property);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content || "");
  };

  let canonicalLink = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute("href", canonical);

  setMeta({ name: "description", content: description });
  setMeta({ name: "keywords", content: page.metaKeywords || "" });
  setMeta({ name: "robots", content: String(page.robots || "index/follow").replace("/", ", ") });
  setMeta({ property: "og:type", content: "website" });
  setMeta({ property: "og:title", content: page.ogTitle || title });
  setMeta({ property: "og:description", content: page.ogDescription || description });
  setMeta({ property: "og:url", content: canonical });
  if (image) setMeta({ property: "og:image", content: toAbsoluteUrl(image) });
  setMeta({ name: "twitter:card", content: image ? "summary_large_image" : "summary" });
  setMeta({ name: "twitter:title", content: page.ogTitle || title });
  setMeta({ name: "twitter:description", content: page.ogDescription || description });
  if (image) setMeta({ name: "twitter:image", content: toAbsoluteUrl(image) });
}

function CustomPageNotFound() {
  return (
    <main className="container not-found-page">
      <section className="not-found-card">
        <p className="eyebrow">404</p>
        <h1>Page Not Found</h1>
        <p>The page you are looking for could not be found.</p>
        <Link className="primary-button" to="/">Go Home</Link>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="container custom-page-shell">
      <section className="custom-page-loading" aria-label="Loading page">
        <span />
        <span />
        <span />
      </section>
    </main>
  );
}

function TextContent({ text }) {
  return String(text || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph, index) => <p key={`${paragraph.slice(0, 12)}-${index}`}>{paragraph}</p>);
}

function RenderImage({ block, className = "" }) {
  const imageUrl = resolveMediaUrl(block.imageUrl || block.image_url || "");
  if (!imageUrl) return null;

  return (
    <figure
      className={`custom-page-image-frame ${className}`.trim()}
      style={{ width: block.imageWidth || undefined }}
    >
      <img
        src={imageUrl}
        alt={getImageAlt(block)}
        title={block.imageTitle || ""}
        style={{
          borderRadius: `${Number(block.borderRadius || 0)}px`
        }}
      />
      {(block.imageCaption || block.image_caption) ? <figcaption>{block.imageCaption || block.image_caption}</figcaption> : null}
    </figure>
  );
}

function CustomPageButton({ to = "#", children }) {
  const href = String(to || "#");
  if (/^(https?:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return <a className="primary-button" href={href} target="_blank" rel="noreferrer">{children}</a>;
  }
  return <Link className="primary-button" to={href}>{children}</Link>;
}

function renderFaqItems(block = {}) {
  const content = getBlockContent(block);
  if (Array.isArray(content.items)) return content.items;
  if (Array.isArray(content.faqs)) return content.faqs;

  const text = getParagraph(block);
  const [question, ...answerParts] = text.split("?");
  return [{
    question: question ? `${question.trim()}?` : getHeading(block) || "Question",
    answer: answerParts.join("?").trim() || text
  }];
}

function CustomPageBlock({ block }) {
  const type = normalizeBlockType(block);
  const heading = getHeading(block);
  const paragraph = getParagraph(block);
  const alignment = getTextAlignment(block);
  const layout = getLayoutPosition(block);
  const content = getBlockContent(block);
  const customClass = String(block.customCssClass || "").replace(/[^a-z0-9_-]/gi, " ");

  if (type === "image") {
    return (
      <section className={`custom-page-block custom-page-image-block is-${layout} ${customClass}`} style={getBlockStyle(block)}>
        <RenderImage block={block} />
      </section>
    );
  }

  if (type === "image_text") {
    return (
      <section className={`custom-page-block custom-page-image-text is-${layout} ${customClass}`} style={getBlockStyle(block)}>
        <RenderImage block={block} />
        <div className="custom-page-copy" style={{ textAlign: alignment }}>
          {heading ? <h2>{heading}</h2> : null}
          <TextContent text={paragraph} />
          {block.buttonText ? <CustomPageButton to={block.buttonLink}>{block.buttonText}</CustomPageButton> : null}
        </div>
      </section>
    );
  }

  if (type === "heading") {
    return (
      <section className={`custom-page-block custom-page-heading-block ${customClass}`} style={{ ...getBlockStyle(block), textAlign: alignment }}>
        <h2>{heading || paragraph}</h2>
      </section>
    );
  }

  if (type === "banner") {
    return (
      <section className={`custom-page-block custom-page-banner-block ${customClass}`} style={getBlockStyle(block)}>
        <RenderImage block={block} />
        <div>
          <h2>{heading || paragraph}</h2>
          {heading && paragraph ? <TextContent text={paragraph} /> : null}
          {block.buttonText ? <CustomPageButton to={block.buttonLink}>{block.buttonText}</CustomPageButton> : null}
        </div>
      </section>
    );
  }

  if (type === "two_column") {
    const left = content.left || content.leftColumn || String(paragraph).split("|")[0] || "";
    const right = content.right || content.rightColumn || String(paragraph).split("|").slice(1).join("|") || "";
    return (
      <section className={`custom-page-block custom-page-two-column ${customClass}`} style={getBlockStyle(block)}>
        <div><TextContent text={left} /></div>
        <div><TextContent text={right} /></div>
      </section>
    );
  }

  if (type === "faq") {
    return (
      <section className={`custom-page-block custom-page-faq-block ${customClass}`} style={getBlockStyle(block)}>
        {heading ? <h2>{heading}</h2> : null}
        <div className="custom-page-faq-list">
          {renderFaqItems(block).map((item, index) => (
            <details key={`${item.question || index}-${index}`} open={index === 0}>
              <summary>{item.question || item.heading || "Question"}</summary>
              <p>{item.answer || item.body || item.text || ""}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }

  if (type === "button") {
    return (
      <section className={`custom-page-block custom-page-button-block ${customClass}`} style={{ ...getBlockStyle(block), textAlign: alignment }}>
        <CustomPageButton to={block.buttonLink || content.link || "#"}>{block.buttonText || content.label || heading || paragraph || "Learn More"}</CustomPageButton>
      </section>
    );
  }

  return (
    <section className={`custom-page-block custom-page-text-block ${customClass}`} style={{ ...getBlockStyle(block), textAlign: alignment }}>
      {heading ? <h2>{heading}</h2> : null}
      <TextContent text={paragraph} />
    </section>
  );
}

export default function CustomPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState("loading");
  const fallbackTitle = titleFromSlug(slug);
  const isPreview = new URLSearchParams(location.search).get("preview") === "true";
  const blocks = useMemo(() => (
    Array.isArray(page?.blocks)
      ? [...page.blocks].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
      : []
  ), [page]);

  useEffect(() => {
    let isMounted = true;
    setStatus("loading");
    setPage(null);

    fetchCustomPage(slug, { preview: isPreview })
      .then((response) => {
        if (!isMounted) return;
        setPage(response.data);
        setStatus("ready");
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus("not-found");
      });

    return () => {
      isMounted = false;
    };
  }, [isPreview, slug]);

  useEffect(() => {
    if (status === "ready" && page) {
      applyCustomPageSeo(page, slug);
    }
    if (status === "not-found") {
      document.title = "Page Not Found | Avyona";
    }
  }, [page, slug, status]);

  if (status === "loading") return <LoadingState />;
  if (status === "not-found") return <CustomPageNotFound />;

  return (
    <main className="container custom-page-shell avyona-custom-page">
      {isSafeCustomPageCss(page?.customCss) ? <style>{page.customCss}</style> : null}
      <nav className="custom-page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>{page?.title || fallbackTitle}</span>
      </nav>

      <section className="custom-page-hero">
        {isPreview ? <span className="custom-page-preview-badge">Preview</span> : null}
        <h1>{page?.title || fallbackTitle}</h1>
        {page?.metaDescription ? <p>{page.metaDescription}</p> : null}
      </section>

      <div className="custom-page-content">
        {blocks.length ? blocks.map((block) => <CustomPageBlock key={block.id} block={block} />) : (
          <section className="custom-page-block custom-page-text-block">
            <p>This page does not have any active content yet.</p>
          </section>
        )}
      </div>
    </main>
  );
}
