import api from "../config/axios.js";
import { createContext, useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { connectSocket, disconnectSocket } from "../config/socket.js";
import { resolveSocketUserId } from "../utils/jwt.js";
import { localDateKey } from "../utils/dateKey.js";

export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  const [cartItems, setCartItems] = useState({});
  const url = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userName, setUserName] = useState(localStorage.getItem("userName") || "");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("userEmail") || "");
  const [food_list, setFoodList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [promoData, setPromoData] = useState({ code: "", discountType: "", discountValue: 0 });
  const [calorieHistory, setCalorieHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bb_calorie_history") || "{}");
    } catch {
      return {};
    }
  });
  /** Days the user opened the calorie page (local YYYY-MM-DD), for “days tracked” when cart was empty. */
  const [calorieVisitDays, setCalorieVisitDays] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("bb_calorie_visit_days") || "[]");
      return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Notification Logic ────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get("/api/notifications");
      if (response.data.success) {
        setNotifications(response.data.data);
        const unread = response.data.data.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [token]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      const response = await api.post("/api/notifications/read-all");
      if (response.data.success) {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  // ── Food & Cart Logic ─────────────────────────────────────────────────────────

  const fetchFoodList = useCallback(async () => {
    const response = await api.get("/api/food/list");
    if (response.data.success) {
      setFoodList(response.data.data);
    }
  }, []);

  // ── Socket: one connection, join user room from JWT or localStorage ───────────

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    const uid = resolveSocketUserId();
    const socket = connectSocket(uid);
    if (!socket) return;

    const onOrderStatus = (data) => {
      if (data?.status) {
        toast.info(`Order: ${data.status}`, {
          theme: "dark",
          toastId: `order_${data.orderId}_${data.status}`,
        });
      }
      fetchNotifications();
    };

    const onOrderUpdate = (data) => {
      if (data?.status) {
        toast.info(`Order: ${data.status}`, {
          theme: "dark",
          toastId: `order_${data.orderId}_${data.status}`,
        });
      }
      fetchNotifications();
    };

    const onPaymentConfirmed = (data) => {
      toast.success("Payment Confirmed! Tracking your order...", { theme: "dark" });
      fetchNotifications();
      window.location.href = `/track/${data.orderId}`;
    };

    const onOrderCompleted = () => {
      fetchNotifications();
    };

    const onNewNotification = () => {
      fetchNotifications();
    };

    const onNewFoodAdded = (data) => {
      toast.info(`New dish added: ${data?.name || "Fresh item"}`, { theme: "dark" });
      fetchFoodList();
      fetchNotifications();
    };

    socket.on("order_status_update", onOrderStatus);
    socket.on("order_update", onOrderUpdate);
    socket.on("payment_confirmed", onPaymentConfirmed);
    socket.on("order_completed", onOrderCompleted);
    socket.on("new_notification", onNewNotification);
    socket.on("new_food_added", onNewFoodAdded);

    return () => {
      socket.off("order_status_update", onOrderStatus);
      socket.off("order_update", onOrderUpdate);
      socket.off("payment_confirmed", onPaymentConfirmed);
      socket.off("order_completed", onOrderCompleted);
      socket.off("new_notification", onNewNotification);
      socket.off("new_food_added", onNewFoodAdded);
    };
  }, [token, fetchNotifications, fetchFoodList]);

  const recordTodayCartCalories = useCallback((total) => {
    const today = localDateKey();
    setCalorieHistory((prev) => ({
      ...prev,
      [today]: Math.max(Number(prev[today]) || 0, Number(total) || 0),
    }));
  }, []);

  const recordCaloriePageVisit = useCallback(() => {
    const k = localDateKey();
    setCalorieVisitDays((prev) => (prev.includes(k) ? prev : [...prev, k]));
  }, []);

  const getCurrentMonthCalories = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const dailyData = {};
    let totalCalories = 0;
    Object.entries(calorieHistory).forEach(([dateStr, cal]) => {
      const d = new Date(`${dateStr}T12:00:00`);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const n = Number(cal) || 0;
        dailyData[dateStr] = n;
        totalCalories += n;
      }
    });
    const visitInMonth = calorieVisitDays.filter((dateStr) => {
      const d = new Date(`${dateStr}T12:00:00`);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    const daysWithKcalKeys = Object.keys(dailyData).filter((k) => (Number(dailyData[k]) || 0) > 0);
    const daysWithKcal = daysWithKcalKeys.length;
    const daysTracked = new Set([...daysWithKcalKeys, ...visitInMonth]).size;
    return { dailyData, totalCalories, daysTracked, daysWithKcal };
  }, [calorieHistory, calorieVisitDays]);

  useEffect(() => {
    try {
      localStorage.setItem("bb_calorie_history", JSON.stringify(calorieHistory));
    } catch {
      /* ignore quota */
    }
  }, [calorieHistory]);

  useEffect(() => {
    try {
      localStorage.setItem("bb_calorie_visit_days", JSON.stringify(calorieVisitDays));
    } catch {
      /* ignore quota */
    }
  }, [calorieVisitDays]);

  const loadCartData = async (token) => {
    try {
      const response = await api.get("/api/cart/get"); // Changed to GET as per standard
      if (response.data.success) {
        setCartItems(response.data.cartData || {});
      }
    } catch (error) {
      console.error("Error loading cart:", error);
    }
  };

  const addToCart = async (itemId) => {
    setCartItems((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    toast.success("Added to cart", { toastId: "cart-add" });
    if (token) {
      await api.post("/api/cart/add", { itemId });
    }
  };

  const removeFromCart = async (itemId) => {
    setCartItems((prev) => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) newCart[itemId]--;
      else delete newCart[itemId];
      return newCart;
    });
    if (token) {
      await api.post("/api/cart/remove", { itemId });
    }
  };

  const replaceCart = async (newCart) => {
    setCartItems(newCart || {});
    if (!token) return;
    try {
      await api.post("/api/cart/set", { cartItems: newCart || {} });
    } catch (error) {
      console.error("Error replacing cart:", error);
    }
  };

  const getTotalCartAmount = () => {
    return Object.keys(cartItems).reduce((total, itemId) => {
      const item = food_list.find(f => f._id === itemId);
      return total + (item ? item.price * cartItems[itemId] : 0);
    }, 0);
  };

  const getTotalCalories = () => {
    return Object.keys(cartItems).reduce((total, itemId) => {
      const item = food_list.find(f => f._id === itemId);
      return total + (item ? (item.calorie || 0) * cartItems[itemId] : 0);
    }, 0);
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      await fetchFoodList();
      if (token) {
        await loadCartData(token);
        await fetchNotifications();
      }
    }
    init();
  }, [token, fetchNotifications, fetchFoodList]);

  const contextValue = {
    food_list,
    cartItems,
    setCartItems,
    addToCart,
    removeFromCart,
    replaceCart,
    getTotalCartAmount,
    getTotalCalories,
    fetchFoodList,
    url,
    token,
    setToken,
    userName,
    setUserName,
    userEmail,
    setUserEmail,
    notifications,
    unreadCount,
    fetchNotifications,
    markAllRead,
    searchTerm,
    setSearchTerm,
    promoData,
    setPromoData,
    calorieHistory,
    recordTodayCartCalories,
    recordCaloriePageVisit,
    getCurrentMonthCalories,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreContextProvider;