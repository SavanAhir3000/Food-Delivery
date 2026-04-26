import React, { useState, useEffect, useContext } from "react";
import "./Orders.css"; // kept as fallback
import axios from "axios";
import { toast } from "react-toastify";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { io as socketIO } from "socket.io-client";
import {
  FiPackage, FiTruck, FiCheckCircle, FiRefreshCw,
  FiDollarSign, FiSearch, FiXCircle, FiUser, FiMapPin,
  FiPhone, FiAlertCircle,
} from "react-icons/fi";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  "Food Processing": { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", dot: "bg-orange-400", icon: FiPackage },
  "Out for Delivery": { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30", dot: "bg-blue-400", icon: FiTruck },
  "Ready for Pickup": { color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30", dot: "bg-yellow-400", icon: FiTruck },
  "Delivered": { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "bg-emerald-400", icon: FiCheckCircle },
  "Refunded": { color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/30", dot: "bg-purple-400", icon: FiRefreshCw },
  "Cancelled": { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", dot: "bg-red-400", icon: FiXCircle },
};

const getMeta = (status) => STATUS_CONFIG[status] || STATUS_CONFIG["Food Processing"];
const normalizeStatus = (status) => (status === "Out for delivery" ? "Out for Delivery" : status);

// ── Live ping badge ────────────────────────────────────────────────────────────
const LiveBadge = () => (
  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
    LIVE
  </span>
);

// ── Order Row Card ─────────────────────────────────────────────────────────────
const OrderCard = ({ order, onStatusChange, onRefund, isHighlighted }) => {
  const meta = getMeta(order.status);
  const StatusIcon = meta.icon;
  const orderDate = new Date(order.date).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className={[
      "rounded-2xl border p-5 transition-all duration-500 animate-fade-in",
      "bg-brand-card border-brand-border hover:border-brand-accent/30",
      isHighlighted ? "ring-2 ring-brand-accent/50 shadow-glow-accent" : "",
    ].join(" ")}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${meta.bg} ${meta.border}`}>
            <StatusIcon className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div>
            <p className="text-xs font-mono text-brand-muted">#{String(order._id).slice(-8).toUpperCase()}</p>
            <p className="text-xs text-slate-500 mt-0.5">{orderDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Payment badge */}
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${order.payment
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
              : "text-yellow-400 bg-yellow-500/10 border-yellow-500/25"
            }`}>
            {order.payment ? "✓ Paid" : "⏳ Pending"}
          </span>
          {order.paymentMethod === "COD" && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25">
              💵 Collect Cash
            </span>
          )}
          {/* Status pill */}
          <span className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border ${meta.bg} ${meta.border} ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Left: Items ── */}
        <div className="rounded-xl bg-white/4 border border-brand-border p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted mb-2.5">
            Items · {order.items.length}
          </p>
          <div className="space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-slate-300 font-medium">{item.name}</span>
                <span className="text-xs text-brand-muted">×{item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-brand-border flex items-center justify-between">
            <span className="text-xs text-brand-muted">Total</span>
            <span className="font-bold text-brand-accent">₹{order.amount}</span>
          </div>
        </div>

        {/* ── Right: Customer & Controls ── */}
        <div className="flex flex-col gap-3">
          {/* Customer */}
          <div className="rounded-xl bg-white/4 border border-brand-border p-3.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted mb-1">Customer</p>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <FiUser className="w-3.5 h-3.5 text-brand-muted shrink-0" />
              {order.address.firstName} {order.address.lastName}
            </div>
            <div className="flex items-start gap-2 text-xs text-brand-muted">
              <FiMapPin className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{order.address.street}, {order.address.city}, {order.address.state}</span>
            </div>
            {order.address.phone && (
              <div className="flex items-center gap-2 text-xs text-brand-muted">
                <FiPhone className="w-3 h-3 shrink-0" />
                {order.address.phone}
              </div>
            )}
          </div>

          {/* Feedback (matches API: feedback_rating / feedback_comment on order row) */}
          {order?.feedback_rating != null && Number(order.feedback_rating) > 0 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Customer feedback</p>
              <p className="text-sm text-slate-200 font-semibold">
                Rating: <span className="text-brand-accent">{order.feedback_rating}/5</span>
              </p>
              {order.feedback_comment && (
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  {order.feedback_comment}
                </p>
              )}
              {order.feedback_given_at && (
                <p className="text-[10px] text-brand-muted">
                  {new Date(order.feedback_given_at).toLocaleString("en-IN", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}

          {/* Status selector — locked for terminal statuses */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Update Status</label>
            {["Delivered", "Cancelled", "Refunded"].includes(order.status) ? (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${meta.bg} ${meta.border}`}>
                <StatusIcon className={`w-4 h-4 ${meta.color}`} />
                <span className={`text-sm font-semibold ${meta.color}`}>{order.status} — Locked</span>
              </div>
            ) : (
              <select
                value={order.status}
                onChange={(e) => onStatusChange(e, order._id)}
                className="w-full px-3 py-2.5 bg-brand-cardHover border border-brand-border rounded-xl text-white text-sm outline-none focus:border-brand-accent transition-all duration-200 cursor-pointer"
              >
                <option value="Food Processing">Food Processing</option>
                <option value="Ready for Pickup">Ready for Pickup</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
              </select>
            )}
          </div>

          {/* Refund / Refunded info */}
          {order.payment &&
            !order.isRefunded &&
            (order.status === "Food Processing" ||
              order.status === "Ready for Pickup" ||
              order.status === "Out for Delivery") && (
              <button
                onClick={() => onRefund(order._id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 active:scale-95"
              >
                <FiDollarSign className="w-3.5 h-3.5" />
                Issue Refund
              </button>
            )}
          {order.isRefunded && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
              <FiAlertCircle className="text-purple-400 w-4 h-4 shrink-0" />
              <p className="text-xs font-semibold text-purple-400">Refunded · ₹{order.refundAmount}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Orders Page ────────────────────────────────────────────────────────────────
const Orders = ({ url }) => {
  const navigate = useNavigate();
  const { token, admin } = useContext(StoreContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [newOrderIds, setNewOrderIds] = useState(new Set());
  const [refundModalOrderId, setRefundModalOrderId] = useState(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const [sentimentData, setSentimentData] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  const fetchAllOrder = async () => {
    const res = await axios.get(`${url}/api/order/list`, { headers: { token } });
    if (res.data.success) {
      setOrders((res.data.data || []).map((o) => ({ ...o, status: normalizeStatus(o.status) })));
    }
    setLoading(false);
  };

  const fetchSentiment = async () => {
    setSentimentLoading(true);
    try {
      const res = await axios.get(`${url}/api/ai/sentiment-report`, { headers: { token } });
      if (res.data.success) setSentimentData(res.data.data);
      else toast.error(res.data.message || "Could not load AI insights");
    } catch {
      toast.error("AI insights request failed");
    } finally {
      setSentimentLoading(false);
    }
  };

  const statusHandler = async (e, orderId) => {
    const res = await axios.post(
      `${url}/api/order/status`,
      { orderId, status: e.target.value },
      { headers: { token } }
    );
    if (res.data.success) { toast.success(res.data.message); await fetchAllOrder(); }
    else toast.error(res.data.message);
  };

  const refundHandler = async (orderId) => {
    setRefundModalOrderId(orderId);
  };

  const confirmRefund = async () => {
    if (!refundModalOrderId || isRefunding) return;
    setIsRefunding(true);
    try {
      const res = await axios.post(`${url}/api/order/refund`, { orderId: refundModalOrderId, reason: "Requested by Admin" }, { headers: { token } });
      if (res.data.success) { toast.success("Refund processed!"); await fetchAllOrder(); }
      else toast.error(res.data.message || "Refund failed");
    } catch {
      toast.error("Error during refund");
    } finally {
      setRefundModalOrderId(null);
      setIsRefunding(false);
    }
  };

  useEffect(() => {
    if (!admin && !token) { toast.error("Please login first"); navigate("/"); }
    fetchAllOrder();
  }, []);

  // Socket.io — real-time new orders + status updates from rider
  useEffect(() => {
    if (!token) return;
    // Backend socket requires JWT token in handshake auth.
    const socket = socketIO(url, { auth: { token } });
    socket.emit("join_admin");

    socket.on("new_order", (newOrder) => {
      toast.success("🆕 New order received!", { toastId: `new_order_${newOrder.orderId}` });
      setNewOrderIds(prev => new Set([...prev, String(newOrder.orderId)]));
      fetchAllOrder();
    });
    socket.on("connect_error", (err) => {
      console.error("Admin socket connect_error:", err?.message || err);
    });

    // Real-time sync: rider advances status → admin sees it immediately
    socket.on("order_status_update", ({ orderId, status }) => {
      const normalized = normalizeStatus(status);
      setOrders(prev =>
        prev.map(o =>
          String(o._id) === String(orderId) ? { ...o, status: normalized } : o
        )
      );
    });

    // Real-time sync: user cancellation/refund style updates sent as order_update
    socket.on("order_update", ({ orderId, status }) => {
      const normalized = normalizeStatus(status);
      setOrders((prev) => {
        const hasOrder = prev.some((o) => String(o._id) === String(orderId));
        if (!hasOrder) {
          fetchAllOrder();
          return prev;
        }
        return prev.map((o) =>
          String(o._id) === String(orderId) ? { ...o, status: normalized } : o
        );
      });
    });

    // Real-time sync: feedback submitted by customer
    socket.on("order_feedback_update", ({ orderId, feedback_rating, feedback_comment, feedback_given_at }) => {
      setOrders((prev) => {
        const hasOrder = prev.some((o) => String(o._id) === String(orderId));
        if (!hasOrder) {
          fetchAllOrder();
          return prev;
        }
        return prev.map((o) =>
          String(o._id) === String(orderId)
            ? { ...o, feedback_rating, feedback_comment, feedback_given_at }
            : o
        );
      });
    });

    return () => socket.disconnect();
  }, [token, url]);

  const filterTabs = ["All", "Food Processing", "Ready for Pickup", "Out for Delivery", "Delivered", "Refunded", "Cancelled"];

  const filtered = orders.filter(o => {
    const name = `${o.address?.firstName || ""} ${o.address?.lastName || ""}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) ||
      String(o._id).includes(search) ||
      o.items.some(item => item.name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: orders.length,
    processing: orders.filter(o => o.status === "Food Processing").length,
    delivered: orders.filter(o => o.status === "Delivered").length,
    revenue: orders.filter(o => o.payment).reduce((s, o) => s + o.amount, 0),
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-brand-dark min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-5xl mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FiPackage className="text-brand-accent" />
              Order Management
              <LiveBadge />
            </h1>
            <p className="text-sm text-brand-muted mt-1">{orders.length} total orders</p>
          </div>
          <button onClick={fetchAllOrder} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-brand-muted border border-brand-border hover:border-brand-accent hover:text-brand-accent transition-all duration-200">
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* ── AI Sentiment Insights card ── */}
        <div className="rounded-2xl border border-brand-border bg-brand-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <h2 className="text-base font-bold text-white">AI Customer Insights</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent font-semibold">GROQ</span>
            </div>
            <button
              onClick={fetchSentiment}
              disabled={sentimentLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent transition-all disabled:opacity-50"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${sentimentLoading ? "animate-spin" : ""}`} />
              {sentimentLoading ? "Analysing…" : sentimentData ? "Refresh" : "Generate Report"}
            </button>
          </div>

          {!sentimentData && !sentimentLoading && (
            <p className="text-sm text-brand-muted text-center py-4">
              Click "Generate Report" to analyse customer feedback with AI.
            </p>
          )}

          {sentimentLoading && (
            <div className="flex items-center gap-2 text-sm text-brand-muted py-4">
              <span className="animate-pulse">✨</span>
              <span>GROQ is analysing customer feedback…</span>
            </div>
          )}

          {sentimentData && !sentimentLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Overall */}
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {sentimentData.overall === "Positive" ? "😊" : sentimentData.overall === "Negative" ? "😟" : "😐"}
                </span>
                <div>
                  <p className="text-[10px] text-brand-muted uppercase tracking-wider">Overall Sentiment</p>
                  <p className={`font-bold text-lg ${sentimentData.overall === "Positive" ? "text-emerald-400" :
                      sentimentData.overall === "Negative" ? "text-red-400" : "text-yellow-400"
                    }`}>{sentimentData.overall}</p>
                </div>
              </div>

              {/* Summary */}
              {sentimentData.summary && (
                <p className="text-sm text-slate-300 leading-relaxed col-span-full border-t border-brand-border pt-3">
                  {sentimentData.summary}
                </p>
              )}

              {/* Praise */}
              {sentimentData.praisePoints?.length > 0 && (
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-2">👍 What customers love</p>
                  <ul className="space-y-1">
                    {sentimentData.praisePoints.map((p, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Complaints */}
              {sentimentData.complaints?.length > 0 && (
                <div>
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-2">👎 Areas to improve</p>
                  <ul className="space-y-1">
                    {sentimentData.complaints.map((c, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">•</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Orders", value: stats.total, color: "text-brand-accent", bg: "bg-brand-accent/15", icon: FiPackage },
            { label: "Processing", value: stats.processing, color: "text-orange-400", bg: "bg-orange-500/15", icon: FiTruck },
            { label: "Delivered", value: stats.delivered, color: "text-emerald-400", bg: "bg-emerald-500/15", icon: FiCheckCircle },
            { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, color: "text-yellow-400", bg: "bg-yellow-500/15", icon: FiDollarSign },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className="rounded-xl p-4 bg-brand-card border border-brand-border flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
                <p className="text-[10px] text-brand-muted mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter strip */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted w-4 h-4" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer, order ID, or item…"
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-brand-border rounded-xl text-white placeholder-brand-muted text-sm outline-none focus:border-brand-accent transition-all"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {filterTabs.map(tab => (
            <button
              key={tab} onClick={() => setStatusFilter(tab)}
              className={[
                "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 transition-all duration-200",
                statusFilter === tab
                  ? "bg-brand-accent text-white border-brand-accent shadow-glow-accent"
                  : "text-brand-muted border-brand-border hover:border-brand-accent hover:text-brand-accent",
              ].join(" ")}
            >
              {tab}
              <span className="ml-1.5 opacity-60">
                {tab === "All" ? orders.length : orders.filter(o => o.status === tab).length}
              </span>
            </button>
          ))}
        </div>

        {/* Orders grid */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-brand-card border border-brand-border p-5 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-brand-border" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-brand-border rounded w-1/3" />
                    <div className="h-3 bg-brand-border rounded w-1/4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 bg-brand-border rounded-xl" />
                  <div className="h-24 bg-brand-border rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl bg-brand-card border border-brand-border">
            <FiPackage className="w-12 h-12 mx-auto text-brand-muted mb-4 opacity-40" />
            <p className="text-lg font-semibold text-white">No orders found</p>
            <p className="text-sm text-brand-muted mt-1">
              {search ? `No results for "${search}"` : "No orders match this filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order, i) => (
              <OrderCard
                key={order._id || i}
                order={order}
                onStatusChange={statusHandler}
                onRefund={refundHandler}
                isHighlighted={newOrderIds.has(String(order._id))}
              />
            ))}
          </div>
        )}
      </div>

      {refundModalOrderId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-5">
            <h3 className="text-lg font-bold text-white">Issue full refund?</h3>
            <p className="mt-2 text-sm text-brand-muted">
              This will refund the Stripe payment and mark the order as <strong className="text-purple-300">Refunded</strong>.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setRefundModalOrderId(null)}
                disabled={isRefunding}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmRefund}
                disabled={isRefunding}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60"
              >
                {isRefunding ? "Refunding..." : "Yes, Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
