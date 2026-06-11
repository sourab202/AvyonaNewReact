import { query } from "../config/db.js";

function parsePositiveInteger(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

function parseDateValue(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

function parseMonthValue(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) return null;
  return text;
}

function parseYearValue(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}$/.test(text)) return null;
  return text;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getRangeParam(query, prefix, name) {
  if (!prefix) return query[name];
  const prefixedName = `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  const lowerPrefixedName = `${prefix}${name}`;
  return query[prefixedName] ?? query[lowerPrefixedName];
}

function buildDateRange(query, prefix = "") {
  const mode = String(getRangeParam(query, prefix, "mode") || getRangeParam(query, prefix, "periodMode") || "last30").trim();
  const today = getTodayIsoDate();

  if (mode === "date") {
    const date = parseDateValue(getRangeParam(query, prefix, "date")) || today;
    return { mode, startDate: date, endDate: date };
  }

  if (mode === "month") {
    const month = parseMonthValue(getRangeParam(query, prefix, "month")) || today.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return { mode, startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, "0")}` };
  }

  if (mode === "year") {
    const year = parseYearValue(getRangeParam(query, prefix, "year")) || today.slice(0, 4);
    return { mode, startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }

  if (mode === "custom") {
    const startDate = parseDateValue(getRangeParam(query, prefix, "startDate")) || today;
    const endDate = parseDateValue(getRangeParam(query, prefix, "endDate")) || startDate;
    return startDate <= endDate
      ? { mode, startDate, endDate }
      : { mode, startDate: endDate, endDate: startDate };
  }

  return { mode: "last30", startDate: null, endDate: null };
}

function parseAnalyticsOptions(request) {
  const range = buildDateRange(request.query);
  const compareEnabled = String(request.query.compare || "").trim() === "true";
  const compareRange = compareEnabled ? buildDateRange(request.query, "compare") : null;

  return {
    limit: parsePositiveInteger(request.query.limit, 8, 50),
    page: parsePositiveInteger(request.query.page, 1, 10000),
    productSearch: String(request.query.productSearch || "").trim().slice(0, 120),
    searchQuery: String(request.query.searchQuery || "").trim().slice(0, 120),
    range,
    compareEnabled,
    compareRange
  };
}

function getDateWhereClause(alias, range) {
  const column = alias ? `${alias}.\`date\`` : "`date`";
  if (range.startDate && range.endDate) {
    return { sql: `${column} BETWEEN ? AND ?`, values: [range.startDate, range.endDate] };
  }

  return { sql: `${column} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`, values: [] };
}

function getTimestampWhereClause(alias, range) {
  const column = alias ? `${alias}.created_at` : "created_at";
  if (range.startDate && range.endDate) {
    return {
      sql: `${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`,
      values: [range.startDate, range.endDate]
    };
  }

  return { sql: `${column} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`, values: [] };
}

function getAnalyticsTimestampWhereClause(alias, range) {
  const column = alias ? `${alias}.occurred_at` : "occurred_at";
  if (range.startDate && range.endDate) {
    return {
      sql: `${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`,
      values: [range.startDate, range.endDate]
    };
  }

  return { sql: `${column} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`, values: [] };
}

function getDateEqualsTodayClause(alias) {
  const column = alias ? `${alias}.\`date\`` : "`date`";
  return `${column} = CURDATE()`;
}

function percent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

async function getFunnelSummary(range) {
  const timestampWhere = getAnalyticsTimestampWhereClause("ae", range);
  const abandonedWhere = range.startDate && range.endDate
    ? {
      sql: "abandoned_at >= ? AND abandoned_at < DATE_ADD(?, INTERVAL 1 DAY)",
      values: [range.startDate, range.endDate]
    }
    : {
      sql: "abandoned_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)",
      values: []
    };
  const [funnelRow] = await query(
    `SELECT
      COUNT(DISTINCT NULLIF(ae.session_id, '')) AS sessions,
      COUNT(DISTINCT COALESCE(ae.user_id, ae.customer_id)) AS users,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'product_view' THEN NULLIF(ae.session_id, '') END) AS productViewSessions,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'add_to_cart' THEN NULLIF(ae.session_id, '') END) AS cartSessions,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'checkout_start' THEN NULLIF(ae.session_id, '') END) AS checkoutSessions,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'purchase' THEN NULLIF(ae.session_id, '') END) AS purchaseSessions,
      SUM(ae.event_type = 'product_view') AS productViewEvents,
      SUM(ae.event_type = 'search') AS searchQueries,
      SUM(ae.event_type = 'add_to_cart') AS addToCartEvents,
      SUM(ae.event_type = 'checkout_start') AS checkoutEvents,
      SUM(ae.event_type = 'purchase') AS purchaseEvents,
      SUM(ae.event_type = 'category_view') AS categoryViews,
      SUM(ae.event_type = 'remove_from_cart') AS removeFromCart,
      SUM(ae.event_type = 'wishlist_add') AS wishlistAdd,
      SUM(ae.event_type = 'filter_applied') AS filterApplied
     FROM analytics_events ae
     WHERE ${timestampWhere.sql}`,
    timestampWhere.values
  );
  const [abandonedRow] = await query(
    `SELECT COUNT(DISTINCT session_id) AS abandonedCartSessions
     FROM analytics_abandoned_carts
     WHERE ${abandonedWhere.sql}`,
    abandonedWhere.values
  );

  const funnel = {
    sessions: Number(funnelRow.sessions || 0),
    users: Number(funnelRow.users || 0),
    productViews: Number(funnelRow.productViewSessions || 0),
    searchQueries: Number(funnelRow.searchQueries || 0),
    addToCart: Number(funnelRow.cartSessions || 0),
    checkoutStart: Number(funnelRow.checkoutSessions || 0),
    purchases: Number(funnelRow.purchaseSessions || 0),
    abandonedCarts: Number(abandonedRow.abandonedCartSessions || 0)
  };

  const supporting = {
    categoryViews: Number(funnelRow.categoryViews || 0),
    removeFromCart: Number(funnelRow.removeFromCart || 0),
    wishlistAdd: Number(funnelRow.wishlistAdd || 0),
    filterApplied: Number(funnelRow.filterApplied || 0),
    eventCounts: {
      productViews: Number(funnelRow.productViewEvents || 0),
      addToCart: Number(funnelRow.addToCartEvents || 0),
      checkoutStart: Number(funnelRow.checkoutEvents || 0),
      purchases: Number(funnelRow.purchaseEvents || 0)
    }
  };

  return {
    overview: {
      totalSessions: funnel.sessions,
      totalUsers: funnel.users,
      conversionRate: percent(funnel.purchases, funnel.sessions)
    },
    funnel,
    supporting,
    rates: {
      addToCartRate: percent(funnel.addToCart, funnel.productViews),
      checkoutRate: percent(funnel.checkoutStart, funnel.addToCart),
      purchaseRate: percent(funnel.purchases, funnel.checkoutStart)
    },
    dropOffs: {
      visitorToProductView: Math.max(0, funnel.sessions - funnel.productViews),
      productViewToCart: Math.max(0, funnel.productViews - funnel.addToCart),
      cartToCheckout: Math.max(0, funnel.addToCart - funnel.checkoutStart),
      checkoutToPurchase: Math.max(0, funnel.checkoutStart - funnel.purchases)
    }
  };
}

export async function getDashboardSummary(request, response) {
  const range = buildDateRange(request.query);
  const productWhere = getTimestampWhereClause("p", range);
  const customerWhere = getTimestampWhereClause("c", range);
  const orderWhere = getTimestampWhereClause("o", range);

  const [productCountRow] = await query("SELECT COUNT(*) AS totalProducts FROM products WHERE is_deleted = 0");
  const [categoryCountRow] = await query("SELECT COUNT(*) AS totalCategories FROM categories");
  const [customerCountRow] = await query(`SELECT COUNT(*) AS totalCustomers FROM customers c WHERE ${customerWhere.sql}`, customerWhere.values);
  const [orderCountRow] = await query(`SELECT COUNT(*) AS totalOrders FROM orders o WHERE ${orderWhere.sql}`, orderWhere.values);
  const [revenueRow] = await query(
    `SELECT COALESCE(SUM(o.total_amount), 0) AS totalRevenue
     FROM orders o
     WHERE ${orderWhere.sql}
       AND o.payment_status IN ('paid', 'authorized')
       AND o.status NOT IN ('cancelled', 'failed', 'returned')`,
    orderWhere.values
  );

  const lowStockProducts = await query(
    `SELECT p.id, p.name, p.slug, p.image_url AS image, p.sku, p.stock_quantity AS stockQuantity, p.status
     FROM products p
     WHERE p.is_deleted = 0
       AND (p.stock_quantity <= p.low_stock_threshold OR p.status = 'out_of_stock')
     ORDER BY p.stock_quantity ASC, p.updated_at DESC
     LIMIT 5`
  );

  const latestOrders = await query(
    `SELECT
      o.id,
      o.order_number AS orderNumber,
      c.full_name AS customerName,
      o.status,
      o.total_amount AS totalAmount,
      o.created_at AS createdAt
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ${orderWhere.sql}
       AND o.status NOT IN ('delivered', 'cancelled', 'returned')
     ORDER BY o.created_at DESC
     LIMIT 5`,
    orderWhere.values
  );

  const orderStatusRows = await query(
    `SELECT o.status, COUNT(*) AS count
     FROM orders o
     WHERE ${orderWhere.sql}
     GROUP BY o.status`,
    orderWhere.values
  );

  const [paymentHealthRow] = await query(
    `SELECT
      COUNT(*) AS totalOrders,
      SUM(CASE WHEN o.payment_status IN ('paid', 'authorized') THEN 1 ELSE 0 END) AS paidOrders
     FROM orders o
     WHERE ${orderWhere.sql}`,
    orderWhere.values
  );

  const topCategories = await query(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS productCount
     FROM categories c
     LEFT JOIN product_categories pc
       ON pc.category_id = c.id
       AND pc.relation_type = 'primary'
     LEFT JOIN products p
       ON p.id = pc.product_id
       AND p.is_deleted = 0
     GROUP BY c.id, c.name, c.slug
     ORDER BY productCount DESC, c.name ASC
     LIMIT 5`
  );
  const orderStatusCounts = orderStatusRows.reduce((counts, row) => {
    counts[row.status] = Number(row.count || 0);
    return counts;
  }, {});
  const paidOrders = Number(paymentHealthRow.paidOrders || 0);
  const filteredOrders = Number(paymentHealthRow.totalOrders || 0);

  response.json({
    success: true,
    data: {
      range,
      metrics: {
        products: Number(productCountRow.totalProducts || 0),
        categories: Number(categoryCountRow.totalCategories || 0),
        customers: Number(customerCountRow.totalCustomers || 0),
        orders: Number(orderCountRow.totalOrders || 0),
        revenue: Number(revenueRow.totalRevenue || 0)
      },
      operations: {
        orderStatusCounts,
        paymentHealth: filteredOrders ? Math.round((paidOrders / filteredOrders) * 100) : 0,
        paidOrders,
        totalOrders: filteredOrders
      },
      lowStockProducts,
      latestOrders,
      topCategories
    }
  });
}

export async function getDashboardAnalytics(request, response) {
  const options = parseAnalyticsOptions(request);
  const offset = (options.page - 1) * options.limit;
  const dateWhere = getDateWhereClause("", options.range);
  const productFilter = options.productSearch
    ? "AND (product_name LIKE ? OR product_slug LIKE ? OR product_asin LIKE ?)"
    : "";
  const productValues = options.productSearch
    ? [`%${options.productSearch}%`, `%${options.productSearch}%`, `%${options.productSearch}%`]
    : [];
  const searchFilter = options.searchQuery ? "AND search_query LIKE ?" : "";
  const searchValues = options.searchQuery ? [`%${options.searchQuery}%`] : [];

  const analyticsTimestampWhere = getAnalyticsTimestampWhereClause("ae", options.range);
  const [totalEventsRow] = await query(
    `SELECT COUNT(*) AS totalEvents
     FROM analytics_events ae
     WHERE ${analyticsTimestampWhere.sql}
       AND ae.event_type <> 'abandoned_cart'`,
    analyticsTimestampWhere.values
  );
  const [todayEventsRow] = await query(
    `SELECT COUNT(*) AS todayEvents
     FROM analytics_events
     WHERE occurred_at >= CURDATE()
       AND occurred_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       AND event_type <> 'abandoned_cart'`
  );

  const summary = await getFunnelSummary(options.range);

  const topViewedProducts = await query(
    `SELECT
      COALESCE(MAX(product_name), MAX(product_slug), MAX(product_asin), 'Unknown product') AS name,
      MAX(product_slug) AS slug,
      MAX(product_asin) AS asin,
      SUM(views) AS views
     FROM daily_product_metrics
     WHERE ${dateWhere.sql}
       ${productFilter}
     GROUP BY product_key
     HAVING SUM(views) > 0
     ORDER BY views DESC, name ASC
     LIMIT ? OFFSET ?`,
    [...dateWhere.values, ...productValues, options.limit, offset]
  );

  const orderWhere = getTimestampWhereClause("o", options.range);
  const mostPurchasedProducts = await query(
    `SELECT
      COALESCE(MAX(p.name), MAX(oi.product_name), 'Unknown product') AS name,
      MAX(p.slug) AS slug,
      MAX(p.asin) AS asin,
      SUM(oi.quantity) AS purchases,
      COUNT(DISTINCT o.id) AS orders
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE ${orderWhere.sql}
       AND o.status NOT IN ('cancelled', 'failed', 'returned')
       ${options.productSearch ? "AND (p.name LIKE ? OR p.slug LIKE ? OR p.asin LIKE ? OR oi.product_name LIKE ?)" : ""}
     GROUP BY COALESCE(oi.product_id, oi.product_name)
     ORDER BY purchases DESC, orders DESC, name ASC
     LIMIT ? OFFSET ?`,
    [
      ...orderWhere.values,
      ...(options.productSearch
        ? [...productValues, `%${options.productSearch}%`]
        : []),
      options.limit,
      offset
    ]
  );

  const lowConversionProducts = await query(
    `SELECT
      COALESCE(MAX(product_name), MAX(product_slug), MAX(product_asin), 'Unknown product') AS name,
      MAX(product_slug) AS slug,
      MAX(product_asin) AS asin,
      SUM(views) AS views,
      SUM(purchases) AS purchases,
      ROUND((SUM(purchases) / NULLIF(SUM(views), 0)) * 100) AS conversionRate
     FROM daily_product_metrics
     WHERE ${dateWhere.sql}
       ${productFilter}
     GROUP BY product_key
     HAVING views >= 1 AND conversionRate < 20
     ORDER BY conversionRate ASC, views DESC, name ASC
     LIMIT ? OFFSET ?`,
    [...dateWhere.values, ...productValues, options.limit, offset]
  );

  const topSearchQueries = await query(
    `SELECT
      search_query AS query,
      SUM(\`count\`) AS total,
      ROUND(SUM(total_result_count) / NULLIF(SUM(\`count\`), 0)) AS averageResultCount,
      SUM(zero_result_count) AS zeroResultCount,
      SUM(clicked_product_count) AS clickedProductCount,
      MAX(last_clicked_product_id) AS lastClickedProductId
     FROM daily_search_metrics
     WHERE ${dateWhere.sql}
       ${searchFilter}
     GROUP BY search_query
     ORDER BY total DESC, search_query ASC
     LIMIT ? OFFSET ?`,
    [...dateWhere.values, ...searchValues, options.limit, offset]
  );

  const noResultSearches = await query(
    `SELECT
      search_query AS query,
      SUM(zero_result_count) AS zeroResultCount,
      SUM(\`count\`) AS total,
      MAX(last_clicked_product_id) AS lastClickedProductId
     FROM daily_search_metrics
     WHERE ${dateWhere.sql}
       ${searchFilter}
     GROUP BY search_query
     HAVING zeroResultCount > 0
     ORDER BY zeroResultCount DESC, total DESC, search_query ASC
     LIMIT ? OFFSET ?`,
    [...dateWhere.values, ...searchValues, options.limit, offset]
  );

  const topCategories = await query(
    `SELECT
      COALESCE(MAX(category_name), MAX(category_slug), 'Unknown category') AS name,
      MAX(category_slug) AS slug,
      SUM(views) AS views,
      SUM(conversions) AS conversions
     FROM daily_category_metrics
     WHERE ${dateWhere.sql}
     GROUP BY category_key
     ORDER BY views DESC, conversions DESC, name ASC
     LIMIT ?`,
    [...dateWhere.values, options.limit]
  );

  const comparison = options.compareEnabled && options.compareRange
    ? {
      current: {
        range: options.range,
        ...(await getFunnelSummary(options.range))
      },
      compare: {
        range: options.compareRange,
        ...(await getFunnelSummary(options.compareRange))
      }
    }
    : null;

  response.json({
    success: true,
    data: {
      totals: {
        totalEvents: Number(totalEventsRow.totalEvents || 0),
        todayEvents: Number(todayEventsRow.todayEvents || 0),
        conversionRate: summary.overview.conversionRate
      },
      range: options.range,
      comparison,
      overview: summary.overview,
      funnel: summary.funnel,
      rates: summary.rates,
      dropOffs: summary.dropOffs,
      supporting: summary.supporting,
      productInsights: {
        pagination: { page: options.page, limit: options.limit },
        mostViewed: topViewedProducts,
        mostPurchased: mostPurchasedProducts,
        lowConversion: lowConversionProducts
      },
      searchInsights: {
        pagination: { page: options.page, limit: options.limit },
        topSearches: topSearchQueries,
        noResultSearches
      },
      topViewedProducts,
      topSearchQueries,
      topCategories,
      recentEvents: []
    }
  });
}
