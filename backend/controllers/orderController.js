import {
  placeNewOrder,
  verifyOrderPayment,
  getOrdersByUser,
  getAllOrders,
  changeOrderStatus,
  processRefund,
  cancelUserOrder,
  handleStripeWebhook,
  getOrderById,
  reorderPreviousOrder,
  submitOrderFeedback,
} from "../services/orderService.js";
import { logger } from '../utils/logger.js';

// Stripe webhook is only active when a real secret is configured.
// COD order creation and status updates never touch this route — they go
// through /api/order/place and /api/order/status respectively.
const webhookConfigured =
  !!process.env.STRIPE_WEBHOOK_SECRET &&
  !process.env.STRIPE_WEBHOOK_SECRET.startsWith('your_') &&
  process.env.STRIPE_WEBHOOK_SECRET.trim() !== '';

const ERROR_MESSAGES = {
  UNAUTHORIZED: "You are not authorised to perform this action",
  ORDER_NOT_PAID: "Order not found or not paid yet",
  ALREADY_REFUNDED: "Order already refunded",
  NO_PAYMENT_INTENT: "No Stripe payment intent found — cannot auto-refund",
  ORDER_NOT_FOUND: "Order not found",
  CANNOT_CANCEL: "Only orders in 'Food Processing' state can be cancelled",
  FEEDBACK_ONLY_AFTER_DELIVERED: "Feedback can be submitted only after the order is delivered",
  FEEDBACK_ALREADY_SUBMITTED: "Feedback already submitted for this order",
  FEEDBACK_NOT_SUPPORTED: "Feedback storage is not configured (missing `feedback_rating`, `feedback_comment` columns)",
};

const handleServiceError = (res, error, fallback = "An unexpected error occurred") => {
  // Handle prefix-based messages like ORDER_LOCKED: ...
  if (error.message?.startsWith("ORDER_LOCKED:")) {
    return res.status(400).json({ success: false, message: error.message.replace("ORDER_LOCKED: ", "") });
  }
  const msg = ERROR_MESSAGES[error.message] || error.message || fallback;
  res.json({ success: false, message: msg });
};


// ── Controllers ────────────────────────────────────────────────────────────────

const placeOrder = async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await placeNewOrder(req.body, io);
    if (result.isCOD) {
      return res.json({ success: true, message: "Order Placed Successfully via COD", isCOD: true });
    }
    res.json({ success: true, session_url: result.session_url });
  } catch (error) {
    logger.error('placeOrder error:', error);
    handleServiceError(res, error, "Error placing order");
  }
};

const verifyOrder = async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await verifyOrderPayment(req.body.orderId, req.body.success, io);
    if (result.paid) {
      return res.json({ success: true, message: "Paid" });
    }
    res.json({ success: false, message: "Not Paid" });
  } catch (error) {
    logger.error('verifyOrder error:', error);
    handleServiceError(res, error, "Error verifying order");
  }
};

const userOrders = async (req, res) => {
  try {
    const result = await getOrdersByUser(
      req.userId,
      parseInt(req.query.page) || 1,
      parseInt(req.query.limit) || 10
    );
    res.json({ success: true, ...result });
  } catch (error) {
    handleServiceError(res, error, "Error fetching orders");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const result = await getOrderById(req.params.orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, "Error fetching order details");
  }
};

const listOrders = async (req, res) => {
  try {
    const orders = await getAllOrders(req.userId || req.body.userId);
    res.json({ success: true, data: orders });
  } catch (error) {
    handleServiceError(res, error, "Error listing orders");
  }
};

const updateStatus = async (req, res) => {
  try {
    const io = req.app.get("io");
    await changeOrderStatus(req.body.userId, req.body.orderId, req.body.status, io);
    res.json({ success: true, message: "Status Updated Successfully" });
  } catch (error) {
    handleServiceError(res, error, "Error updating status");
  }
};

const refundOrder = async (req, res) => {
  try {
    const io = req.app.get("io");
    await processRefund(req.body.userId, req.body.orderId, req.body.reason, io);
    res.json({ success: true, message: "Refund Processed Successfully" });
  } catch (error) {
    handleServiceError(res, error, "Refund Error");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const io = req.app.get("io");
    await cancelUserOrder(req.body.userId, req.body.orderId, io);
    res.json({ success: true, message: "Order Cancelled Successfully" });
  } catch (error) {
    handleServiceError(res, error, "Cancellation Error");
  }
};

const reorderOrder = async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await reorderPreviousOrder(req.body.userId, req.body.orderId, io);
    if (result.isCOD) {
      return res.json({ success: true, isCOD: true, message: "Order Placed Successfully via COD" });
    }
    res.json({ success: true, session_url: result.session_url });
  } catch (error) {
    handleServiceError(res, error, "Reorder failed");
  }
};

const submitFeedback = async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await submitOrderFeedback(
      req.userId,
      req.body.orderId,
      req.body.rating,
      req.body.comment,
      io
    );
    res.json({ success: true, message: "Feedback submitted", data: result });
  } catch (error) {
    handleServiceError(res, error, "Feedback submission failed");
  }
};

const stripeWebhook = async (req, res) => {
  // Guard: skip processing entirely when the webhook secret is a placeholder.
  if (!webhookConfigured) {
    logger.warn('[Stripe] Webhook skipped — STRIPE_WEBHOOK_SECRET is not configured.');
    return res.status(200).send('ok');
  }

  try {
    const io = req.app.get("io");
    await handleStripeWebhook(req.body, req.headers["stripe-signature"], io);
    res.json({ received: true });
  } catch (error) {
    if (error.message?.startsWith("WEBHOOK_SIGNATURE_FAILED")) {
      return res.status(400).send(error.message.replace("WEBHOOK_SIGNATURE_FAILED: ", ""));
    }
    logger.error('stripeWebhook error:', error);
    res.status(500).json({ success: false, message: "Webhook error" });
  }
};

export {
  placeOrder,
  verifyOrder,
  userOrders,
  listOrders,
  updateStatus,
  refundOrder,
  cancelOrder,
  reorderOrder,
  submitFeedback,
  stripeWebhook,
  getOrderDetails,
};
