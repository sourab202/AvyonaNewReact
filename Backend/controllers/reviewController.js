import { REVIEW_TYPES, REVIEW_VISIBILITY_STATUSES } from "../shared/reviewTypes.js";
import {
  createCustomerReview,
  createGuestReview,
  createReview,
  getProductReviewSummary,
  listCustomerReviews,
  listReviews,
  listStorefrontReviewMedia,
  listStorefrontReviewsPage,
  updateReview,
  updateReviewReply,
  updateReviewVisibility
} from "../services/reviewService.js";
import { grantReviewReward } from "../services/creditPointsRewards.js";

export async function getReviews(_request, response) {
  const rows = await listReviews();

  response.json({
    success: true,
    count: rows.length,
    data: rows
  });
}

export async function getStorefrontProductReviews(request, response) {
  const page = await listStorefrontReviewsPage(request.params.productId, request.customer?.id || null, {
    limit: request.query?.limit,
    offset: request.query?.offset,
    sort: request.query?.sort,
    rating: request.query?.rating,
    verifiedOnly: request.query?.verifiedOnly || request.query?.verified_only
  });

  response.json({
    success: true,
    count: page.rows.length,
    data: page.rows,
    pagination: {
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore
    }
  });
}

export async function getStorefrontProductReviewSummary(request, response) {
  const summary = await getProductReviewSummary(request.params.productId);

  response.json({
    success: true,
    data: summary
  });
}

export async function getStorefrontProductReviewMedia(request, response) {
  const rows = await listStorefrontReviewMedia(request.params.productId, request.customer?.id || null);

  response.json({
    success: true,
    count: rows.length,
    data: rows
  });
}

export async function submitCustomerReview(request, response) {
  const result = await createCustomerReview(request.customer, request.body || {});

  response.status(201).json({
    success: true,
    message: "Customer review submitted for moderation",
    data: result
  });
}

export async function submitGuestReview(request, response) {
  const result = await createGuestReview(request.body || {});

  response.status(201).json({
    success: true,
    message: "Guest review submitted for moderation",
    data: result
  });
}

export async function getMyReviews(request, response) {
  const rows = await listCustomerReviews(request.customer.id);

  response.json({
    success: true,
    count: rows.length,
    data: rows
  });
}

export async function uploadCustomerReviewMedia(request, response) {
  if (!request.file) {
    response.status(400).json({
      success: false,
      message: "Review media file is required"
    });
    return;
  }

  response.status(201).json({
    success: true,
    data: {
      filename: request.file.filename,
      originalName: request.file.originalname,
      mimeType: request.file.mimetype,
      size: request.file.size,
      mediaType: request.file.mimetype.startsWith("video/") ? "video" : "image",
      url: `/uploads/${request.file.filename}`
    }
  });
}

export async function createAdminReview(request, response) {
  const result = await createReview({
    ...request.body,
    reviewType: REVIEW_TYPES.ADMIN,
    review_type: REVIEW_TYPES.ADMIN,
    visibilityStatus: REVIEW_VISIBILITY_STATUSES.PUBLIC,
    visibility_status: REVIEW_VISIBILITY_STATUSES.PUBLIC,
    customerId: null,
    customer_id: null,
    orderId: null,
    order_id: null,
    isAnonymous: false
  });

  response.status(201).json({
    success: true,
    message: "Admin review created successfully",
    data: result
  });
}

export async function patchReviewVisibility(request, response) {
  const result = await updateReviewVisibility(request.params.reviewId, request.body?.visibilityStatus || request.body?.visibility_status);

  response.json({
    success: true,
    message: "Review visibility updated",
    data: result
  });

  // Grant review reward when a verified customer review is approved
  if (
    result.visibilityStatus === REVIEW_VISIBILITY_STATUSES.PUBLIC &&
    result.previousVisibilityStatus !== REVIEW_VISIBILITY_STATUSES.PUBLIC &&
    result.customerId &&
    result.productId &&
    result.isVerifiedPurchase
  ) {
    const ipAddress = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.ip || null;
    grantReviewReward(result.customerId, result.productId, result.reviewId, { ipAddress }).catch(() => {});
  }
}

export async function editReview(request, response) {
  const result = await updateReview(request.params.reviewId, request.body || {});

  response.json({
    success: true,
    message: "Review updated",
    data: result
  });
}

export async function patchReviewReply(request, response) {
  const result = await updateReviewReply(request.params.reviewId, request.body?.adminReply || request.body?.admin_reply || "");

  response.json({
    success: true,
    message: result.hasAdminReply ? "Seller response saved" : "Seller response removed",
    data: result
  });
}

export async function deleteReview(request, response) {
  const result = await updateReviewVisibility(request.params.reviewId, REVIEW_VISIBILITY_STATUSES.DELETED);

  response.json({
    success: true,
    message: "Review deleted",
    data: result
  });
}
