export const REVIEW_TYPES = Object.freeze({
  CUSTOMER: "customer_review",
  GUEST: "guest_review",
  ADMIN: "admin_review"
});

export const REVIEW_TYPE_OPTIONS = Object.freeze([
  {
    label: "Customer Review",
    value: REVIEW_TYPES.CUSTOMER,
    description: "Reviews submitted by registered customers."
  },
  {
    label: "Guest Review",
    value: REVIEW_TYPES.GUEST,
    description: "Reviews submitted by visitors or guest shoppers."
  },
  {
    label: "Admin Review",
    value: REVIEW_TYPES.ADMIN,
    description: "Reviews added or managed directly by the admin team."
  }
]);

export const REVIEW_VISIBILITY_STATUSES = Object.freeze({
  PUBLIC: "public",
  HIDDEN: "hidden",
  PRIVATE_TO_REVIEWER: "private_to_reviewer",
  DELETED: "deleted"
});

export const REVIEW_VISIBILITY_STATUS_OPTIONS = Object.freeze([
  {
    label: "Public",
    value: REVIEW_VISIBILITY_STATUSES.PUBLIC,
    description: "Visible to shoppers on the storefront."
  },
  {
    label: "Hidden",
    value: REVIEW_VISIBILITY_STATUSES.HIDDEN,
    description: "Not shown publicly, but kept available in admin."
  },
  {
    label: "Private to Reviewer",
    value: REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER,
    description: "Visible only to the reviewer and admin users."
  },
  {
    label: "Deleted",
    value: REVIEW_VISIBILITY_STATUSES.DELETED,
    description: "Soft-deleted from review management and storefront display."
  }
]);

export function isValidReviewType(value) {
  return REVIEW_TYPE_OPTIONS.some((type) => type.value === value);
}

export function formatReviewTypeLabel(value) {
  return REVIEW_TYPE_OPTIONS.find((type) => type.value === value)?.label || "Review";
}

export function isValidReviewVisibilityStatus(value) {
  return REVIEW_VISIBILITY_STATUS_OPTIONS.some((status) => status.value === value);
}

export function formatReviewVisibilityStatusLabel(value) {
  return REVIEW_VISIBILITY_STATUS_OPTIONS.find((status) => status.value === value)?.label || "Review Status";
}
