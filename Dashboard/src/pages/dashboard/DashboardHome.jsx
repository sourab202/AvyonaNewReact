import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardAnalytics, fetchDashboardSummary } from "../../api/adminApi";
import { resolveAdminMediaUrl } from "../../utils/media";
import { formatCurrency } from "../../utils/storefront";
import products from "../../data/products";
import orders from "../../data/orders";
import customers from "../../data/customers";

function getFallbackMetrics(context, allProducts) {
  const localRevenue = orders.reduce((sum, order) => sum + Number(order.pricing?.grandTotal || order.total || 0), 0);
  const sessionRevenue = (context.orders || []).reduce((sum, order) => sum + Number(order.total || 0), 0);

  return {
    products: products.length || allProducts.length,
    orders: orders.length || (context.orders || []).length,
    customers: customers.length || (context.accounts || []).length,
    revenue: localRevenue || sessionRevenue
  };
}

function getLocalOrderStatusCounts() {
  return orders.reduce((counts, order) => {
    counts[order.orderStatus] = (counts[order.orderStatus] || 0) + 1;
    return counts;
  }, {});
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatEventLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonth() {
  return getTodayDate().slice(0, 7);
}

function getCurrentYear() {
  return getTodayDate().slice(0, 4);
}

function normalizeSummaryOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status || order.orderStatus || "pending",
    customer: { fullName: order.customerName || order.customer?.fullName || "Customer" },
    pricing: { grandTotal: Number(order.totalAmount || order.pricing?.grandTotal || 0) }
  };
}

function normalizeSummaryProduct(product) {
  return {
    id: product.id,
    slug: product.slug || String(product.id),
    image: product.image || product.imageUrl || "",
    name: product.name,
    sku: product.sku || product.slug || "Tracked product",
    stock: Number(product.stockQuantity ?? product.stock ?? 0),
    stockStatus: product.status === "out_of_stock" ? "out-of-stock" : product.stockStatus || "low-stock"
  };
}

const fallbackAnalytics = {
  totals: { totalEvents: 0, todayEvents: 0, conversionRate: 0 },
  overview: { totalSessions: 0, totalUsers: 0, conversionRate: 0 },
  funnel: {
    productViews: 0,
    searchQueries: 0,
    addToCart: 0,
    checkoutStart: 0,
    purchases: 0,
    abandonedCarts: 0
  },
  rates: { addToCartRate: 0, checkoutRate: 0, purchaseRate: 0 },
  productInsights: { mostViewed: [], mostPurchased: [], lowConversion: [] },
  searchInsights: { topSearches: [], noResultSearches: [] },
  supporting: {
    categoryViews: 0,
    removeFromCart: 0,
    wishlistAdd: 0,
    filterApplied: 0
  },
  topViewedProducts: [],
  topSearchQueries: [],
  recentEvents: []
};

export default function DashboardHome({ context, allProducts }) {
  const fallbackMetrics = useMemo(() => getFallbackMetrics(context, allProducts), [allProducts, context.accounts, context.orders]);
  const fallbackLowStockProducts = useMemo(() => products
    .filter((product) => product.stockStatus !== "in-stock")
    .sort((left, right) => Number(left.stock || 0) - Number(right.stock || 0))
    .slice(0, 5), []);
  const fallbackFulfillmentQueue = useMemo(() => orders
    .filter((order) => !["delivered", "cancelled", "returned"].includes(order.orderStatus))
    .slice(0, 5), []);
  const fallbackOrderStatusCounts = useMemo(() => getLocalOrderStatusCounts(), []);
  const fallbackPaymentHealth = useMemo(() => {
    const paidOrders = orders.filter((order) => order.paymentStatus === "paid" || order.paymentStatus === "authorized").length;
    return orders.length ? (paidOrders / orders.length) * 100 : 0;
  }, []);
  const [metrics, setMetrics] = useState(fallbackMetrics);
  const [lowStockProducts, setLowStockProducts] = useState(fallbackLowStockProducts);
  const [fulfillmentQueue, setFulfillmentQueue] = useState(fallbackFulfillmentQueue);
  const [orderStatusCounts, setOrderStatusCounts] = useState(fallbackOrderStatusCounts);
  const [paymentHealth, setPaymentHealth] = useState(fallbackPaymentHealth);
  const [analytics, setAnalytics] = useState(fallbackAnalytics);
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState(null);
  const [periodMode, setPeriodMode] = useState("last30");
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [customStartDate, setCustomStartDate] = useState(getTodayDate());
  const [customEndDate, setCustomEndDate] = useState(getTodayDate());
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareMode, setCompareMode] = useState("custom");
  const [compareDate, setCompareDate] = useState(getTodayDate());
  const [compareMonth, setCompareMonth] = useState(getCurrentMonth());
  const [compareYear, setCompareYear] = useState(getCurrentYear());
  const [compareStartDate, setCompareStartDate] = useState(getTodayDate());
  const [compareEndDate, setCompareEndDate] = useState(getTodayDate());
  const [appliedAnalyticsParams, setAppliedAnalyticsParams] = useState({ mode: "last30", limit: 8 });

  const analyticsParams = useMemo(() => {
    const params = {
      mode: periodMode,
      limit: 8
    };

    if (periodMode === "date") params.date = selectedDate;
    if (periodMode === "month") params.month = selectedMonth;
    if (periodMode === "year") params.year = selectedYear;
    if (periodMode === "custom") {
      params.startDate = customStartDate;
      params.endDate = customEndDate;
    }

    if (compareEnabled) {
      params.compare = "true";
      params.compareMode = compareMode;
      if (compareMode === "date") params.compareDate = compareDate;
      if (compareMode === "month") params.compareMonth = compareMonth;
      if (compareMode === "year") params.compareYear = compareYear;
      if (compareMode === "custom") {
        params.compareStartDate = compareStartDate;
        params.compareEndDate = compareEndDate;
      }
    }

    return params;
  }, [
    compareDate,
    compareEnabled,
    compareEndDate,
    compareMode,
    compareMonth,
    compareStartDate,
    compareYear,
    customEndDate,
    customStartDate,
    periodMode,
    selectedDate,
    selectedMonth,
    selectedYear
  ]);

  const applyAnalyticsFilters = () => {
    setAppliedAnalyticsParams(analyticsParams);
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboardSummary = async () => {
      try {
        const response = await fetchDashboardSummary(appliedAnalyticsParams);
        const summaryData = response.data?.data;
        const summaryMetrics = summaryData?.metrics;

        if (!isMounted || !summaryMetrics) return;

        setMetrics({
          products: Number(summaryMetrics.products ?? fallbackMetrics.products),
          orders: Number(summaryMetrics.orders ?? fallbackMetrics.orders),
          customers: Number(summaryMetrics.customers ?? fallbackMetrics.customers),
          revenue: Number(summaryMetrics.revenue ?? fallbackMetrics.revenue)
        });
        setLowStockProducts((summaryData.lowStockProducts || []).map(normalizeSummaryProduct));
        setFulfillmentQueue((summaryData.latestOrders || []).map(normalizeSummaryOrder));
        setOrderStatusCounts(summaryData.operations?.orderStatusCounts || {});
        setPaymentHealth(Number(summaryData.operations?.paymentHealth || 0));
      } catch {
        if (!isMounted) return;
        setMetrics(fallbackMetrics);
        setLowStockProducts(fallbackLowStockProducts);
        setFulfillmentQueue(fallbackFulfillmentQueue);
        setOrderStatusCounts(fallbackOrderStatusCounts);
        setPaymentHealth(fallbackPaymentHealth);
      }
    };

    loadDashboardSummary();

    return () => {
      isMounted = false;
    };
  }, [
    appliedAnalyticsParams,
    fallbackFulfillmentQueue,
    fallbackLowStockProducts,
    fallbackMetrics,
    fallbackOrderStatusCounts,
    fallbackPaymentHealth
  ]);

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;

    const loadAnalytics = async () => {
      try {
        const response = await fetchDashboardAnalytics(appliedAnalyticsParams);
        if (!isMounted) return;
        setAnalytics(response.data?.data || fallbackAnalytics);
        setAnalyticsUpdatedAt(new Date());
      } catch {
        if (isMounted) setAnalytics(fallbackAnalytics);
      }
    };

    loadAnalytics();
    intervalId = window.setInterval(loadAnalytics, 10000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadAnalytics();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [appliedAnalyticsParams]);

  const cards = [
    { title: "Revenue", value: formatCurrency(metrics.revenue), note: "From orders in saved filter period" },
    { title: "Orders", value: metrics.orders, note: `${(orderStatusCounts.pending || 0) + (orderStatusCounts.confirmed || 0)} need review` },
    { title: "Products", value: metrics.products, note: `${lowStockProducts.length} stock alerts` },
    { title: "Customers", value: metrics.customers, note: "Customers in saved filter period" }
  ];
  const operationalStats = [
    { label: "Pending", value: orderStatusCounts.pending || 0 },
    { label: "Packed", value: orderStatusCounts.packed || 0 },
    { label: "Shipped", value: orderStatusCounts.shipped || 0 },
    { label: "Payment Health", value: formatPercent(paymentHealth) }
  ];
  const analyticsCards = [
    { title: "Total Sessions", value: analytics.overview?.totalSessions || analytics.funnel.sessions || 0, note: "Unique visitor sessions" },
    { title: "Total Users", value: analytics.overview?.totalUsers || analytics.funnel.users || 0, note: "Logged-in tracked users" },
    { title: "Conversion Rate", value: `${analytics.overview?.conversionRate || analytics.totals.conversionRate || 0}%`, note: `${analytics.funnel.purchases || 0} purchases from ${analytics.funnel.sessions || 0} sessions` },
    { title: "Add to Cart Rate", value: `${analytics.rates?.addToCartRate || 0}%`, note: `${analytics.funnel.addToCart || 0} carts from ${analytics.funnel.productViews || 0} product views` },
    { title: "Checkout Rate", value: `${analytics.rates?.checkoutRate || 0}%`, note: `${analytics.funnel.checkoutStart || 0} checkouts from ${analytics.funnel.addToCart || 0} carts` },
    { title: "Purchase Rate", value: `${analytics.rates?.purchaseRate || 0}%`, note: `${analytics.funnel.purchases || 0} purchases from ${analytics.funnel.checkoutStart || 0} checkouts` },
    { title: "Abandoned Cart", value: analytics.funnel.abandonedCarts || 0, note: "Cart sessions without purchase after the window" }
  ];
  const productInsights = analytics.productInsights || {
    mostViewed: analytics.topViewedProducts || [],
    mostPurchased: [],
    lowConversion: []
  };
  const searchInsights = analytics.searchInsights || {
    topSearches: analytics.topSearchQueries || [],
    noResultSearches: []
  };

  return (
    <section className="dashboard-home-section" style={pageStyle}>
      <div className="dashboard-panel-head">
        <div>
          <p className="dashboard-panel-label">Overview</p>
          <h2 style={{ margin: "0.35rem 0 0" }}>Dashboard Overview</h2>
          <p style={mutedTextStyle}>Daily ecommerce snapshot for catalog health, fulfillment, and customer activity.</p>
        </div>
      </div>
      <section style={filterPanelStyle}>
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <span style={filterLabelStyle}>Filter by</span>
            <select style={filterControlStyle} value={periodMode} onChange={(event) => setPeriodMode(event.target.value)}>
              <option value="last30">Last 30 days</option>
              <option value="date">Date</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Manual range</option>
            </select>
          </div>
          {periodMode === "date" ? (
            <input style={filterControlStyle} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          ) : null}
          {periodMode === "month" ? (
            <input style={filterControlStyle} type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          ) : null}
          {periodMode === "year" ? (
            <input style={filterControlStyle} type="number" min="2020" max="2100" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} />
          ) : null}
          {periodMode === "custom" ? (
            <>
              <input style={filterControlStyle} type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
              <input style={filterControlStyle} type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
            </>
          ) : null}
          <label style={compareToggleStyle}>
            <input type="checkbox" checked={compareEnabled} onChange={(event) => setCompareEnabled(event.target.checked)} />
            <span>Compare periods</span>
          </label>
          <button type="button" style={applyFilterButtonStyle} onClick={applyAnalyticsFilters}>
            Save Filter
          </button>
        </div>
        {compareEnabled ? (
          <div style={filterRowStyle}>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>Compare with</span>
              <select style={filterControlStyle} value={compareMode} onChange={(event) => setCompareMode(event.target.value)}>
                <option value="date">Date</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="custom">Manual range</option>
              </select>
            </div>
            {compareMode === "date" ? (
              <input style={filterControlStyle} type="date" value={compareDate} onChange={(event) => setCompareDate(event.target.value)} />
            ) : null}
            {compareMode === "month" ? (
              <input style={filterControlStyle} type="month" value={compareMonth} onChange={(event) => setCompareMonth(event.target.value)} />
            ) : null}
            {compareMode === "year" ? (
              <input style={filterControlStyle} type="number" min="2020" max="2100" value={compareYear} onChange={(event) => setCompareYear(event.target.value)} />
            ) : null}
            {compareMode === "custom" ? (
              <>
                <input style={filterControlStyle} type="date" value={compareStartDate} onChange={(event) => setCompareStartDate(event.target.value)} />
                <input style={filterControlStyle} type="date" value={compareEndDate} onChange={(event) => setCompareEndDate(event.target.value)} />
              </>
            ) : null}
            {analytics.comparison ? (
              <span style={comparisonSummaryStyle}>
                {`${analytics.comparison.current.overview.conversionRate}% vs ${analytics.comparison.compare.overview.conversionRate}% conversion`}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="dashboard-stat-grid dashboard-stat-grid-home">
        {cards.map((card) => (
          <div key={card.title} className="dashboard-stat-card dashboard-stat-card-home">
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <small style={cardNoteStyle}>{card.note}</small>
          </div>
        ))}
      </div>

      <section style={insightGridStyle}>
        <article style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Operations</p>
              <h3 style={panelTitleStyle}>Fulfillment Queue</h3>
            </div>
            <Link to="/dashboard/orders" style={smallLinkStyle}>Open Orders</Link>
          </div>
          <div style={metricStripStyle}>
            {operationalStats.map((item) => (
              <div key={item.label} style={miniMetricStyle}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div style={listStyle}>
            {fulfillmentQueue.map((order) => (
              <div key={order.id} style={listItemStyle}>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <p style={mutedTextStyle}>{`${order.customer.fullName} - ${order.orderStatus.replace(/_/g, " ")}`}</p>
                </div>
                <strong>{formatCurrency(order.pricing.grandTotal)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Inventory</p>
              <h3 style={panelTitleStyle}>Stock Alerts</h3>
            </div>
            <Link to="/dashboard/products" style={smallLinkStyle}>Manage Stock</Link>
          </div>
          <div style={listStyle}>
            {lowStockProducts.length ? lowStockProducts.map((product) => (
              <div key={product.slug} style={listItemStyle}>
                <div style={productRowStyle}>
                  <img src={resolveAdminMediaUrl(product.image)} alt={product.name} style={productImageStyle} />
                  <div>
                    <strong>{product.name}</strong>
                    <p style={mutedTextStyle}>{`${product.sku} - ${product.stockStatus.replace(/-/g, " ")}`}</p>
                  </div>
                </div>
                <strong>{product.stock}</strong>
              </div>
            )) : (
              <div style={emptyStateStyle}>No stock alerts right now.</div>
            )}
          </div>
        </article>
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Analytics</p>
            <h3 style={panelTitleStyle}>Business Analytics</h3>
            <p style={mutedTextStyle}>Overview, product insights, search demand, and funnel drop-off from aggregated analytics tables.</p>
          </div>
          <span style={analyticsTotalStyle}>
            {analyticsUpdatedAt ? `${analytics.totals.todayEvents || 0} events today | Updated ${analyticsUpdatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : `${analytics.totals.todayEvents || 0} events today`}
          </span>
        </div>
        <div style={analyticsGridStyle}>
          {analyticsCards.map((card) => (
            <div key={card.title} style={analyticsCardStyle}>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </div>
          ))}
        </div>
        <div style={analyticsDetailGridStyle}>
          <article style={subPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Search Insights</p>
                <h4 style={subPanelTitleStyle}>Top Searches</h4>
              </div>
            </div>
            <div style={listStyle}>
              {searchInsights.topSearches.length ? searchInsights.topSearches.map((item) => (
                <div key={item.query} style={listItemStyle}>
                  <div>
                    <strong>{item.query}</strong>
                    <p style={mutedTextStyle}>{`${item.zeroResultCount || 0} no-result | ${item.clickedProductCount || 0} clicks`}</p>
                  </div>
                  <span style={countPillStyle}>{item.total}</span>
                </div>
              )) : <div style={emptyStateStyle}>No search events captured yet.</div>}
            </div>
          </article>
          <article style={subPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Product Insights</p>
                <h4 style={subPanelTitleStyle}>Most Viewed Products</h4>
              </div>
            </div>
            <div style={listStyle}>
              {productInsights.mostViewed.length ? productInsights.mostViewed.map((item) => (
                <div key={`${item.slug || item.asin || item.name}`} style={listItemStyle}>
                  <div>
                    <strong>{item.name}</strong>
                    <p style={mutedTextStyle}>{item.asin || item.slug || "Tracked product"}</p>
                  </div>
                  <span style={countPillStyle}>{item.views}</span>
                </div>
              )) : <div style={emptyStateStyle}>No product views captured yet.</div>}
            </div>
          </article>
          <article style={subPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Funnel</p>
                <h4 style={subPanelTitleStyle}>Conversion Rates</h4>
              </div>
            </div>
            <div style={listStyle}>
              {[
                ["Add to cart rate", `${analytics.rates?.addToCartRate || 0}%`, `${analytics.funnel.addToCart || 0} carts from ${analytics.funnel.productViews || 0} product views | ${analytics.dropOffs?.productViewToCart || 0} dropped`],
                ["Checkout rate", `${analytics.rates?.checkoutRate || 0}%`, `${analytics.funnel.checkoutStart || 0} checkouts from ${analytics.funnel.addToCart || 0} carts | ${analytics.dropOffs?.cartToCheckout || 0} dropped`],
                ["Purchase rate", `${analytics.rates?.purchaseRate || 0}%`, `${analytics.funnel.purchases || 0} purchases from ${analytics.funnel.checkoutStart || 0} checkouts | ${analytics.dropOffs?.checkoutToPurchase || 0} dropped`]
              ].map(([label, value, note]) => (
                <div key={label} style={listItemStyle}>
                  <div>
                    <strong>{label}</strong>
                    <p style={mutedTextStyle}>{note}</p>
                  </div>
                  <span style={countPillStyle}>{value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
        <div style={analyticsDetailGridStyle}>
          <article style={subPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Product Insights</p>
                <h4 style={subPanelTitleStyle}>Most Purchased</h4>
              </div>
            </div>
            <div style={listStyle}>
              {productInsights.mostPurchased.length ? productInsights.mostPurchased.map((item) => (
                <div key={`${item.slug || item.asin || item.name}-purchased`} style={listItemStyle}>
                  <strong>{item.name}</strong>
                  <span style={countPillStyle}>{item.purchases}</span>
                </div>
              )) : <div style={emptyStateStyle}>No purchase events captured yet.</div>}
            </div>
          </article>
          <article style={subPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Product Insights</p>
                <h4 style={subPanelTitleStyle}>Low Conversion Products</h4>
              </div>
            </div>
            <div style={listStyle}>
              {productInsights.lowConversion.length ? productInsights.lowConversion.map((item) => (
                <div key={`${item.slug || item.asin || item.name}-low`} style={listItemStyle}>
                  <div>
                    <strong>{item.name}</strong>
                    <p style={mutedTextStyle}>{`${item.views} views | ${item.purchases} purchases`}</p>
                  </div>
                  <span style={countPillStyle}>{item.conversionRate || 0}%</span>
                </div>
              )) : <div style={emptyStateStyle}>No low-conversion products yet.</div>}
            </div>
          </article>
          <article style={subPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Search Insights</p>
                <h4 style={subPanelTitleStyle}>No-result Searches</h4>
              </div>
            </div>
            <div style={listStyle}>
              {searchInsights.noResultSearches.length ? searchInsights.noResultSearches.map((item) => (
                <div key={`${item.query}-zero`} style={listItemStyle}>
                  <strong>{item.query}</strong>
                  <span style={countPillStyle}>{item.zeroResultCount}</span>
                </div>
              )) : <div style={emptyStateStyle}>No no-result searches yet.</div>}
            </div>
          </article>
        </div>
      </section>

      <section style={actionGridStyle}>
        <Link to="/dashboard/orders" style={actionCardStyle}>
          <strong>Process new orders</strong>
          <span>Review payment status, packing state, and courier assignment.</span>
        </Link>
        <Link to="/dashboard/products" style={actionCardStyle}>
          <strong>Clean product catalog</strong>
          <span>Check stock, inactive items, featured products, and pricing.</span>
        </Link>
        <Link to="/dashboard/customers" style={actionCardStyle}>
          <strong>Review customers</strong>
          <span>Open customer records, high-value buyers, and verification state.</span>
        </Link>
      </section>
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "20px",
  width: "100%"
};

const smallLinkStyle = {
  color: "#0f766e",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: "13px"
};

const mutedTextStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "13px"
};

const cardNoteStyle = {
  marginTop: "8px",
  color: "#64748b",
  fontWeight: 600
};

const filterPanelStyle = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #dbe7f0",
  background: "#fff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
};

const filterRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  alignItems: "center"
};

const filterGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px"
};

const filterLabelStyle = {
  color: "#475569",
  fontSize: "13px",
  fontWeight: 800
};

const filterControlStyle = {
  minHeight: "38px",
  minWidth: "150px",
  padding: "0 10px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 700
};

const compareToggleStyle = {
  minHeight: "38px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  fontWeight: 800,
  background: "#f8fafc"
};

const applyFilterButtonStyle = {
  minHeight: "38px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer"
};

const comparisonSummaryStyle = {
  minHeight: "38px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 12px",
  borderRadius: "999px",
  background: "#ecfdf5",
  color: "#047857",
  fontSize: "13px",
  fontWeight: 800
};

const insightGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "20px"
};

const panelStyle = {
  background: "#fff",
  borderRadius: "16px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.14)",
  padding: "18px",
  display: "grid",
  gap: "16px"
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px"
};

const eyebrowStyle = {
  margin: 0,
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase"
};

const panelTitleStyle = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: "20px"
};

const metricStripStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px"
};

const miniMetricStyle = {
  padding: "12px",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px solid #e5edf5",
  display: "grid",
  gap: "4px"
};

const listStyle = {
  display: "grid",
  gap: "10px"
};

const listItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc"
};

const productRowStyle = {
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "center"
};

const productImageStyle = {
  width: "44px",
  height: "44px",
  borderRadius: "10px",
  objectFit: "cover",
  background: "#fff"
};

const emptyStateStyle = {
  padding: "16px",
  borderRadius: "12px",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  background: "#f8fafc"
};

const analyticsTotalStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  background: "#ecfdf5",
  color: "#047857",
  fontWeight: 800,
  fontSize: "13px",
  whiteSpace: "nowrap"
};

const analyticsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: "10px"
};

const analyticsCardStyle = {
  minHeight: "112px",
  padding: "14px",
  borderRadius: "14px",
  background: "#f8fafc",
  border: "1px solid #e5edf5",
  display: "grid",
  alignContent: "space-between",
  gap: "8px"
};

const analyticsDetailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "14px"
};

const subPanelStyle = {
  display: "grid",
  gap: "12px",
  alignContent: "start"
};

const subPanelTitleStyle = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: "16px"
};

const countPillStyle = {
  minWidth: "34px",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#fff",
  border: "1px solid #dbe7f0",
  color: "#0f172a",
  fontWeight: 800,
  textAlign: "center"
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "16px"
};

const actionCardStyle = {
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #dbe7f0",
  background: "#fff",
  color: "#334155",
  textDecoration: "none",
  display: "grid",
  gap: "6px",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
};
