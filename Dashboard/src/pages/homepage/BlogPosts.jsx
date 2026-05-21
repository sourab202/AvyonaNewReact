import React from "react";
import { Link } from "react-router-dom";
import { fetchHomepageSectionSettings, updateHomepageSectionSettings } from "../../api/adminApi";
import { blogEntries } from "../../data/storefront-content";
import { canAccess } from "../../utils/accessControl";
import { resolveAdminMediaUrl } from "../../utils/media";
import { getStorefrontBaseUrl } from "../../utils/storefront";
import { DEFAULT_APP_SETTINGS } from "../../../../shared/appSettings";

const today = new Date().toISOString().slice(0, 10);
const statusOptions = ["all", "draft", "active", "inactive"];
const editorStatusOptions = ["draft", "active", "inactive"];
const sortOptions = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" }
];
const defaultBlogTags = [
  "Buying Guide",
  "Product Tips",
  "Smart Living",
  "Audio Guide",
  "Camera Guide",
  "Home Security",
  "Gift Ideas"
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugToDate(index) {
  const base = new Date("2026-05-01T00:00:00.000Z");
  base.setDate(base.getDate() - index * 4);
  return base.toISOString().slice(0, 10);
}

function createEmptyForm() {
  return {
    id: "",
    title: "",
    slug: "",
    subtitle: "",
    tag: "",
    newTag: "",
    authorName: "",
    publishedAt: today,
    image: "",
    content: "",
    excerpt: "",
    status: "draft",
    showOnHomepage: false,
    homepageSortOrder: "0",
    metaTitle: "",
    metaDescription: "",
    metaKeywords: "",
    canonicalUrl: "",
    ogImage: ""
  };
}

function createBlogRows() {
  return blogEntries.map((entry, index) => ({
    id: entry.slug,
    slug: entry.slug,
    title: entry.title,
    subtitle: entry.body || "",
    tag: entry.category || "General",
    authorName: "Avyona Editorial",
    status: index === blogEntries.length - 1 ? "inactive" : "active",
    showOnHomepage: index < 3,
    homepageSortOrder: String(index + 1),
    publishedAt: slugToDate(index),
    image: entry.image || "",
    content: (entry.sections || [])
      .map((section) => `${section.heading}\n${(section.paragraphs || []).join("\n\n")}`)
      .join("\n\n"),
    excerpt: entry.body || entry.intro || "",
    metaTitle: entry.title,
    metaDescription: entry.intro || entry.body || "",
    metaKeywords: [entry.category, entry.title, "Avyona blog"].filter(Boolean).join(", "),
    canonicalUrl: `/blogs/${entry.slug}`,
    ogImage: entry.image || ""
  }));
}

function createInitialTags() {
  const articleTags = blogEntries.map((entry) => entry.category).filter(Boolean);
  return [...new Set([...defaultBlogTags, ...articleTags])].map((name, index) => ({
    id: slugify(name) || `tag-${index + 1}`,
    name,
    status: "active"
  }));
}

function normalizeSectionSettings(value = {}) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.blogPostsSettings;
  const desktopCards = Math.min(10, Math.max(1, Number(value?.cardsPerRow || fallback.cardsPerRow)));
  return {
    ...fallback,
    ...(value || {}),
    enabled: value?.enabled !== false,
    title: String(value?.title || fallback.title).trim(),
    subtitle: String(value?.subtitle || fallback.subtitle || "").trim(),
    cardsPerRow: desktopCards,
    tabletCardsPerRow: Math.min(6, Math.max(1, Number(value?.tabletCardsPerRow || fallback.tabletCardsPerRow || desktopCards))),
    mobileCardsPerRow: Math.min(3, Math.max(1, Number(value?.mobileCardsPerRow || fallback.mobileCardsPerRow))),
    sortOrder: fallback.sortOrder
  };
}

function getStatusStyle(status) {
  if (status === "active") return { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
  if (status === "draft") return { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" };
  return { background: "#fee2e2", color: "#b91c1c", borderColor: "#fecaca" };
}

function BlogImage({ src, title }) {
  const imageUrl = resolveAdminMediaUrl(src);

  if (!imageUrl) {
    return (
      <div style={imagePlaceholderStyle}>
        {String(title || "B").slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return <img src={imageUrl} alt={title} style={imageStyle} loading="lazy" decoding="async" />;
}

export default function BlogPosts() {
  const [blogs, setBlogs] = React.useState(createBlogRows);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("all");
  const [sortOrder, setSortOrder] = React.useState("latest");
  const [message, setMessage] = React.useState("");
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editingBlogId, setEditingBlogId] = React.useState(null);
  const [form, setForm] = React.useState(createEmptyForm);
  const [isDragging, setIsDragging] = React.useState(false);
  const [blogTags, setBlogTags] = React.useState(createInitialTags);
  const [tagForm, setTagForm] = React.useState({ name: "", editingTagId: null });
  const [sectionSettings, setSectionSettings] = React.useState(() => normalizeSectionSettings());
  const [isSavingSectionSettings, setIsSavingSectionSettings] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const storefrontBaseUrl = getStorefrontBaseUrl();
  const canViewBlogs = canAccess("blogs", "view");
  const canCreateBlogs = canAccess("blogs", "create");
  const canEditBlogs = canAccess("blogs", "edit");
  const canDeleteBlogs = canAccess("blogs", "delete");
  const canPublishBlogs = canAccess("blogs", "publish");

  React.useEffect(() => {
    let isMounted = true;

    fetchHomepageSectionSettings("blog-posts")
      .then((response) => {
        if (isMounted) setSectionSettings(normalizeSectionSettings(response.data?.data));
      })
      .catch(() => {
        if (isMounted) setSectionSettings(normalizeSectionSettings());
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const tagOptions = React.useMemo(() => (
    blogTags.filter((tag) => tag.status === "active").map((tag) => tag.name).sort()
  ), [blogTags]);

  const filterTagOptions = React.useMemo(() => (
    [...new Set([...blogTags.map((tag) => tag.name), ...blogs.map((blog) => blog.tag)].filter(Boolean))].sort()
  ), [blogTags, blogs]);

  const filteredBlogs = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return blogs
      .filter((blog) => {
        const matchesSearch = !query || [blog.title, blog.tag, blog.excerpt, blog.subtitle].some((value) => (
          String(value || "").toLowerCase().includes(query)
        ));
        const matchesStatus = statusFilter === "all" || blog.status === statusFilter;
        const matchesTag = tagFilter === "all" || blog.tag === tagFilter;
        return matchesSearch && matchesStatus && matchesTag;
      })
      .sort((left, right) => {
        const leftDate = new Date(left.publishedAt).getTime() || 0;
        const rightDate = new Date(right.publishedAt).getTime() || 0;
        return sortOrder === "oldest" ? leftDate - rightDate : rightDate - leftDate;
      });
  }, [blogs, searchTerm, sortOrder, statusFilter, tagFilter]);

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && (!current.slug || current.slug === slugify(current.title))) {
        next.slug = slugify(value);
      }
      return next;
    });
    setMessage("");
  };

  const updateBlog = (blogId, values, nextMessage) => {
    setBlogs((current) => current.map((blog) => (
      blog.id === blogId ? { ...blog, ...values } : blog
    )));
    setMessage(nextMessage);
  };

  const updateSectionField = (key, value) => {
    setSectionSettings((current) => normalizeSectionSettings({ ...current, [key]: value }));
    setMessage("");
  };

  const saveSectionSettings = async () => {
    setIsSavingSectionSettings(true);
    try {
      const payload = normalizeSectionSettings(sectionSettings);
      const response = await updateHomepageSectionSettings("blog-posts", payload);
      setSectionSettings(normalizeSectionSettings(response.data?.data || payload));
      setMessage("Blog Post homepage layout settings saved.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save Blog Post layout settings.");
    } finally {
      setIsSavingSectionSettings(false);
    }
  };

  const saveTag = (event) => {
    event.preventDefault();
    if (tagForm.editingTagId && !canEditBlogs) {
      setMessage("You do not have permission to edit blog tags.");
      return;
    }
    if (!tagForm.editingTagId && !canCreateBlogs) {
      setMessage("You do not have permission to create blog tags.");
      return;
    }
    const name = tagForm.name.trim();
    if (!name) {
      setMessage("Tag name is required.");
      return;
    }

    const duplicateTag = blogTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase() && tag.id !== tagForm.editingTagId);
    if (duplicateTag) {
      setMessage("A blog tag with this name already exists.");
      return;
    }

    if (tagForm.editingTagId) {
      const previousTag = blogTags.find((tag) => tag.id === tagForm.editingTagId);
      setBlogTags((current) => current.map((tag) => tag.id === tagForm.editingTagId ? { ...tag, name } : tag));
      if (previousTag?.name) {
        setBlogs((current) => current.map((blog) => blog.tag === previousTag.name ? { ...blog, tag: name } : blog));
        setForm((current) => current.tag === previousTag.name ? { ...current, tag: name } : current);
      }
      setMessage("Blog tag updated.");
    } else {
      const id = slugify(name) || `tag-${Date.now()}`;
      setBlogTags((current) => [...current, { id, name, status: "active" }]);
      setMessage("New blog tag created.");
    }

    setTagForm({ name: "", editingTagId: null });
  };

  const editTag = (tag) => {
    setTagForm({ name: tag.name, editingTagId: tag.id });
    setMessage(`Editing tag ${tag.name}.`);
  };

  const deleteTag = (tagId) => {
    if (!canDeleteBlogs) {
      setMessage("You do not have permission to delete blog tags.");
      return;
    }
    const tag = blogTags.find((entry) => entry.id === tagId);
    setBlogTags((current) => current.filter((entry) => entry.id !== tagId));
    if (tag?.name) {
      setBlogs((current) => current.map((blog) => blog.tag === tag.name ? { ...blog, tag: "General" } : blog));
      setForm((current) => current.tag === tag.name ? { ...current, tag: "" } : current);
      if (tagFilter === tag.name) setTagFilter("all");
    }
    setMessage("Blog tag deleted.");
  };

  const toggleTagStatus = (tagId) => {
    setBlogTags((current) => current.map((tag) => (
      tag.id === tagId ? { ...tag, status: tag.status === "active" ? "inactive" : "active" } : tag
    )));
    setMessage("Blog tag status updated.");
  };

  const openCreateForm = () => {
    if (!canCreateBlogs) {
      setMessage("You do not have permission to create blogs.");
      return;
    }
    setEditingBlogId(null);
    setForm(createEmptyForm());
    setIsEditorOpen(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEditForm = (blog) => {
    if (!canEditBlogs) {
      setMessage("You do not have permission to edit blogs.");
      return;
    }
    setEditingBlogId(blog.id);
    setForm({ ...createEmptyForm(), ...blog, newTag: "" });
    setIsEditorOpen(true);
    setMessage(`Editing ${blog.title}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingBlogId(null);
    setForm(createEmptyForm());
    setIsDragging(false);
  };

  const handleImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = String(reader.result || "");
      setForm((current) => ({
        ...current,
        image: imageUrl,
        ogImage: current.ogImage || imageUrl
      }));
      setMessage("Featured image ready for preview.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleImageFile(event.dataTransfer.files?.[0]);
  };

  const removeImage = () => {
    setForm((current) => ({ ...current, image: "", ogImage: current.ogImage === current.image ? "" : current.ogImage }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (editingBlogId && !canEditBlogs) {
      setMessage("You do not have permission to edit blogs.");
      return;
    }
    if (!editingBlogId && !canCreateBlogs) {
      setMessage("You do not have permission to create blogs.");
      return;
    }
    const title = form.title.trim();
    const slug = slugify(form.slug || form.title);
    const tag = form.newTag.trim() || form.tag.trim();

    if (!title || !slug || !tag) {
      setMessage("Blog Title, Blog Slug, and Blog Tag are required.");
      return;
    }

    const duplicateSlug = blogs.some((blog) => blog.slug === slug && blog.id !== editingBlogId);
    if (duplicateSlug) {
      setMessage("Blog slug already exists. Use a unique slug.");
      return;
    }

    if (form.newTag.trim()) {
      const newTagName = form.newTag.trim();
      const hasTag = blogTags.some((entry) => entry.name.toLowerCase() === newTagName.toLowerCase());
      if (!hasTag) {
        setBlogTags((current) => [...current, { id: slugify(newTagName) || `tag-${Date.now()}`, name: newTagName, status: "active" }]);
      }
    }

    const payload = {
      ...form,
      id: editingBlogId || slug,
      title,
      slug,
      tag,
      authorName: form.authorName.trim() || "Avyona Editorial",
      publishedAt: form.publishedAt || today,
      homepageSortOrder: String(Number(form.homepageSortOrder || 0)),
      metaTitle: form.metaTitle.trim() || title,
      canonicalUrl: form.canonicalUrl.trim() || `/blogs/${slug}`
    };

    setBlogs((current) => {
      if (editingBlogId) {
        return current.map((blog) => blog.id === editingBlogId ? payload : blog);
      }
      return [payload, ...current];
    });
    setMessage(editingBlogId ? "Blog updated in local dashboard list." : "New blog added to local dashboard list.");
    closeEditor();
  };

  const toggleStatus = (blog) => {
    if (!canPublishBlogs) {
      setMessage("You do not have permission to publish blogs.");
      return;
    }
    const nextStatus = blog.status === "active" ? "inactive" : "active";
    updateBlog(blog.id, { status: nextStatus }, `Blog marked ${nextStatus}.`);
  };

  const toggleHomepage = (blog) => {
    if (!canEditBlogs) {
      setMessage("You do not have permission to edit blog homepage visibility.");
      return;
    }
    const nextValue = !blog.showOnHomepage;
    updateBlog(blog.id, { showOnHomepage: nextValue }, nextValue ? "Blog shown on homepage." : "Blog hidden from homepage.");
  };

  const deleteBlog = (blogId) => {
    if (!canDeleteBlogs) {
      setMessage("You do not have permission to delete blogs.");
      return;
    }
    setBlogs((current) => current.filter((blog) => blog.id !== blogId));
    if (editingBlogId === blogId) closeEditor();
    setMessage("Blog deleted from the local dashboard list.");
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTagFilter("all");
    setSortOrder("latest");
    setMessage("");
  };

  if (!canViewBlogs) {
    return (
      <section className="dashboard-page-shell">
        <div style={heroStyle}>
          <div>
            <span style={eyebrowStyle}>Blogs</span>
            <h2 style={titleStyle}>Access denied</h2>
            <p style={copyStyle}>You do not have permission to view or manage blogs.</p>
          </div>
          <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <div>
          <span style={eyebrowStyle}>Homepage Section</span>
          <h2 style={titleStyle}>Blog Post</h2>
          <p style={copyStyle}>Manage blog articles shown on the homepage and blog page.</p>
        </div>
        {canCreateBlogs ? <button type="button" style={primaryButtonStyle} onClick={openCreateForm}>Add New Blog</button> : null}
      </div>

      <div style={layoutControlStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h3 style={panelTitleStyle}>Homepage layout control</h3>
            <p style={panelCopyStyle}>Enable, name, and control Blog Post cards for desktop, tablet, and mobile.</p>
          </div>
        </div>
        <div style={layoutGridStyle}>
          <label style={toggleFieldStyle}><input type="checkbox" checked={sectionSettings.enabled} onChange={(event) => updateSectionField("enabled", event.target.checked)} /><span>Enable Blog Post section</span></label>
          <label style={fieldStyle}><span style={labelStyle}>Title</span><input value={sectionSettings.title} onChange={(event) => updateSectionField("title", event.target.value)} style={inputStyle} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Subtitle</span><input value={sectionSettings.subtitle} onChange={(event) => updateSectionField("subtitle", event.target.value)} style={inputStyle} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Desktop cards per row</span><input type="number" min="1" max="10" value={sectionSettings.cardsPerRow} onChange={(event) => updateSectionField("cardsPerRow", event.target.value)} style={inputStyle} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Tablet cards per row</span><input type="number" min="1" max="6" value={sectionSettings.tabletCardsPerRow} onChange={(event) => updateSectionField("tabletCardsPerRow", event.target.value)} style={inputStyle} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Mobile cards per row</span><input type="number" min="1" max="3" value={sectionSettings.mobileCardsPerRow} onChange={(event) => updateSectionField("mobileCardsPerRow", event.target.value)} style={inputStyle} /></label>
              {canEditBlogs ? <button type="button" style={primaryButtonStyle} onClick={saveSectionSettings} disabled={isSavingSectionSettings}>{isSavingSectionSettings ? "Saving..." : "Save Layout"}</button> : null}
        </div>
      </div>

      {isEditorOpen ? (
        <form style={editorShellStyle} onSubmit={handleSubmit}>
          <div style={tableHeaderStyle}>
            <div>
              <h3 style={panelTitleStyle}>{editingBlogId ? "Edit Blog" : "Add New Blog"}</h3>
              <p style={panelCopyStyle}>Create article content, homepage placement, and SEO metadata.</p>
            </div>
            <button type="button" style={secondaryButtonStyle} onClick={closeEditor}>Close</button>
          </div>

          <div style={formSectionStyle}>
            <h4 style={formSectionTitleStyle}>Basic Details</h4>
            <div style={formGridStyle}>
              <label style={fieldStyle}><span style={labelStyle}>Blog Title</span><input value={form.title} onChange={(event) => updateForm("title", event.target.value)} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Blog Slug</span><input value={form.slug} onChange={(event) => updateForm("slug", slugify(event.target.value))} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Short Subtitle</span><input value={form.subtitle} onChange={(event) => updateForm("subtitle", event.target.value)} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Blog Tag</span><select value={form.tag} onChange={(event) => updateForm("tag", event.target.value)} style={inputStyle}><option value="">Select tag</option>{tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
              <label style={fieldStyle}><span style={labelStyle}>Create New Tag option</span><input value={form.newTag} onChange={(event) => updateForm("newTag", event.target.value)} placeholder="Optional new tag" style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Author Name</span><input value={form.authorName} onChange={(event) => updateForm("authorName", event.target.value)} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Published Date</span><input type="date" value={form.publishedAt} onChange={(event) => updateForm("publishedAt", event.target.value)} style={inputStyle} /></label>
            </div>
          </div>

          <div style={formSectionStyle}>
            <h4 style={formSectionTitleStyle}>Image</h4>
            <div
              style={isDragging ? dropzoneActiveStyle : dropzoneStyle}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => handleImageFile(event.target.files?.[0])} style={{ display: "none" }} />
              {form.image ? (
                <img src={resolveAdminMediaUrl(form.image)} alt="Featured preview" style={previewImageStyle} />
              ) : (
                <div>
                  <strong>Featured Image upload</strong>
                  <p style={dropzoneCopyStyle}>Drag and drop upload or click to upload.</p>
                </div>
              )}
            </div>
            <div style={imageActionsStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={() => fileInputRef.current?.click()}>{form.image ? "Replace image" : "Click to upload"}</button>
              <button type="button" style={secondaryButtonStyle} onClick={removeImage}>Remove image</button>
            </div>
          </div>

          <div style={formSectionStyle}>
            <h4 style={formSectionTitleStyle}>Content</h4>
            <label style={fieldStyle}><span style={labelStyle}>Blog Content</span><textarea value={form.content} onChange={(event) => updateForm("content", event.target.value)} style={textareaStyle} /></label>
            <label style={fieldStyle}><span style={labelStyle}>Short Excerpt</span><textarea value={form.excerpt} onChange={(event) => updateForm("excerpt", event.target.value)} style={shortTextareaStyle} /></label>
          </div>

          <div style={formSectionStyle}>
            <h4 style={formSectionTitleStyle}>Display Controls</h4>
            <div style={formGridStyle}>
              <label style={fieldStyle}><span style={labelStyle}>Status</span><select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={inputStyle}>{editorStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label style={fieldStyle}><span style={labelStyle}>Homepage Sort Order</span><input type="number" value={form.homepageSortOrder} onChange={(event) => updateForm("homepageSortOrder", event.target.value)} style={inputStyle} /></label>
              <label style={toggleFieldStyle}><input type="checkbox" checked={form.showOnHomepage} onChange={(event) => updateForm("showOnHomepage", event.target.checked)} /><span>Show on Homepage toggle</span></label>
            </div>
          </div>

          <div style={formSectionStyle}>
            <h4 style={formSectionTitleStyle}>SEO</h4>
            <div style={formGridStyle}>
              <label style={fieldStyle}><span style={labelStyle}>Meta Title</span><input value={form.metaTitle} onChange={(event) => updateForm("metaTitle", event.target.value)} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Canonical URL</span><input value={form.canonicalUrl} onChange={(event) => updateForm("canonicalUrl", event.target.value)} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Meta Keywords</span><input value={form.metaKeywords} onChange={(event) => updateForm("metaKeywords", event.target.value)} style={inputStyle} /></label>
              <label style={fieldStyle}><span style={labelStyle}>OG Image</span><input value={form.ogImage} onChange={(event) => updateForm("ogImage", event.target.value)} style={inputStyle} /></label>
            </div>
            <label style={fieldStyle}><span style={labelStyle}>Meta Description</span><textarea value={form.metaDescription} onChange={(event) => updateForm("metaDescription", event.target.value)} style={shortTextareaStyle} /></label>
          </div>

          <div style={formActionsStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={closeEditor}>Cancel</button>
            {(editingBlogId ? canEditBlogs : canCreateBlogs) ? <button type="submit" style={primaryButtonStyle}>{editingBlogId ? "Update Blog" : "Create Blog"}</button> : null}
          </div>
        </form>
      ) : null}

      <div style={tagManagerStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h3 style={panelTitleStyle}>Blog tag management</h3>
            <p style={panelCopyStyle}>Create, edit, delete, and activate or inactivate blog tags.</p>
          </div>
        </div>

        <form style={tagFormStyle} onSubmit={saveTag}>
          <label style={fieldStyle}>
            <span style={labelStyle}>{tagForm.editingTagId ? "Edit tag" : "Create new tag"}</span>
            <input value={tagForm.name} onChange={(event) => setTagForm((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Buying Guide" style={inputStyle} />
          </label>
          {(tagForm.editingTagId ? canEditBlogs : canCreateBlogs) ? <button type="submit" style={primaryButtonStyle}>{tagForm.editingTagId ? "Update Tag" : "Create Tag"}</button> : null}
          {tagForm.editingTagId ? (
            <button type="button" style={secondaryButtonStyle} onClick={() => setTagForm({ name: "", editingTagId: null })}>Cancel</button>
          ) : null}
        </form>

        <div style={tagListStyle}>
          {blogTags.map((tag) => (
            <div key={tag.id} style={tagItemStyle}>
              <div>
                <strong style={tagNameStyle}>{tag.name}</strong>
                <span style={{ ...badgeStyle, ...getStatusStyle(tag.status) }}>{tag.status}</span>
              </div>
              <div style={tagActionsStyle}>
                {canEditBlogs ? <button type="button" style={actionButtonStyle} onClick={() => editTag(tag)}>Edit</button> : null}
                {canPublishBlogs ? <button type="button" style={actionButtonStyle} onClick={() => toggleTagStatus(tag.id)}>{tag.status === "active" ? "Inactivate" : "Activate"}</button> : null}
                {canDeleteBlogs ? <button type="button" style={actionButtonStyle} onClick={() => deleteTag(tag.id)}>Delete</button> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={toolbarStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Search blog</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by title, tag, or summary" style={inputStyle} />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
            {statusOptions.map((status) => <option key={status} value={status}>{status === "all" ? "All Status" : status}</option>)}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Tag</span>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} style={inputStyle}>
            <option value="all">All Tags</option>
            {filterTagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Sort</span>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} style={inputStyle}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <button type="button" style={secondaryButtonStyle} onClick={resetFilters}>Reset</button>
      </div>

      {message ? <div style={messageStyle}>{message}</div> : null}

      <div style={tableShellStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h3 style={panelTitleStyle}>Blog list</h3>
            <p style={panelCopyStyle}>{`${filteredBlogs.length} blog${filteredBlogs.length === 1 ? "" : "s"} found`}</p>
          </div>
          <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage</Link>
        </div>

        <div style={tableScrollStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Featured Image</th>
                <th style={thStyle}>Blog Title</th>
                <th style={thStyle}>Tag</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Show on Homepage</th>
                <th style={thStyle}>Published Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBlogs.map((blog) => (
                <tr key={blog.id} style={trStyle}>
                  <td style={tdStyle}><BlogImage src={blog.image} title={blog.title} /></td>
                  <td style={tdStyle}>
                    <div style={titleCellStyle}>{blog.title}</div>
                    <div style={summaryStyle}>{blog.excerpt || blog.subtitle}</div>
                  </td>
                  <td style={tdStyle}><span style={tagStyle}>{blog.tag}</span></td>
                  <td style={tdStyle}><span style={{ ...badgeStyle, ...getStatusStyle(blog.status) }}>{blog.status}</span></td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => toggleHomepage(blog)} style={blog.showOnHomepage ? toggleOnStyle : toggleOffStyle}>
                      {blog.showOnHomepage ? "Shown" : "Hidden"}
                    </button>
                  </td>
                  <td style={tdStyle}>{formatDate(blog.publishedAt)}</td>
                  <td style={tdStyle}>
                    <div style={actionsStyle}>
                      <a href={`${storefrontBaseUrl}/blogs/${blog.slug}`} target="_blank" rel="noreferrer" style={actionButtonStyle}>View</a>
                      {canEditBlogs ? <button type="button" style={actionButtonStyle} onClick={() => openEditForm(blog)}>Edit</button> : null}
                      {canDeleteBlogs ? <button type="button" style={actionButtonStyle} onClick={() => deleteBlog(blog.id)}>Delete</button> : null}
                      {canPublishBlogs ? <button type="button" style={actionButtonStyle} onClick={() => toggleStatus(blog)}>{blog.status === "active" ? "Inactive" : "Active"}</button> : null}
                      {canEditBlogs ? <button type="button" style={actionButtonStyle} onClick={() => toggleHomepage(blog)}>{blog.showOnHomepage ? "Hide on Homepage" : "Show on Homepage"}</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredBlogs.length ? (
                <tr><td colSpan="7" style={emptyStyle}>No blog posts match the selected filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const heroStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "28px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #ffffff 0%, #f3fbf5 58%, #e9f7ec 100%)",
  boxShadow: "0 18px 42px rgba(148, 163, 184, 0.14)"
};

const eyebrowStyle = { color: "#4a9d54", fontSize: "12px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" };
const titleStyle = { margin: "10px 0 10px", color: "#0f172a", fontSize: "42px", lineHeight: 1.05 };
const copyStyle = { margin: 0, maxWidth: "760px", color: "#526377", lineHeight: 1.65 };

const editorShellStyle = {
  marginTop: "22px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "18px",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
  overflow: "hidden"
};

const formSectionStyle = { padding: "20px", borderTop: "1px solid #e2e8f0" };
const formSectionTitleStyle = { margin: "0 0 14px", color: "#0f172a", fontSize: "16px" };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" };
const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.5fr) repeat(3, minmax(150px, 1fr)) auto",
  gap: "14px",
  alignItems: "end",
  marginTop: "22px",
  padding: "18px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "18px",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)"
};

const fieldStyle = { display: "grid", gap: "7px" };
const labelStyle = { color: "#334155", fontSize: "12px", fontWeight: 800 };
const inputStyle = { width: "100%", minHeight: "42px", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: "10px", color: "#0f172a", background: "#ffffff", fontWeight: 700 };
const textareaStyle = { ...inputStyle, minHeight: "180px", padding: "12px", resize: "vertical", lineHeight: 1.5 };
const shortTextareaStyle = { ...textareaStyle, minHeight: "96px" };

const primaryButtonStyle = { minHeight: "44px", padding: "0 16px", border: "0", borderRadius: "10px", background: "#16a34a", color: "#ffffff", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
const secondaryButtonStyle = { ...primaryButtonStyle, background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1" };
const messageStyle = { marginTop: "14px", padding: "12px 14px", border: "1px solid #bbf7d0", borderRadius: "12px", background: "#f0fdf4", color: "#166534", fontWeight: 800 };

const dropzoneStyle = {
  display: "grid",
  placeItems: "center",
  minHeight: "220px",
  border: "2px dashed #cbd5e1",
  borderRadius: "16px",
  background: "#f8fafc",
  color: "#334155",
  textAlign: "center",
  cursor: "pointer",
  overflow: "hidden"
};
const dropzoneActiveStyle = { ...dropzoneStyle, borderColor: "#16a34a", background: "#f0fdf4" };
const dropzoneCopyStyle = { margin: "6px 0 0", color: "#64748b", fontWeight: 700 };
const previewImageStyle = { width: "100%", maxHeight: "360px", objectFit: "cover" };
const imageActionsStyle = { display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" };
const toggleFieldStyle = { display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", color: "#334155", fontWeight: 800 };
const formActionsStyle = { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "18px 20px", borderTop: "1px solid #e2e8f0" };

const tagManagerStyle = { marginTop: "22px", border: "1px solid rgba(203, 213, 225, 0.72)", borderRadius: "18px", background: "#ffffff", boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)", overflow: "hidden" };
const layoutControlStyle = { marginTop: "22px", border: "1px solid rgba(203, 213, 225, 0.72)", borderRadius: "18px", background: "#ffffff", boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)", overflow: "hidden" };
const layoutGridStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", alignItems: "end", padding: "18px 20px" };
const tagFormStyle = { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto auto", gap: "12px", alignItems: "end", padding: "18px 20px", borderBottom: "1px solid #e2e8f0" };
const tagListStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", padding: "18px 20px" };
const tagItemStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px", border: "1px solid #e2e8f0", borderRadius: "14px", background: "#f8fafc" };
const tagNameStyle = { display: "block", marginBottom: "8px", color: "#0f172a" };
const tagActionsStyle = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "8px" };

const tableShellStyle = { marginTop: "22px", border: "1px solid rgba(203, 213, 225, 0.72)", borderRadius: "18px", background: "#ffffff", boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)", overflow: "hidden" };
const tableHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "18px 20px", borderBottom: "1px solid #e2e8f0" };
const panelTitleStyle = { margin: 0, color: "#0f172a", fontSize: "20px" };
const panelCopyStyle = { margin: "4px 0 0", color: "#64748b", fontWeight: 700 };
const backButtonStyle = { color: "#166534", fontSize: "13px", fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap" };
const tableScrollStyle = { overflowX: "auto" };
const tableStyle = { width: "100%", minWidth: "1080px", borderCollapse: "collapse" };
const thStyle = { padding: "14px 16px", background: "#f8fafc", color: "#475569", fontSize: "12px", fontWeight: 900, textAlign: "left", textTransform: "uppercase" };
const tdStyle = { padding: "16px", borderTop: "1px solid #e2e8f0", color: "#334155", verticalAlign: "middle" };
const trStyle = { background: "#ffffff" };
const imageStyle = { width: "74px", height: "56px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" };
const imagePlaceholderStyle = { ...imageStyle, display: "grid", placeItems: "center", color: "#166534", fontSize: "22px", fontWeight: 900 };
const titleCellStyle = { maxWidth: "320px", color: "#0f172a", fontWeight: 900, lineHeight: 1.35 };
const summaryStyle = { maxWidth: "360px", marginTop: "5px", color: "#64748b", fontSize: "12px", lineHeight: 1.4 };
const tagStyle = { display: "inline-flex", padding: "7px 10px", borderRadius: "999px", background: "#eef6ef", color: "#166534", fontSize: "12px", fontWeight: 900 };
const badgeStyle = { display: "inline-flex", padding: "7px 10px", border: "1px solid", borderRadius: "999px", fontSize: "12px", fontWeight: 900, textTransform: "capitalize" };
const toggleOnStyle = { minWidth: "82px", minHeight: "34px", border: "1px solid #86efac", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontWeight: 900, cursor: "pointer" };
const toggleOffStyle = { ...toggleOnStyle, borderColor: "#cbd5e1", background: "#f8fafc", color: "#475569" };
const actionsStyle = { display: "flex", flexWrap: "wrap", gap: "8px", minWidth: "300px" };
const actionButtonStyle = { minHeight: "32px", padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: "9px", background: "#ffffff", color: "#0f172a", fontSize: "12px", fontWeight: 900, textDecoration: "none", cursor: "pointer" };
const emptyStyle = { padding: "28px", color: "#64748b", fontWeight: 800, textAlign: "center" };
