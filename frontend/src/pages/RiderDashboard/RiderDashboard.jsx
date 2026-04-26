import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../config/axios.js';
import { StoreContext } from '../../context/StoreContext.jsx';
import { connectSocket, joinRiderRoom, leaveRiderRoom } from '../../config/socket.js';
import { toast } from 'react-toastify';
import './RiderDashboard.css';

const RiderDashboard = () => {
  const { token, userName } = useContext(StoreContext);
  const [activeOrder, setActiveOrder] = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveOrder = async () => {
    try {
      const res = await api.get('/api/rider/active');
      if (res.data.success) setActiveOrder(res.data.data);
    } catch (err) {
      console.error("Error fetching active order:", err);
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const res = await api.get('/api/rider/available');
      if (res.data.success) setAvailableOrders(res.data.data);
    } catch (err) {
      console.error("Error fetching available orders:", err);
    }
  };

  const init = async () => {
    setLoading(true);
    await Promise.all([fetchActiveOrder(), fetchAvailableOrders()]);
    setLoading(false);
  };

  useEffect(() => {
    init();

    const userId = localStorage.getItem("userId");
    const socket = connectSocket(userId);
    joinRiderRoom(userId);

    // 'food_ready' — emitted by orderService when admin sets status → 'Ready for Pickup'
    socket.on('food_ready', (order) => {
      toast.info("🛵 New order ready for pickup!", { theme: "dark" });
      fetchAvailableOrders();
    });

    // 'new_order_available' — defensive alias
    socket.on('new_order_available', () => {
      fetchAvailableOrders();
    });

    // 'order_claimed' — another rider claimed an order; remove it from the pool instantly
    socket.on('order_claimed', ({ orderId }) => {
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
    });

    socket.on('order_completed', () => {
      setActiveOrder(null);
      fetchAvailableOrders();
    });

    // ── Real-time sync: admin or rider advances status ──
    socket.on('order_status_update', (payload) => {
      setActiveOrder(prev => {
        if (!prev) return prev;
        if (String(prev.id) === String(payload.orderId)) {
          if (payload.status === 'Delivered' || payload.status === 'Cancelled') {
            fetchAvailableOrders();
            return null;
          }
          return { ...prev, status: payload.status };
        }
        return prev;
      });
      // Refresh pool too (in case admin updated something)
      fetchAvailableOrders();
    });

    return () => {
      socket.off('food_ready');
      socket.off('new_order_available');
      socket.off('order_claimed');
      socket.off('order_completed');
      socket.off('order_status_update');
      leaveRiderRoom();
    };
  }, []);

  // Location tracking
  useEffect(() => {
    if (isSharingLocation) {
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            await api.post('/api/rider/location', {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });
          } catch (err) {
            console.error("Location update failed:", err);
          }
        },
        () => toast.error("Location access denied"),
        { enableHighAccuracy: true }
      );
      setWatchId(id);
    } else {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [isSharingLocation]);

  const handleClaim = async (orderId) => {
    // Double-guard: if rider already has an active order, block UI-side too
    if (activeOrder) {
      toast.warning("Complete your current delivery first!", { theme: "dark" });
      return;
    }
    try {
      const res = await api.post('/api/rider/claim', { orderId });
      if (res.data.success) {
        toast.success("Order claimed! 🛵");
        setActiveOrder(res.data.data);
        fetchAvailableOrders();
      } else {
        toast.error(res.data.message || "Failed to claim order");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to claim order");
    }
  };

  const handleAdvance = async () => {
    if (!activeOrder) return;
    try {
      const res = await api.post('/api/rider/advance', { orderId: activeOrder.id });
      if (res.data.success) {
        const updated = res.data.data;
        if (updated.status === 'Delivered') {
          toast.success("🎉 Delivery completed!");
          setActiveOrder(null);
          fetchAvailableOrders();
        } else {
          setActiveOrder(updated);
          toast.info(`Status updated: ${updated.status}`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  // ── Derive the correct action for the active order ──────────────────────
  const renderActiveOrderAction = (order) => {
    switch (order.status) {
      case 'Food Processing':
        return (
          <div className="waiting-state">
            <span className="waiting-spinner">⏳</span>
            <p>Waiting for restaurant to prepare the order…</p>
          </div>
        );
      case 'Ready for Pickup':
        return (
          <button className="btn-advance" onClick={handleAdvance}>
            ✅ Mark as Picked Up
          </button>
        );
      case 'Out for Delivery':
        return (
          <button className="btn-advance btn-advance--deliver" onClick={handleAdvance}>
            🏠 Mark as Delivered
          </button>
        );
      case 'Delivered':
        return (
          <button className="btn-advance" disabled>
            Delivered ✓
          </button>
        );
      default:
        return null;
    }
  };

  if (loading) return <div className="rider-loading">Initializing Rider Dashboard...</div>;

  return (
    <div className="rider-dashboard fade-in">
      <header className="rider-header">
        <div>
          <h1 className="font-display">Rider Portal</h1>
          <p className="rider-welcome">Welcome back, {userName}</p>
        </div>
        <div className="location-toggle glass">
          <span>Share Location</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={isSharingLocation}
              onChange={(e) => setIsSharingLocation(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </header>

      <main className="rider-content">
        {/* Active Order Section */}
        <section className="active-section">
          <h2 className="section-title">Active Task</h2>
          {activeOrder ? (
            <div className="active-card glass">
              <div className="active-badge">ACTIVE</div>
              <div className="active-main">
                <div className="active-info">
                  <h3>#{activeOrder.id.slice(-8).toUpperCase()}</h3>
                  <p className="status-tag">{activeOrder.status}</p>
                  <div className="address-box">
                    <strong>Delivery Address:</strong>
                    <p>{activeOrder.address?.street}, {activeOrder.address?.city}</p>
                  </div>
                </div>
                {renderActiveOrderAction(activeOrder)}
              </div>
            </div>
          ) : (
            <div className="empty-state glass">
              <p>No active delivery. Claim one from the pool below.</p>
            </div>
          )}
        </section>

        {/* Available Orders Section */}
        <section className="pool-section">
          <h2 className="section-title">
            Available Orders ({availableOrders.length})
            {activeOrder && (
              <span className="pool-locked-hint"> — Complete active delivery to claim</span>
            )}
          </h2>
          <div className="order-grid">
            {availableOrders.map(order => (
              <div key={order.id} className={`pool-card glass ${activeOrder ? 'pool-card--locked' : ''}`}>
                <div className="pool-header">
                  <span>{order.items?.length} Items</span>
                  <span className="pool-price">₹{order.amount}</span>
                </div>
                {/* Status badge — tells rider whether they can pick it up now */}
                <p className={`pool-status pool-status--${order.status === 'Ready for Pickup' ? 'ready' : 'processing'}`}>
                  {order.status === 'Ready for Pickup' ? '✅ Ready for Pickup' : '⏳ Still Preparing'}
                </p>
                <p className="pool-address">{order.address?.street}, {order.address?.city}</p>
                {activeOrder ? (
                  <button className="btn-claim btn-claim--disabled" disabled title="Complete your current delivery first">
                    🔒 Busy
                  </button>
                ) : order.status !== 'Ready for Pickup' ? (
                  <button className="btn-claim btn-claim--disabled" disabled title="Wait for restaurant to finish">
                    ⏳ Not Ready
                  </button>
                ) : (
                  <button className="btn-claim" onClick={() => handleClaim(order.id)}>
                    Claim Order
                  </button>
                )}
              </div>
            ))}
            {availableOrders.length === 0 && (
              <p className="no-orders">Waiting for new orders to be ready...</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default RiderDashboard;
