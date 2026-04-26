import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import "./MyOrders.css"; // kept as fallback — not deleted
import { StoreContext } from "../../context/StoreContext";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";
import { assets } from "../../assets/frontend_assets/assets";
import { connectSocket } from "../../config/socket";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  FiPackage, FiTruck, FiCheckCircle, FiClock, FiRefreshCw,
  FiXCircle, FiShoppingCart, FiAlertTriangle,
} from "react-icons/fi";

// ── Status Pipeline Config ─────────────────────────────────────────────────────
const STATUS_PIPELINE = [
  { key: "Food Processing", label: "Processing",   icon: FiPackage,     color: "text-orange-400", bg: "bg-orange-500/20",  border: "border-orange-500/30" },
  { key: "Ready for Pickup", label: "Ready for Pickup", icon: FiClock,  color: "text-yellow-400", bg: "bg-yellow-500/20",  border: "border-yellow-500/30" },
  { key: "Out for Delivery", label: "Out for Delivery", icon: FiTruck,  color: "text-blue-400",   bg: "bg-blue-500/20",    border: "border-blue-500/30"   },
  { key: "Delivered",        label: "Delivered",   icon: FiCheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
];

const STATUS_META = {
  "Food Processing": { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", dot: "bg-orange-400" },
  "Ready for Pickup": { color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  "Out for Delivery": { color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30", dot: "bg-blue-400" },
  "Delivered":        { color: "text-emerald-400", bg: "bg-emerald-500/15",border: "border-emerald-500/30", dot: "bg-emerald-400" },
  "Cancelled":        { color: "text-red-400",     bg: "bg-red-500/15",    border: "border-red-500/30", dot: "bg-red-400" },
  "Refunded":         { color: "text-purple-400",  bg: "bg-purple-500/15", border: "border-purple-500/30", dot: "bg-purple-400" },
};
const normalizeStatus = (status) => {
  const value = String(status || "").trim();
  const lower = value.toLowerCase();
  if (lower === "out for delivery" || lower === "out for delivery ") return "Out for Delivery";
  if (lower === "ready for pickup") return "Ready for Pickup";
  if (lower === "food processing") return "Food Processing";
  if (lower === "delivered") return "Delivered";
  if (lower === "cancelled") return "Cancelled";
  if (lower === "refunded") return "Refunded";
  return value;
};

// ── Countdown Timer ────────────────────────────────────────────────────────────
const CountdownTimer = ({ estimatedDelivery }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!estimatedDelivery) return;
    const calc = () => {
      const diff = new Date(estimatedDelivery) - new Date();
      if (diff > 0) {
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        return `${m}m ${s}s`;
      }
      return "Arriving shortly";
    };
    setTimeLeft(calc());
    const id = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [estimatedDelivery]);

  return <span className="font-bold tabular-nums">{timeLeft}</span>;
};

// ── Skeleton Card ──────────────────────────────────────────────────────────────
const SkeletonCard = ({ dark }) => (
  <div className={`rounded-2xl p-6 border ${dark ? "bg-brand-card border-brand-border" : "bg-white border-brand-lightBorder"} animate-pulse`}>
    <div className="flex items-center gap-4 mb-4">
      <div className={`w-10 h-10 rounded-full ${dark ? "bg-brand-border" : "bg-slate-200"}`} />
      <div className="flex-1 space-y-2">
        <div className={`h-3 rounded ${dark ? "bg-brand-border" : "bg-slate-200"} w-3/4`} />
        <div className={`h-3 rounded ${dark ? "bg-brand-border" : "bg-slate-200"} w-1/2`} />
      </div>
    </div>
    <div className={`h-8 rounded-xl ${dark ? "bg-brand-border" : "bg-slate-200"} mb-4`} />
    <div className="flex gap-2">
      {[1, 2, 3].map(i => <div key={i} className={`flex-1 h-12 rounded-xl ${dark ? "bg-brand-border" : "bg-slate-200"}`} />)}
    </div>
  </div>
);

// ── Progress Bar ───────────────────────────────────────────────────────────────
const StatusProgressBar = ({ order }) => {
  const pipelineIdx = STATUS_PIPELINE.findIndex(s => s.key === order.status);
  const isFailed = order.status === "Cancelled" || order.status === "Refunded";
  const progressPct = isFailed ? 0 : pipelineIdx >= 0 ? ((pipelineIdx + 1) / STATUS_PIPELINE.length) * 100 : 0;

  return (
    <div className="w-full mt-1">
      <div className="flex items-center justify-between text-xs text-brand-muted mb-1.5">
        <span>Order Progress</span>
        <span className={isFailed ? "text-red-400" : "text-brand-accent"}>{Math.round(progressPct)}%</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPct}%`,
            background: isFailed
              ? "linear-gradient(90deg, #ef4444, #dc2626)"
              : "linear-gradient(90deg, #e94560, #f97316)",
          }}
        />
      </div>
    </div>
  );
};

// ── Status Step Node ───────────────────────────────────────────────────────────
const StepNodes = ({ order }) => {
  const currentIdx = STATUS_PIPELINE.findIndex(s => s.key === order.status);
  const isFailed = order.status === "Cancelled" || order.status === "Refunded";

  if (isFailed) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <FiXCircle className="text-red-400 w-5 h-5 shrink-0" />
        <span className="text-red-400 font-semibold text-sm">Order {order.status}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 w-full">
      {STATUS_PIPELINE.map((step, i) => {
        const Icon = step.icon;
        const isDone    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isPending = i > currentIdx;

        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={[
                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-400 shrink-0",
                isDone    ? "bg-brand-accent border-brand-accent text-white"                             : "",
                isCurrent ? "border-brand-accent text-brand-accent animate-pulse-ring"                  : "",
                isPending ? "border-slate-600 dark:border-slate-700 text-slate-500 dark:text-slate-600" : "",
              ].join(" ")}>
                {isDone
                  ? <FiCheckCircle className="w-4 h-4" />
                  : <Icon className="w-4 h-4" />
                }
              </div>
              <span className={[
                "text-center mt-1.5 text-[10px] leading-tight font-medium hidden sm:block",
                isDone || isCurrent ? "text-brand-accent" : "text-slate-500 dark:text-slate-600",
              ].join(" ")}>
                {step.label}
              </span>
            </div>
            {i < STATUS_PIPELINE.length - 1 && (
              <div className={[
                "flex-1 h-0.5 mx-1 rounded-full transition-all duration-500 mt-[-14px] sm:mt-[-18px]",
                isDone ? "bg-brand-accent" : "bg-slate-700/50 dark:bg-slate-800",
              ].join(" ")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── AI Order Summary ──────────────────────────────────────────────────────────
const AiSummary = ({ orderId, url, token, dark }) => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchSummary = async () => {
    if (fetched || loading) return;
    setLoading(true);
    setFetched(true);
    try {
      const res = await axios.get(`${url}/api/ai/order-summary/${orderId}`, {
        headers: { token },
      });
      if (res.data.success) setSummary(res.data.data?.summary || "");
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (!summary && !loading && !fetched) {
    return (
      <button
        onClick={fetchSummary}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
          dark
            ? "border-white/10 text-slate-400 hover:text-brand-accent hover:border-brand-accent/30 bg-white/3"
            : "border-slate-200 text-slate-400 hover:text-brand-accent hover:border-brand-accent/30 bg-white"
        }`}
      >
        ✨ AI Summary
      </button>
    );
  }

  if (loading) {
    return <p className="text-xs text-brand-muted animate-pulse">✨ Generating summary…</p>;
  }

  if (!summary) return null;

  return (
    <div className={`rounded-xl px-4 py-3 border text-sm leading-relaxed ${
      dark
        ? "bg-brand-accent/5 border-brand-accent/20 text-slate-300"
        : "bg-brand-accent/5 border-brand-accent/20 text-slate-700"
    }`}>
      <span className="text-brand-accent font-semibold text-xs uppercase tracking-wider block mb-1">✨ AI Summary</span>
      {summary}
    </div>
  );
};

// ── Order Card ─────────────────────────────────────────────────────────────────
const OrderCard = ({ order, url, token, onCancel, onReorder, onGiveFeedback, dark, isReordering }) => {
  const meta = STATUS_META[order.status] || STATUS_META["Food Processing"];
  const hasFeedback = Number(order?.feedback_rating || 0) > 0;
  const isActive =
    order.status === "Food Processing" ||
    order.status === "Ready for Pickup" ||
    order.status === "Out for Delivery";
  const formattedDate = new Date(order.date).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const formattedTime = new Date(order.date).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={[
      "rounded-2xl border p-5 sm:p-6 flex flex-col gap-4 animate-slide-up",
      "transition-all duration-300",
      "hover:shadow-card-dark hover:-translate-y-0.5",
      dark
        ? "bg-brand-card border-brand-border"
        : "bg-white border-brand-lightBorder shadow-card-light",
    ].join(" ")}>

      {/* ── Header Row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg} border ${meta.border} shrink-0`}>
            <FiPackage className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div>
            <p className={`text-xs font-mono ${dark ? "text-brand-muted" : "text-slate-400"}`}>
              #{String(order._id).slice(-8).toUpperCase()}
            </p>
            <p className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
              {formattedDate} · {formattedTime}
            </p>
          </div>
        </div>

        {/* Status pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shrink-0 ${meta.bg} ${meta.border} ${meta.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {order.status}
        </div>
      </div>

      {/* ── AI Summary ── */}
      <AiSummary orderId={order._id} url={url} token={token} dark={dark} />

      {/* ── Items Summary ── */}
      <div className={`rounded-xl px-4 py-3 ${dark ? "bg-white/5" : "bg-slate-50"}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${dark ? "text-brand-muted" : "text-slate-400"}`}>
          Items · {order.items.length}
        </p>
        <p className={`text-sm leading-relaxed ${dark ? "text-slate-300" : "text-slate-700"}`}>
          {order.items.map((item, i) => (
            <span key={i}>
              <span className="font-medium">{item.name}</span>
              <span className={`text-xs ${dark ? "text-brand-muted" : "text-slate-400"}`}> ×{item.quantity}</span>
              {i < order.items.length - 1 && <span className={`mx-1 ${dark ? "text-brand-border" : "text-slate-300"}`}>·</span>}
            </span>
          ))}
        </p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
          <span className={`text-xs ${dark ? "text-brand-muted" : "text-slate-400"}`}>Total Amount</span>
          <span className="text-brand-accent font-bold text-base">₹{order.amount}</span>
        </div>
      </div>

      {/* ── ETA Banner (active orders only) ── */}
      {isActive && order.estimatedDelivery && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <FiClock className="text-emerald-400 w-4 h-4 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-emerald-300 font-medium">
              Arriving in: <CountdownTimer estimatedDelivery={order.estimatedDelivery} />
            </p>
            <p className="text-[10px] text-emerald-500 mt-0.5">
              ETA {new Date(order.estimatedDelivery).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}

      {/* ── Status Progress Bar ── */}
      <StatusProgressBar order={order} />

      {/* ── Status Step Nodes ── */}
      <StepNodes order={order} />

      {/* ── Payment Badge ── */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${
          order.payment
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
            : "text-yellow-400 bg-yellow-500/10 border-yellow-500/25"
        }`}>
          {order.payment ? "✓ Paid" : "⏳ Pending"}
        </span>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium border ${dark ? "text-slate-400 bg-white/5 border-white/10" : "text-slate-500 bg-slate-100 border-slate-200"}`}>
          {order.paymentMethod || "Stripe"}
        </span>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-3 flex-wrap pt-1">
        {order.status === "Food Processing" && (
          <button
            onClick={() => onCancel(order._id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-400 text-sm font-semibold border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 active:scale-95"
          >
            <FiXCircle className="w-4 h-4" />
            Cancel Order
          </button>
        )}

        {order.status === "Delivered" && !hasFeedback && (
          <button
            onClick={() => onGiveFeedback(order)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 active:scale-95 ${
              dark
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            }`}
          >
            ⭐ Give Feedback
          </button>
        )}

        {order.status === "Delivered" && hasFeedback && (
          <button
            disabled
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border opacity-60 cursor-not-allowed ${
              dark
                ? "text-slate-300 border-white/10 bg-white/5"
                : "text-slate-500 border-slate-200 bg-slate-50"
            }`}
          >
            ⭐ Feedback Given
          </button>
        )}

        <button
          onClick={() => onReorder(order._id, order.items)}
          disabled={isReordering}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg,#e94560,#f97316)", color: "white", boxShadow: "0 4px 15px rgba(233,69,96,0.3)" }}
        >
          <FiShoppingCart className="w-4 h-4" />
          {isReordering ? "Processing..." : "Order Again"}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const MyOrders = () => {
  const { url, token, replaceCart } = useContext(StoreContext);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const navigate = useNavigate();
  // Token stored separately so OrderCard subcomponent can use it
  const storedToken = token || localStorage.getItem("token") || "";

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [cancelModalOrderId, setCancelModalOrderId] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reorderingOrderId, setReorderingOrderId] = useState(null);

  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const tabsContainerRef = useRef(null);

  const openFeedbackIfPending = useCallback(
    async (orderId, maybeOrder = null) => {
      const local = maybeOrder || data.find((o) => String(o._id) === String(orderId));
      const hasLocalFeedback = Number(local?.feedback_rating || 0) > 0;
      if (local && local.status === "Delivered" && !hasLocalFeedback) {
        setFeedbackOrder(local);
        setFeedbackRating(5);
        setFeedbackComment("");
        setActiveFilter("Delivered");
        return;
      }

      // Fallback: fetch latest order details when order is outside loaded page slice.
      try {
        const res = await axios.get(`${url}/api/order/${orderId}`, { headers: { token } });
        const fetched = res?.data?.data;
        const status = normalizeStatus(fetched?.status);
        const hasFeedback = Number(fetched?.feedback_rating || 0) > 0;
        if (res?.data?.success && status === "Delivered" && !hasFeedback) {
          const normalized = { ...fetched, status };
          setData((prev) => {
            const exists = prev.some((o) => String(o._id) === String(orderId));
            if (exists) {
              return prev.map((o) => (String(o._id) === String(orderId) ? normalized : o));
            }
            return [normalized, ...prev];
          });
          setFeedbackOrder(normalized);
          setFeedbackRating(5);
          setFeedbackComment("");
          setActiveFilter("Delivered");
        }
      } catch {
        // no-op: realtime status will still be visible
      }
    },
    [data, token, url]
  );

  const fetchOrders = useCallback(async (pageNum = 1) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await axios.get(
        `${url}/api/order/userorders?page=${pageNum}&limit=5`,
        { headers: { token } }
      );
      if (res.data.success) {
        const normalized = (res.data.data || []).map((o) => ({ ...o, status: normalizeStatus(o.status) }));
        setData((prev) => (pageNum === 1 ? normalized : [...prev, ...normalized]));
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  }, [token, url]);

  useEffect(() => {
    if (token) {
      setPage(1);
      fetchOrders(1);
    }
  }, [token, fetchOrders]);

  const handleRealtimeStatusUpdate = useCallback(
    (update) => {
      const status = normalizeStatus(update?.status);
      const orderId = update?.orderId;
      if (!status || orderId == null) return;

      let deliveredOrderWithoutFeedback = null;
      setData((prev) => {
        const has = prev.some((o) => String(o._id) === String(orderId));
        if (!has) {
          fetchOrders(1);
          return prev;
        }
        return prev.map((o) => {
          if (String(o._id) !== String(orderId)) return o;
          const updatedOrder = { ...o, status };
          const hasFeedback = Number(updatedOrder?.feedback_rating || 0) > 0;
          if (status === "Delivered" && !hasFeedback) {
            deliveredOrderWithoutFeedback = updatedOrder;
          }
          return updatedOrder;
        });
      });

      if (status === "Out for Delivery") {
        setActiveFilter("Out for Delivery");
        setTimeout(() => {
          tabsContainerRef.current
            ?.querySelector('[data-status-tab="Out for Delivery"]')
            ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }, 50);
      }

      if (status === "Delivered") {
        openFeedbackIfPending(orderId, deliveredOrderWithoutFeedback);
      }
    },
    [fetchOrders, openFeedbackIfPending]
  );

  const handleRealtimeFeedbackUpdate = useCallback((update) => {
    const orderId = update?.orderId;
    if (orderId == null) return;

    setData((prev) =>
      prev.map((o) =>
        String(o._id) === String(orderId)
          ? {
              ...o,
              feedback_rating: update.feedback_rating,
              feedback_comment: update.feedback_comment,
              feedback_given_at: update.feedback_given_at,
            }
          : o
      )
    );
  }, []);

  // Shared socket from StoreContext path — same room as notifications
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket();
    if (!socket) return;

    socket.on("order_update", handleRealtimeStatusUpdate);
    socket.on("order_status_update", handleRealtimeStatusUpdate);
    socket.on("order_feedback_update", handleRealtimeFeedbackUpdate);

    const onErr = (err) => {
      console.error("Socket connect_error:", err?.message || err);
    };
    socket.on("connect_error", onErr);

    return () => {
      socket.off("order_update", handleRealtimeStatusUpdate);
      socket.off("order_status_update", handleRealtimeStatusUpdate);
      socket.off("order_feedback_update", handleRealtimeFeedbackUpdate);
      socket.off("connect_error", onErr);
    };
  }, [token, handleRealtimeStatusUpdate, handleRealtimeFeedbackUpdate]);

  const confirmCancel = async () => {
    if (!cancelModalOrderId || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await axios.post(
        `${url}/api/order/cancel`,
        { orderId: cancelModalOrderId },
        { headers: { token } }
      );
      if (res.data.success) { fetchOrders(1); }
      else toast.error(res.data.message);
    } catch {
      toast.error("Failed to cancel order");
    } finally {
      setCancelModalOrderId(null);
      setIsCancelling(false);
    }
  };

  const handleCancel = (orderId) => {
    setCancelModalOrderId(orderId);
  };

  const handleReorder = async (orderId, items) => {
    if (reorderingOrderId) return;
    setReorderingOrderId(orderId);
    try {
      const res = await axios.post(
        `${url}/api/order/reorder`,
        { orderId },
        { headers: { token } }
      );
      if (res.data.success && res.data.isCOD) {
        toast.success(res.data.message || "Order placed successfully via COD");
        fetchOrders(1);
        return;
      }
      if (res.data.success && res.data.session_url) {
        window.location.replace(res.data.session_url);
        return;
      }
      const newCart = {};
      items.forEach(item => { newCart[item._id] = item.quantity; });
      await replaceCart(newCart);
      toast.info("Items added again. Please proceed to payment.");
      navigate("/order");
    } catch {
      const newCart = {};
      items.forEach(item => { newCart[item._id] = item.quantity; });
      await replaceCart(newCart);
      toast.info("Items added again. Please proceed to payment.");
      navigate("/order");
    } finally {
      setReorderingOrderId(null);
    }
  };

  const openFeedback = (order) => {
    setFeedbackOrder(order);
    setFeedbackRating(5);
    setFeedbackComment("");
  };

  const submitFeedback = async () => {
    if (!feedbackOrder || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    try {
      const res = await axios.post(
        `${url}/api/order/feedback`,
        { orderId: feedbackOrder._id, rating: feedbackRating, comment: feedbackComment },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success("Thanks for your feedback!");
        const updated = res.data.data;
        setData(prev => prev.map(o => (o._id === updated._id ? updated : o)));
        setFeedbackOrder(null);
      } else {
        toast.error(res.data.message || "Feedback failed");
      }
    } catch (e) {
      toast.error("Feedback failed");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Filter tabs
  const filterTabs = ["All", "Food Processing", "Ready for Pickup", "Out for Delivery", "Delivered", "Cancelled"];
  const filteredData = activeFilter === "All"
    ? data
    : data.filter(o => o.status === activeFilter);

  // Stats bar
  const stats = {
    total: data.length,
    active: data.filter(
      (o) =>
        o.status === "Food Processing" ||
        o.status === "Ready for Pickup" ||
        o.status === "Out for Delivery"
    ).length,
    delivered: data.filter(o => o.status === "Delivered").length,
    cancelled: data.filter(o => o.status === "Cancelled").length,
  };

  return (
    <div className={`min-h-screen pt-8 pb-20 px-1 transition-colors duration-300 ${dark ? "bg-brand-dark text-white" : "bg-slate-50 text-slate-900"}`}>
      <div className="max-w-3xl mx-auto">

        {/* ── Page Header ── */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center">
              <FiPackage className="text-brand-accent w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>
              <p className={`text-sm mt-0.5 ${dark ? "text-brand-muted" : "text-slate-400"}`}>
                Track and manage your food deliveries
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        {data.length > 0 && (
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-fade-in`}>
            {[
              { label: "Total Orders", value: stats.total,     icon: FiPackage,     color: "text-brand-accent", bg: "bg-brand-accent/15" },
              { label: "Active",       value: stats.active,    icon: FiTruck,       color: "text-blue-400",     bg: "bg-blue-500/15"     },
              { label: "Delivered",    value: stats.delivered, icon: FiCheckCircle, color: "text-emerald-400",  bg: "bg-emerald-500/15"  },
              { label: "Cancelled",    value: stats.cancelled, icon: FiXCircle,     color: "text-red-400",      bg: "bg-red-500/15"      },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-xl p-3.5 border flex items-center gap-3 ${dark ? "bg-brand-card border-brand-border" : "bg-white border-brand-lightBorder shadow-sm"}`}>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
                  <p className={`text-[10px] mt-1 ${dark ? "text-brand-muted" : "text-slate-400"}`}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter Tabs ── */}
        {data.length > 0 && (
          <div
            ref={tabsContainerRef}
            className={`flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide`}
          >
            {filterTabs.map(tab => (
              <button
                key={tab}
                data-status-tab={tab}
                onClick={() => setActiveFilter(tab)}
                className={[
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0",
                  activeFilter === tab
                    ? "bg-brand-accent text-white border-brand-accent shadow-glow-accent"
                    : dark
                      ? "text-brand-muted border-brand-border hover:border-brand-accent hover:text-brand-accent"
                      : "text-slate-500 border-brand-lightBorder hover:border-brand-accent hover:text-brand-accent bg-white",
                ].join(" ")}
              >
                {tab}
                {tab !== "All" && <span className="ml-1.5 opacity-70">{data.filter(o => o.status === tab).length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* ── Orders List ── */}
        {isLoading && data.length === 0 ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} dark={dark} />)}
          </div>
        ) : !token ? (
          <div className={`text-center py-20 rounded-2xl border ${dark ? "bg-brand-card border-brand-border" : "bg-white border-brand-lightBorder"}`}>
            <FiAlertTriangle className="w-12 h-12 mx-auto text-brand-muted mb-4" />
            <p className="text-lg font-semibold mb-2">Please sign in</p>
            <p className={`text-sm ${dark ? "text-brand-muted" : "text-slate-400"}`}>Sign in to view your order history</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className={`text-center py-20 rounded-2xl border ${dark ? "bg-brand-card border-brand-border" : "bg-white border-brand-lightBorder"}`}>
            <FiPackage className="w-12 h-12 mx-auto text-brand-muted mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2">No orders yet</p>
            <p className={`text-sm ${dark ? "text-brand-muted" : "text-slate-400"}`}>
              {activeFilter === "All" ? "Order something delicious!" : `No ${activeFilter} orders`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredData.map((order, i) => (
              <OrderCard
                key={order._id || i}
                order={order}
                url={url}
                token={storedToken}
                onCancel={handleCancel}
                onReorder={handleReorder}
                onGiveFeedback={openFeedback}
                dark={dark}
                isReordering={String(reorderingOrderId) === String(order._id)}
              />
            ))}
          </div>
        )}

        {/* ── Load More ── */}
        {page < totalPages && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchOrders(next); }}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#e94560,#f97316)", color: "white" }}
            >
              <FiRefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Loading..." : "Load More Orders"}
            </button>
          </div>
        )}
      </div>

      {cancelModalOrderId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-5 ${dark ? "bg-brand-card border-brand-border" : "bg-white border-slate-200"}`}>
            <h3 className="text-lg font-bold">Cancel this order?</h3>
            <p className={`mt-2 text-sm ${dark ? "text-brand-muted" : "text-slate-500"}`}>
              Your order will be marked as <strong>Cancelled</strong>. If payment is already done, refund will be initiated automatically.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setCancelModalOrderId(null)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${dark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700"}`}
                disabled={isCancelling}
              >
                Keep Order
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60"
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-5 ${dark ? "bg-brand-card border-brand-border" : "bg-white border-slate-200"}`}>
            <h3 className="text-lg font-bold">Give Feedback</h3>
            <p className={`mt-1 text-sm ${dark ? "text-brand-muted" : "text-slate-500"}`}>
              Order #{String(feedbackOrder._id).slice(-8).toUpperCase()}
            </p>

            <div className="mt-4">
              <p className={`text-xs font-semibold uppercase tracking-wider ${dark ? "text-brand-muted" : "text-slate-400"}`}>Rating</p>
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFeedbackRating(n)}
                    className={`w-10 h-10 rounded-xl border text-lg font-bold transition-all ${
                      feedbackRating >= n
                        ? "bg-brand-accent text-white border-brand-accent"
                        : dark
                          ? "bg-white/5 text-brand-muted border-white/10 hover:border-brand-accent/40"
                          : "bg-slate-50 text-slate-400 border-slate-200 hover:border-brand-accent/40"
                    }`}
                    aria-label={`Rate ${n}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className={`text-xs font-semibold uppercase tracking-wider ${dark ? "text-brand-muted" : "text-slate-400"}`}>Comment</p>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={4}
                placeholder="Tell us what you liked (optional)"
                className={`mt-2 w-full px-3 py-2.5 rounded-xl border outline-none text-sm resize-none ${
                  dark
                    ? "bg-white/5 border-white/10 text-slate-200 placeholder:text-brand-muted focus:border-brand-accent/60"
                    : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-brand-accent/60"
                }`}
              />
              <p className={`mt-1 text-[10px] ${dark ? "text-brand-muted" : "text-slate-400"}`}>
                Max 500 characters
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setFeedbackOrder(null)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${dark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700"}`}
                disabled={isSubmittingFeedback}
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#e94560,#f97316)" }}
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;

