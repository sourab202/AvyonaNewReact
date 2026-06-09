import React from "react";
import { Link } from "react-router-dom";

const homepageSections = [
  {
    title: "Hero Banner",
    path: "/dashboard/homepage/hero-banner",
    description: "Manage the main storefront banner, headline, call-to-action, and featured visual."
  },
  {
    title: "Browse Categories",
    path: "/dashboard/homepage/browse-categories",
    description: "Control the category cards shown in the Browse / Shop by Category section."
  },
  {
    title: "Our Products",
    path: "/dashboard/homepage/our-products",
    description: "Manage the primary product section shown on the homepage."
  },
  {
    title: "Best Sellers & Trending",
    path: "/dashboard/homepage/best-sellers",
    description: "Control high-performing and trending products highlighted for shoppers."
  },
  {
    title: "New Arrivals",
    path: "/dashboard/homepage/new-arrivals",
    description: "Manage the latest products displayed for returning and discovery-focused shoppers."
  },
  {
    title: "Featured Brands",
    path: "/dashboard/homepage/featured-brands",
    description: "Select brand highlights and logo placements for the homepage."
  },
  {
    title: "Why Shop With Avyona",
    path: "/dashboard/homepage/why-shop",
    description: "Manage homepage trust badges with icons and text."
  },
  {
    title: "Product Payment Icons",
    path: "/dashboard/homepage/product-payment-icons",
    description: "Manage payment icons shown on product detail pages."
  },
  {
    title: "Delivery Pincodes",
    path: "/dashboard/homepage/delivery-pincodes",
    description: "Add, edit, import, activate, and bulk-manage delivery serviceability and COD by pincode."
  },
  {
    title: "Pages",
    path: "/dashboard/homepage/pages",
    description: "Create and manage custom website pages, policy pages, and landing pages."
  },
  {
    title: "Newsletter",
    path: "/dashboard/homepage/newsletter",
    description: "Enable, rename, and position the homepage newsletter signup block."
  },
  {
    title: "Blog Post",
    path: "/dashboard/homepage/blog-posts",
    description: "Manage blog articles shown on the homepage and blog page."
  },
  {
    title: "Limited Time Offers",
    path: "/dashboard/coupons?view=offers",
    description: "Manage coupon offer cards shown on the homepage and product pages."
  },
  {
    title: "Reviews",
    path: "/dashboard/reviews",
    description: "Manage customer reviews and testimonials displayed on the homepage."
  },
  {
    title: "Credit Points",
    path: "/dashboard/homepage/credit-points",
    description: "Manage the full rewards module with overview, earning rules, customer points, transactions, referrals, expiry, and settings."
  },
  {
    title: "Thank You Page",
    path: "/dashboard/homepage/thank-you-page",
    description: "Manage order confirmation content, buttons, trust messages, and invoice design."
  }
];

export default function Homepage() {
  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Storefront Management</span>
        <h2 style={titleStyle}>Homepage</h2>
        <p style={copyStyle}>
          Manage homepage content sections for the Avyona frontend. Use this area for hero banners, category blocks,
          featured product rows, and promotional sections.
        </p>
      </div>

      <div style={sectionGridStyle}>
        {homepageSections.map((section) => (
          <Link key={section.title} to={section.path} style={cardStyle}>
            <span style={cardEyebrowStyle}>Homepage Section</span>
            <h3 style={cardTitleStyle}>{section.title}</h3>
            <p style={cardCopyStyle}>{section.description}</p>
            {section.actionLabel ? <span style={cardActionStyle}>{section.actionLabel}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

const heroStyle = {
  padding: "28px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #ffffff 0%, #f3fbf5 58%, #e9f7ec 100%)",
  boxShadow: "0 18px 42px rgba(148, 163, 184, 0.14)"
};

const eyebrowStyle = {
  color: "#4a9d54",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const titleStyle = {
  margin: "10px 0 10px",
  color: "#0f172a",
  fontSize: "42px",
  lineHeight: 1.05
};

const copyStyle = {
  margin: 0,
  maxWidth: "760px",
  color: "#526377",
  lineHeight: 1.65
};

const sectionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "18px",
  marginTop: "22px"
};

const cardStyle = {
  display: "grid",
  gap: "10px",
  alignContent: "start",
  minHeight: "190px",
  padding: "20px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "18px",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
  textDecoration: "none",
  color: "inherit",
  cursor: "pointer"
};

const cardEyebrowStyle = {
  color: "#4a9d54",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase"
};

const cardTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "20px"
};

const cardCopyStyle = {
  margin: 0,
  color: "#526377",
  lineHeight: 1.55
};

const cardActionStyle = {
  width: "max-content",
  alignSelf: "end",
  marginTop: "4px",
  padding: "8px 12px",
  borderRadius: "10px",
  background: "#16a34a",
  color: "#fff",
  fontSize: "12px",
  fontWeight: 900
};
