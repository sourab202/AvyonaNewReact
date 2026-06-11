import React from "react";
import {
  createAdminReview,
  deleteReview,
  fetchProducts,
  fetchReviews,
  updateReview,
  updateReviewReply,
  updateReviewVisibility,
  uploadAdminImage,
  uploadAdminMedia
} from "../../api/adminApi";
import {
  REVIEW_TYPE_OPTIONS,
  REVIEW_VISIBILITY_STATUS_OPTIONS,
  REVIEW_VISIBILITY_STATUSES,
  formatReviewTypeLabel,
  formatReviewVisibilityStatusLabel
} from "../../../../shared/reviewTypes";

const today = new Date().toISOString().slice(0, 10);

function createEmptyForm() {
  return {
    productId: "",
    reviewerName: "",
    rating: 5,
    reviewTitle: "",
    reviewText: "",
    reviewDate: today,
    visibilityStatus: REVIEW_VISIBILITY_STATUSES.PUBLIC,
    imageFile: null,
    videoFile: null
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getStatusStyle(status) {
  if (status === REVIEW_VISIBILITY_STATUSES.PUBLIC) return { background: "#e4f6e8", color: "#176435", borderColor: "#bfe8c9" };
  if (status === REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER) return { background: "#eef4ff", color: "#2952a3", borderColor: "#c8d8ff" };
  if (status === REVIEW_VISIBILITY_STATUSES.DELETED) return { background: "#fff0f0", color: "#b42318", borderColor: "#ffd0d0" };
  return { background: "#fff8e5", color: "#8a5a00", borderColor: "#f4dfa0" };
}

function getReviewerInitials(name) {
  const parts = String(name || "A").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
}

function getExcerpt(text, limit = 82) {
  const value = String(text || "").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function formatRating(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return `${value.toFixed(1)} / 5`;
}

function getMetrics(reviews) {
  const total = reviews.length;
  const publicCount = reviews.filter((review) => review.visibilityStatus === REVIEW_VISIBILITY_STATUSES.PUBLIC).length;
  const hiddenCount = reviews.filter((review) => review.visibilityStatus === REVIEW_VISIBILITY_STATUSES.HIDDEN).length;
  const mediaCount = reviews.reduce((sum, review) => sum + Number(review.mediaCount || 0), 0);
  const avgRating = total ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total).toFixed(1) : "0.0";

  return [
    { label: "Total Reviews", value: total, note: "All review records" },
    { label: "Public", value: publicCount, note: "Visible on storefront" },
    { label: "Hidden Queue", value: hiddenCount, note: "Needs moderation" },
    { label: "Media Items", value: mediaCount, note: "Photos and videos" },
    { label: "Average Rating", value: avgRating, note: "Across dashboard" }
  ];
}

export default function Reviews() {
  const [products, setProducts] = React.useState([]);
  const [reviews, setReviews] = React.useState([]);
  const [filters, setFilters] = React.useState({
    search: "",
    productId: "all",
    visibilityStatus: "all",
    reviewType: "all",
    rating: "all"
  });
  const [selectedReview, setSelectedReview] = React.useState(null);
  const [editingReviewId, setEditingReviewId] = React.useState(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(true);
  const [isLoadingReviews, setIsLoadingReviews] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingReply, setIsSavingReply] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [form, setForm] = React.useState(createEmptyForm);
  const [replyText, setReplyText] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(50);
  const [selectedReviewIds, setSelectedReviewIds] = React.useState([]);

  const loadReviews = React.useCallback(async () => {
    setIsLoadingReviews(true);
    try {
      const response = await fetchReviews();
      setReviews(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Reviews could not be loaded.");
      setReviews([]);
    } finally {
      setIsLoadingReviews(false);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    setIsLoadingProducts(true);

    fetchProducts({ limit: 100, status: "active" })
      .then((response) => {
        if (!isMounted) return;
        setProducts(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(() => {
        if (isMounted) setProducts([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProducts(false);
      });

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, [loadReviews]);

  const metrics = React.useMemo(() => getMetrics(reviews), [reviews]);

  const filteredReviews = React.useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return reviews.filter((review) => {
      const searchableText = [
        review.productName,
        review.reviewerName,
        review.reviewerEmail,
        review.reviewTitle,
        review.reviewText,
        review.adminReply,
        formatReviewTypeLabel(review.reviewType),
        formatReviewVisibilityStatusLabel(review.visibilityStatus)
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
      const matchesProduct = filters.productId === "all" || Number(review.productId) === Number(filters.productId);
      const matchesVisibility = filters.visibilityStatus === "all" || review.visibilityStatus === filters.visibilityStatus;
      const matchesType = filters.reviewType === "all" || review.reviewType === filters.reviewType;
      const matchesRating = filters.rating === "all" || Number(review.rating) === Number(filters.rating);

      return matchesSearch && matchesProduct && matchesVisibility && matchesType && matchesRating;
    });
  }, [filters, reviews]);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedReviewIds([]);
  }, [filters, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = filteredReviews.length ? (safeCurrentPage - 1) * rowsPerPage : 0;
  const paginatedReviews = filteredReviews.slice(pageStart, pageStart + rowsPerPage);
  const pageEnd = filteredReviews.length ? pageStart + paginatedReviews.length : 0;
  const visibleReviewIds = React.useMemo(() => paginatedReviews.map((review) => String(review.reviewId)), [paginatedReviews]);
  const isCurrentPageSelected = visibleReviewIds.length > 0 && visibleReviewIds.every((id) => selectedReviewIds.includes(id));

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      productId: "all",
      visibilityStatus: "all",
      reviewType: "all",
      rating: "all"
    });
    setRowsPerPage(50);
    setSelectedReviewIds([]);
  };

  const resetForm = (closeEditor = true) => {
    setForm(createEmptyForm());
    setEditingReviewId(null);
    if (closeEditor) setIsEditorOpen(false);
  };

  const openCreateForm = () => {
    resetForm(false);
    setIsEditorOpen(true);
    setMessage("");
  };

  const startEditReview = (review) => {
    setEditingReviewId(review.reviewId);
    setIsEditorOpen(true);
    setForm({
      ...createEmptyForm(),
      productId: String(review.productId || ""),
      reviewerName: review.reviewerName || "",
      rating: Number(review.rating || 5),
      reviewTitle: review.reviewTitle || "",
      reviewText: review.reviewText || "",
      reviewDate: review.createdAt ? new Date(review.createdAt).toISOString().slice(0, 10) : today,
      visibilityStatus: review.visibilityStatus || REVIEW_VISIBILITY_STATUSES.HIDDEN
    });
    setMessage("Editing review. Media changes can be added in a later step.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!form.productId || !form.reviewerName.trim() || !form.reviewTitle.trim() || !form.reviewText.trim()) {
      setMessage("Select a product and complete reviewer name, title, and review text.");
      return;
    }

    setIsSaving(true);

    try {
      const media = [];

      if (!editingReviewId && form.imageFile) {
        const imageResponse = await uploadAdminImage(form.imageFile);
        const imageUrl = imageResponse.data?.data?.url;
        if (imageUrl) media.push({ mediaType: "image", mediaUrl: imageUrl, sortOrder: 1 });
      }

      if (!editingReviewId && form.videoFile) {
        const videoResponse = await uploadAdminMedia(form.videoFile);
        const videoUrl = videoResponse.data?.data?.url;
        if (videoUrl) media.push({ mediaType: "video", mediaUrl: videoUrl, sortOrder: media.length + 1 });
      }

      const payload = {
        productId: Number(form.productId),
        reviewerName: form.reviewerName.trim(),
        rating: Number(form.rating),
        reviewTitle: form.reviewTitle.trim(),
        reviewText: form.reviewText.trim(),
        createdAt: form.reviewDate ? `${form.reviewDate} 12:00:00` : null,
        visibilityStatus: form.visibilityStatus,
        media
      };

      if (editingReviewId) {
        await updateReview(editingReviewId, payload);
        setMessage("Review updated.");
      } else {
        await createAdminReview(payload);
        setMessage("Admin review added. It is marked as Verified Purchase automatically.");
      }

      resetForm();
      await loadReviews();
    } catch (error) {
      setMessage(error.response?.data?.message || "Review could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const changeVisibility = async (reviewId, visibilityStatus) => {
    setReviews((current) => current.map((review) => (
      Number(review.reviewId) === Number(reviewId) ? { ...review, visibilityStatus } : review
    )));

    try {
      await updateReviewVisibility(reviewId, visibilityStatus);
      setMessage("Review visibility updated.");
      await loadReviews();
    } catch (error) {
      setMessage(error.response?.data?.message || "Review visibility could not be updated.");
      await loadReviews();
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const shouldDelete = window.confirm("Delete this review?");
    if (!shouldDelete) return;

    try {
      await deleteReview(reviewId);
      setSelectedReviewIds((current) => current.filter((id) => String(id) !== String(reviewId)));
      setMessage("Review deleted.");
      await loadReviews();
    } catch (error) {
      setMessage(error.response?.data?.message || "Review could not be deleted.");
    }
  };

  const toggleSelectedReview = (reviewId) => {
    const id = String(reviewId);
    setSelectedReviewIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleCurrentPageSelection = () => {
    setSelectedReviewIds((current) => {
      if (isCurrentPageSelected) return current.filter((id) => !visibleReviewIds.includes(id));
      return Array.from(new Set([...current, ...visibleReviewIds]));
    });
  };

  const handleBulkReviewVisibility = async (visibilityStatus) => {
    if (!selectedReviewIds.length) return;
    try {
      await Promise.all(selectedReviewIds.map((reviewId) => updateReviewVisibility(reviewId, visibilityStatus)));
      setMessage(`${selectedReviewIds.length} review(s) updated.`);
      setSelectedReviewIds([]);
      await loadReviews();
    } catch (error) {
      setMessage(error.response?.data?.message || "Selected reviews could not be updated.");
      await loadReviews();
    }
  };

  const handleBulkReviewDelete = async () => {
    if (!selectedReviewIds.length) return;
    const confirmed = window.confirm(`Delete ${selectedReviewIds.length} selected review(s)?`);
    if (!confirmed) return;
    try {
      await Promise.all(selectedReviewIds.map((reviewId) => deleteReview(reviewId)));
      setMessage("Selected reviews deleted.");
      setSelectedReviewIds([]);
      await loadReviews();
    } catch (error) {
      setMessage(error.response?.data?.message || "Selected reviews could not be deleted.");
      await loadReviews();
    }
  };

  const openReviewModal = (review) => {
    setSelectedReview(review);
    setReplyText(review.adminReply || "");
  };

  const saveSellerResponse = async () => {
    if (!selectedReview) return;
    setIsSavingReply(true);
    setMessage("");

    try {
      await updateReviewReply(selectedReview.reviewId, replyText);
      setMessage(replyText.trim() ? "Seller response saved." : "Seller response removed.");
      await loadReviews();
      setSelectedReview((current) => current ? { ...current, adminReply: replyText.trim() } : current);
    } catch (error) {
      setMessage(error.response?.data?.message || "Seller response could not be saved.");
    } finally {
      setIsSavingReply(false);
    }
  };

  return (
    <section className="dashboard-page-shell" style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <span style={eyebrowStyle}>Review Management</span>
          <h2 style={titleStyle}>Reviews Dashboard</h2>
          <p style={copyStyle}>Moderate storefront reviews, seller responses, media, and visibility from one focused workspace.</p>
        </div>
        <div style={heroActionsStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={loadReviews}>Refresh</button>
          <button type="button" style={primaryButtonStyle} onClick={openCreateForm}>Add Admin Review</button>
        </div>
      </div>

      <div style={metricsGridStyle}>
        {metrics.map((metric) => (
          <div key={metric.label} style={metricCardStyle}>
            <span style={metricLabelStyle}>{metric.label}</span>
            <strong style={metricValueStyle}>{metric.value}</strong>
            <span style={metricNoteStyle}>{metric.note}</span>
          </div>
        ))}
      </div>

      {message ? <p style={messageStyle}>{message}</p> : null}

      {isEditorOpen ? (
        <form style={editorPanelStyle} onSubmit={handleSubmit}>
          <div style={sectionHeaderStyle}>
            <div>
              <span style={eyebrowStyle}>{editingReviewId ? "Edit Review" : "Admin Review"}</span>
              <h3 style={panelTitleStyle}>{editingReviewId ? "Edit Existing Review" : "Create Verified Review"}</h3>
              <p style={panelCopyStyle}>Use this for admin-created reviews. Customer and guest reviews appear in the moderation table after submission.</p>
            </div>
            <button type="button" style={ghostButtonStyle} onClick={() => resetForm(true)}>Close</button>
          </div>

          <div style={formGridStyle}>
            <label style={fieldStyle}>
              <span>Product</span>
              <select value={form.productId} onChange={(event) => updateField("productId", event.target.value)} required>
                <option value="">{isLoadingProducts ? "Loading products..." : "Select product"}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span>Reviewer Name</span>
              <input value={form.reviewerName} onChange={(event) => updateField("reviewerName", event.target.value)} required />
            </label>

            <label style={fieldStyle}>
              <span>Rating</span>
              <select value={form.rating} onChange={(event) => updateField("rating", Number(event.target.value))}>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </label>

            <label style={fieldStyle}>
              <span>Review Date</span>
              <input type="date" value={form.reviewDate} onChange={(event) => updateField("reviewDate", event.target.value)} />
            </label>

            <label style={fieldStyle}>
              <span>Visibility</span>
              <select value={form.visibilityStatus} onChange={(event) => updateField("visibilityStatus", event.target.value)}>
                {REVIEW_VISIBILITY_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span>Image Upload</span>
              <input type="file" accept="image/*" disabled={Boolean(editingReviewId)} onChange={(event) => updateField("imageFile", event.target.files?.[0] || null)} />
            </label>

            <label style={fieldStyle}>
              <span>Video Upload</span>
              <input type="file" accept="video/*" disabled={Boolean(editingReviewId)} onChange={(event) => updateField("videoFile", event.target.files?.[0] || null)} />
            </label>
          </div>

          <label style={fieldStyle}>
            <span>Review Title</span>
            <input value={form.reviewTitle} onChange={(event) => updateField("reviewTitle", event.target.value)} required />
          </label>

          <label style={fieldStyle}>
            <span>Review Text</span>
            <textarea rows="5" value={form.reviewText} onChange={(event) => updateField("reviewText", event.target.value)} required />
          </label>

          <div style={actionRowStyle}>
            <button style={primaryButtonStyle} type="submit" disabled={isSaving}>{isSaving ? "Saving..." : editingReviewId ? "Save Review" : "Create Review"}</button>
          </div>
        </form>
      ) : null}

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Moderation Queue</span>
            <h3 style={panelTitleStyle}>All Reviews</h3>
            <p style={panelCopyStyle}>
              {isLoadingReviews ? "Loading reviews..." : `${filteredReviews.length} showing from ${reviews.length} total | ${selectedReviewIds.length} selected`}
            </p>
          </div>
        </div>

        <div style={filterPanelStyle}>
          <label style={{ ...filterFieldStyle, gridColumn: "span 2" }}>
            <span>Search</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Product, reviewer, title, reply..."
            />
          </label>

          <label style={filterFieldStyle}>
            <span>Product</span>
            <select value={filters.productId} onChange={(event) => updateFilter("productId", event.target.value)}>
              <option value="all">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>

          <label style={filterFieldStyle}>
            <span>Visibility</span>
            <select value={filters.visibilityStatus} onChange={(event) => updateFilter("visibilityStatus", event.target.value)}>
              <option value="all">All visibility</option>
              {REVIEW_VISIBILITY_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </label>

          <label style={filterFieldStyle}>
            <span>Type</span>
            <select value={filters.reviewType} onChange={(event) => updateFilter("reviewType", event.target.value)}>
              <option value="all">All types</option>
              {REVIEW_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>

          <label style={filterFieldStyle}>
            <span>Rating</span>
            <select value={filters.rating} onChange={(event) => updateFilter("rating", event.target.value)}>
              <option value="all">All ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </label>

          <button type="button" style={filterResetButtonStyle} onClick={resetFilters}>Reset</button>

          <label style={filterFieldStyle}>
            <span>Rows</span>
            <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
              {[10, 20, 50, 100].map((count) => <option key={count} value={count}>{`${count} / page`}</option>)}
            </select>
          </label>
        </div>

        {selectedReviewIds.length ? (
          <div style={bulkPanelStyle}>
            <strong>{`${selectedReviewIds.length} review(s) selected`}</strong>
            <button type="button" style={secondaryButtonStyle} onClick={() => handleBulkReviewVisibility(REVIEW_VISIBILITY_STATUSES.PUBLIC)}>Mark Public</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => handleBulkReviewVisibility(REVIEW_VISIBILITY_STATUSES.HIDDEN)}>Hide</button>
            <button type="button" style={ghostButtonStyle} onClick={() => handleBulkReviewVisibility(REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER)}>Mark Private</button>
            <button type="button" style={deleteButtonStyle} onClick={handleBulkReviewDelete}>Delete Selected</button>
            <button type="button" style={ghostButtonStyle} onClick={() => setSelectedReviewIds([])}>Clear</button>
          </div>
        ) : null}

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" checked={isCurrentPageSelected} onChange={toggleCurrentPageSelection} aria-label="Select all reviews on this page" />
                </th>
                <th style={thStyle}>Review</th>
                <th style={thStyle}>Reviewer</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Rating</th>
                <th style={thStyle}>Media</th>
                <th style={thStyle}>Seller Reply</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReviews.map((review) => (
                <tr key={review.reviewId}>
                  <td style={tdStyle}>
                    <input type="checkbox" checked={selectedReviewIds.includes(String(review.reviewId))} onChange={() => toggleSelectedReview(review.reviewId)} aria-label={`Select review ${review.reviewTitle || review.reviewId}`} />
                  </td>
                  <td style={reviewCellStyle}>
                    <strong style={reviewTitleStyle}>{review.reviewTitle || "Untitled review"}</strong>
                    <span style={reviewProductStyle}>{review.productName || `Product #${review.productId}`}</span>
                    <span style={reviewExcerptStyle}>{getExcerpt(review.reviewText)}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={reviewerStackStyle}>
                      <span style={avatarStyle}>{getReviewerInitials(review.reviewerName)}</span>
                      <span style={reviewerNameStyle}>{review.reviewerName || "Reviewer"}</span>
                      <span style={mutedTextStyle}>{formatReviewTypeLabel(review.reviewType)}</span>
                      <span style={mutedTextStyle}>{review.isAnonymous ? "Anonymous" : "Named"}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={statusStackStyle}>
                      <span style={{ ...pillStyle, ...getStatusStyle(review.visibilityStatus) }}>{formatReviewVisibilityStatusLabel(review.visibilityStatus)}</span>
                      <span style={verifiedTextStyle}>{review.isVerifiedPurchase ? "Verified Purchase" : "Not Verified"}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={ratingBadgeStyle}>{formatRating(review.rating)}</span>
                    <span style={ratingTextStyle}>{Number(review.rating || 0) >= 4 ? "Positive" : "Needs attention"}</span>
                  </td>
                  <td style={tdStyle}>{Number(review.mediaCount || 0)}</td>
                  <td style={tdStyle}>
                    <span style={review.adminReply ? replyAddedStyle : replyEmptyStyle}>{review.adminReply ? "Added" : "Missing"}</span>
                  </td>
                  <td style={tdStyle}>{formatDate(review.createdAt)}</td>
                  <td style={actionCellStyle}>
                    <details className="review-action-menu">
                      <summary>Actions</summary>
                      <div className="review-action-menu-list">
                        <button type="button" className="review-action-menu-item" data-action="public" onClick={() => changeVisibility(review.reviewId, REVIEW_VISIBILITY_STATUSES.PUBLIC)}>Public</button>
                        <button type="button" className="review-action-menu-item" data-action="hide" onClick={() => changeVisibility(review.reviewId, REVIEW_VISIBILITY_STATUSES.HIDDEN)}>Hide</button>
                        <button type="button" className="review-action-menu-item" data-action="private" onClick={() => changeVisibility(review.reviewId, REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER)}>Private</button>
                        <button type="button" className="review-action-menu-item" data-action="view" onClick={() => openReviewModal(review)}>View</button>
                        <button type="button" className="review-action-menu-item" data-action="reply" onClick={() => openReviewModal(review)}>Reply</button>
                        <button type="button" className="review-action-menu-item" data-action="edit" onClick={() => startEditReview(review)}>Edit</button>
                        <button type="button" className="review-action-menu-item" data-action="delete" onClick={() => handleDeleteReview(review.reviewId)}>Delete</button>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {!filteredReviews.length ? (
                <tr>
                  <td style={emptyCellStyle} colSpan="9">{reviews.length ? "No reviews match these filters." : "No reviews found."}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={paginationBarStyle}>
          <div>
            <strong>{`Page ${safeCurrentPage} of ${totalPages}`}</strong>
            <p style={{ margin: "4px 0 0", color: "#64748b" }}>{filteredReviews.length ? `Showing ${pageStart + 1}-${pageEnd} of ${filteredReviews.length}.` : "No reviews available."}</p>
          </div>
          <div style={actionRowStyle}>
            <button type="button" style={ghostButtonStyle} disabled={safeCurrentPage === 1} onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}>Previous</button>
            <button type="button" style={ghostButtonStyle} disabled={safeCurrentPage === totalPages} onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      </section>

      {selectedReview ? (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <span style={eyebrowStyle}>Seller Response</span>
                <h3 style={panelTitleStyle}>{selectedReview.reviewTitle || "Review details"}</h3>
              </div>
              <button type="button" style={ghostButtonStyle} onClick={() => setSelectedReview(null)}>Close</button>
            </div>
            <div style={modalReviewBoxStyle}>
              <div style={modalMetaStyle}>
                <span>{selectedReview.productName || `Product #${selectedReview.productId}`}</span>
                <span>{selectedReview.reviewerName}</span>
                <span>{formatRating(selectedReview.rating)}</span>
                <span>{formatReviewVisibilityStatusLabel(selectedReview.visibilityStatus)}</span>
              </div>
              <p style={modalReviewTextStyle}>{selectedReview.reviewText}</p>
            </div>
            <label style={fieldStyle}>
              <span>Seller Response</span>
              <textarea
                rows="5"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Write a helpful seller response for this review."
              />
            </label>
            <div style={actionRowStyle}>
              <button type="button" style={primaryButtonStyle} onClick={saveSellerResponse} disabled={isSavingReply}>
                {isSavingReply ? "Saving..." : replyText.trim() ? "Save Seller Response" : "Clear Seller Response"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "20px"
};

const heroStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "center",
  padding: "28px",
  border: "1px solid #d8e3dd",
  borderRadius: "18px",
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 58%, #e8f6eb 100%)",
  boxShadow: "0 18px 42px rgba(33, 82, 54, 0.08)"
};

const eyebrowStyle = {
  color: "#46924f",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const titleStyle = {
  margin: "8px 0",
  color: "#0b1324",
  fontSize: "38px",
  lineHeight: 1.08
};

const copyStyle = {
  maxWidth: "690px",
  margin: 0,
  color: "#526176",
  lineHeight: 1.6
};

const heroActionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end"
};

const primaryButtonStyle = {
  minHeight: "42px",
  padding: "0 16px",
  border: "1px solid #4a9d54",
  borderRadius: "10px",
  background: "#4a9d54",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  minHeight: "42px",
  padding: "0 16px",
  border: "1px solid #cbd8cf",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0b1324",
  fontWeight: 900,
  cursor: "pointer"
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
  gap: "12px"
};

const metricCardStyle = {
  display: "grid",
  gap: "6px",
  minHeight: "112px",
  padding: "16px",
  border: "1px solid #dde7e1",
  borderRadius: "14px",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)"
};

const metricLabelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em"
};

const metricValueStyle = {
  color: "#0b1324",
  fontSize: "30px",
  lineHeight: 1
};

const metricNoteStyle = {
  color: "#667085",
  fontSize: "13px",
  fontWeight: 700
};

const panelStyle = {
  display: "grid",
  gap: "18px",
  padding: "20px",
  border: "1px solid #dce6e0",
  borderRadius: "16px",
  background: "#ffffff",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)"
};

const editorPanelStyle = {
  ...panelStyle,
  borderColor: "#bfe1c6",
  boxShadow: "0 18px 40px rgba(74, 157, 84, 0.11)"
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap"
};

const panelTitleStyle = {
  margin: "7px 0",
  color: "#0b1324",
  fontSize: "24px",
  lineHeight: 1.18
};

const panelCopyStyle = {
  margin: 0,
  color: "#526176",
  lineHeight: 1.55
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
  gap: "14px"
};

const fieldStyle = {
  display: "grid",
  gap: "8px",
  color: "#253247",
  fontSize: "13px",
  fontWeight: 900
};

const actionRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap"
};

const ghostButtonStyle = {
  minHeight: "38px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0b1324",
  fontWeight: 900,
  cursor: "pointer"
};

const messageStyle = {
  margin: 0,
  padding: "12px 14px",
  border: "1px solid #cbe7d1",
  borderRadius: "12px",
  background: "#f0fbf2",
  color: "#176435",
  fontWeight: 800
};

const filterPanelStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.2fr) minmax(220px, 1.2fr) repeat(5, minmax(142px, 1fr)) auto",
  gap: "12px",
  alignItems: "end",
  padding: "14px",
  border: "1px solid #e3ebe6",
  borderRadius: "12px",
  background: "#f8faf9"
};

const bulkPanelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "14px",
  border: "1px solid #e3ebe6",
  borderRadius: "12px",
  background: "#f8faf9"
};

const deleteButtonStyle = {
  minHeight: "38px",
  padding: "0 14px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 900,
  cursor: "pointer"
};

const paginationBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap"
};

const filterFieldStyle = {
  display: "grid",
  gap: "7px",
  color: "#334155",
  fontSize: "11px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em"
};

const filterResetButtonStyle = {
  minHeight: "42px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0b1324",
  fontWeight: 900,
  cursor: "pointer"
};

const tableWrapStyle = {
  overflowX: "auto",
  border: "1px solid #e5ece8",
  borderRadius: "12px"
};

const tableStyle = {
  width: "100%",
  minWidth: "1140px",
  borderCollapse: "collapse",
  background: "#ffffff"
};

const thStyle = {
  padding: "13px 14px",
  borderBottom: "1px solid #dfe8e3",
  background: "#f7faf8",
  color: "#475467",
  fontSize: "11px",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap"
};

const tdStyle = {
  padding: "14px",
  borderBottom: "1px solid #edf2ef",
  color: "#1f2937",
  verticalAlign: "top"
};

const reviewCellStyle = {
  ...tdStyle,
  minWidth: "280px"
};

const reviewTitleStyle = {
  display: "block",
  color: "#0b1324",
  fontSize: "14px",
  lineHeight: 1.35
};

const reviewProductStyle = {
  display: "block",
  marginTop: "5px",
  color: "#46924f",
  fontSize: "13px",
  fontWeight: 900
};

const reviewExcerptStyle = {
  display: "block",
  marginTop: "6px",
  color: "#667085",
  fontSize: "13px",
  lineHeight: 1.45
};

const reviewerStackStyle = {
  display: "grid",
  gridTemplateColumns: "34px 1fr",
  columnGap: "10px",
  rowGap: "3px",
  alignItems: "center",
  minWidth: "160px"
};

const avatarStyle = {
  gridRow: "span 3",
  display: "grid",
  placeItems: "center",
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "#10251a",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 900
};

const reviewerNameStyle = {
  color: "#0b1324",
  fontSize: "13px",
  fontWeight: 900
};

const mutedTextStyle = {
  color: "#667085",
  fontSize: "12px",
  fontWeight: 700
};

const statusStackStyle = {
  display: "grid",
  gap: "8px",
  minWidth: "150px",
  justifyItems: "start"
};

const pillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "28px",
  padding: "0 10px",
  border: "1px solid transparent",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 900,
  whiteSpace: "nowrap"
};

const verifiedTextStyle = {
  color: "#526176",
  fontSize: "12px",
  fontWeight: 800
};

const ratingBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "28px",
  padding: "0 10px",
  border: "1px solid #fde3a7",
  borderRadius: "999px",
  background: "#fff8e5",
  color: "#8a5a00",
  fontSize: "12px",
  fontWeight: 900
};

const ratingTextStyle = {
  display: "block",
  marginTop: "4px",
  color: "#667085",
  fontSize: "12px",
  fontWeight: 900
};

const replyAddedStyle = {
  display: "inline-flex",
  minHeight: "28px",
  alignItems: "center",
  padding: "0 10px",
  borderRadius: "999px",
  background: "#eef8f0",
  color: "#176435",
  fontSize: "12px",
  fontWeight: 900
};

const replyEmptyStyle = {
  ...replyAddedStyle,
  background: "#f4f6f8",
  color: "#667085"
};

const actionCellStyle = {
  ...tdStyle,
  minWidth: "118px"
};

const emptyCellStyle = {
  ...tdStyle,
  height: "90px",
  textAlign: "center",
  color: "#667085",
  fontWeight: 800
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "grid",
  placeItems: "center",
  padding: "20px",
  background: "rgba(15, 23, 42, 0.48)"
};

const modalStyle = {
  display: "grid",
  gap: "16px",
  width: "min(720px, 100%)",
  maxHeight: "88vh",
  overflow: "auto",
  padding: "22px",
  borderRadius: "18px",
  background: "#ffffff",
  boxShadow: "0 28px 70px rgba(15, 23, 42, 0.24)"
};

const modalReviewBoxStyle = {
  display: "grid",
  gap: "10px",
  padding: "14px",
  border: "1px solid #e5ece8",
  borderRadius: "12px",
  background: "#f8faf9"
};

const modalMetaStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  color: "#526176",
  fontSize: "12px",
  fontWeight: 900
};

const modalReviewTextStyle = {
  margin: 0,
  color: "#253247",
  lineHeight: 1.65
};
