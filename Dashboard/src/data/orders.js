import { ORDER_STATUS_FLOW } from "../../../shared/orderStatusFlow";

export const orderStatusOptions = ORDER_STATUS_FLOW;

export const paymentStatusOptions = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "partially-refunded",
  "cod-pending"
];

function createTimelineEvent(title, status, dateTime, note = "") {
  return {
    id: `${title}-${dateTime}`,
    title,
    status,
    dateTime,
    note
  };
}

function createAddress({
  fullName,
  phone,
  email,
  line1,
  line2 = "",
  landmark = "",
  city,
  state,
  postalCode,
  country = "India"
}) {
  return {
    fullName,
    phone,
    email,
    line1,
    line2,
    landmark,
    city,
    state,
    postalCode,
    country
  };
}

function createOrderItem({
  id,
  productId,
  slug,
  name,
  sku,
  image,
  category,
  variantLabel = "",
  quantity,
  unitPrice,
  lineTotal
}) {
  return {
    id,
    productId,
    slug,
    name,
    sku,
    image,
    category,
    variantLabel,
    quantity,
    unitPrice,
    lineTotal
  };
}

function createOrder(order) {
  return {
    id: order.id,
    customerName: order.customer.fullName,
    date: order.placedAt,
    total: order.pricing.grandTotal,
    paymentMethod: order.payment.method,
    itemsCount: order.products.length,
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    updatedAt: order.updatedAt,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    courierName: order.courierName || "",
    expectedDeliveryDate: order.expectedDeliveryDate || "",
    customer: order.customer,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    products: order.products,
    pricing: order.pricing,
    payment: order.payment,
    notes: order.notes,
    timeline: order.timeline
  };
}

const orders = [
  createOrder({
    id: 1,
    orderNumber: "AVY-1001",
    placedAt: "2026-04-18T10:25:00+05:30",
    updatedAt: "2026-04-20T14:15:00+05:30",
    orderStatus: "shipped",
    paymentStatus: "paid",
    courierName: "Blue Dart",
    expectedDeliveryDate: "2026-04-24T18:00:00+05:30",
    customer: {
      id: 101,
      fullName: "Rahul Mehta",
      email: "rahul.mehta@example.com",
      phone: "+91 9876543210"
    },
    shippingAddress: createAddress({
      fullName: "Rahul Mehta",
      phone: "+91 9876543210",
      email: "rahul.mehta@example.com",
      line1: "Flat 402, Lakeview Residency",
      line2: "Madhapur",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500081"
    }),
    billingAddress: createAddress({
      fullName: "Rahul Mehta",
      phone: "+91 9876543210",
      email: "rahul.mehta@example.com",
      line1: "Flat 402, Lakeview Residency",
      line2: "Madhapur",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500081"
    }),
    products: [
      createOrderItem({
        id: "oi-1001-1",
        productId: 11,
        slug: "avyona-aura-10-frame",
        name: "Avyona Aura 10 Frame",
        sku: "AVY-AURA10",
        image: "",
        category: "Avyona Digital Photo Frames",
        variantLabel: "Ivory White",
        quantity: 1,
        unitPrice: 8999,
        lineTotal: 8999
      })
    ],
    pricing: {
      subtotal: 8999,
      shippingFee: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 8999,
      currency: "INR"
    },
    payment: {
      method: "PhonePe",
      transactionId: "PAY-AVY-880011",
      paymentReference: "PHONEPE-200981",
      paidAt: "2026-04-18T10:27:00+05:30"
    },
    notes: {
      customerNote: "Please deliver after 5 PM.",
      adminRemark: "High-value order. Dispatch with extra packaging."
    },
    timeline: [
      createTimelineEvent("Order placed", "confirmed", "2026-04-18T10:25:00+05:30", "Customer completed checkout successfully."),
      createTimelineEvent("Payment captured", "paid", "2026-04-18T10:27:00+05:30", "PhonePe payment confirmed."),
      createTimelineEvent("Packed", "packed", "2026-04-19T09:40:00+05:30", "Warehouse packed the order."),
      createTimelineEvent("Shipped", "shipped", "2026-04-20T14:15:00+05:30", "Shipment handed over to courier partner.")
    ]
  }),
  createOrder({
    id: 2,
    orderNumber: "AVY-1002",
    placedAt: "2026-04-19T16:40:00+05:30",
    updatedAt: "2026-04-21T11:00:00+05:30",
    orderStatus: "confirmed",
    paymentStatus: "cod-pending",
    courierName: "",
    expectedDeliveryDate: "2026-04-27T20:00:00+05:30",
    customer: {
      id: 102,
      fullName: "Priya Sharma",
      email: "priya.sharma@example.com",
      phone: "+91 9988776655"
    },
    shippingAddress: createAddress({
      fullName: "Priya Sharma",
      phone: "+91 9988776655",
      email: "priya.sharma@example.com",
      line1: "22, Green Park Avenue",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411045"
    }),
    billingAddress: createAddress({
      fullName: "Priya Sharma",
      phone: "+91 9988776655",
      email: "priya.sharma@example.com",
      line1: "22, Green Park Avenue",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411045"
    }),
    products: [
      createOrderItem({
        id: "oi-1002-1",
        productId: 7,
        slug: "jbl-flexsound-neckband",
        name: "JBL FlexSound Neckband",
        sku: "AVY-JBLFLEX",
        image: "",
        category: "Personal Audio",
        variantLabel: "Ocean Blue",
        quantity: 1,
        unitPrice: 4499,
        lineTotal: 4499
      }),
      createOrderItem({
        id: "oi-1002-2",
        productId: 6,
        slug: "glocusent-focus-reading-light",
        name: "Glocusent Focus Reading Light",
        sku: "AVY-GLOCUSENT",
        image: "",
        category: "Reading Light",
        variantLabel: "Warm Grey",
        quantity: 2,
        unitPrice: 1999,
        lineTotal: 3998
      })
    ],
    pricing: {
      subtotal: 8497,
      shippingFee: 0,
      discountTotal: 250,
      taxTotal: 0,
      grandTotal: 8346,
      currency: "INR"
    },
    payment: {
      method: "Cash on Delivery",
      transactionId: "",
      paymentReference: "COD-AVY-1002",
      paidAt: ""
    },
    notes: {
      customerNote: "Call before delivery.",
      adminRemark: "Bundle shipment with single package ID."
    },
    timeline: [
      createTimelineEvent("Order placed", "confirmed", "2026-04-19T16:40:00+05:30", "COD order placed from website."),
      createTimelineEvent("Order confirmed", "confirmed", "2026-04-19T16:55:00+05:30", "Customer verified by support team."),
      createTimelineEvent("Order confirmed", "confirmed", "2026-04-21T11:00:00+05:30", "Items moved to the warehouse picking queue.")
    ]
  })
];

export default orders;
