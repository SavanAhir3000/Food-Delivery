import React, { useContext, useState } from "react";
import "./Navbar.css"; // kept as fallback — not deleted
import { assets } from "../../assets/frontend_assets/assets";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { useTheme } from "../../context/ThemeContext";
import { toast } from "react-toastify";
import { FaChartBar } from "react-icons/fa";
import {
  FiSun, FiMoon, FiLogOut, FiShoppingBag, FiBarChart2,
  FiSearch, FiX, FiUser, FiShoppingCart, FiTruck, FiBell,
  FiDollarSign, FiClock, FiPackage,
} from "react-icons/fi";
import { useRef, useEffect } from "react";

const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const Navbar = ({ setShowLogin, showLoginState }) => {
  const [menu, setMenu] = useState("home");
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  const { 
    token, setToken, searchTerm, setSearchTerm, 
    userName, setUserName, userEmail, setUserEmail,
    notifications, unreadCount, markAllRead, cartItems
  } = useContext(StoreContext);
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };

  const navigateHomeAndScroll = (targetId = "hero") => {
    if (location.pathname === "/") {
      if (!scrollToSection(targetId)) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      window.history.replaceState(null, "", `/#${targetId}`);
      return;
    }

    navigate("/");
    setTimeout(() => {
      if (!scrollToSection(targetId)) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      window.history.replaceState(null, "", `/#${targetId}`);
    }, 120);
  };

  const handleHomeClick = (e) => {
    e.preventDefault();
    setMenu("home");
    setSearchTerm("");
    setShowSearch(false);
    navigateHomeAndScroll("hero");
  };

  const handleMenuClick = (e) => {
    e.preventDefault();
    setMenu("menu");
    navigateHomeAndScroll("explore-menu");
  };

  // Role detection: localStorage is the primary source (set explicitly on login).
  // JWT decode is the fallback for cases where localStorage was cleared mid-session.
  const storedRole = (localStorage.getItem("role") || "").toLowerCase();
  let jwtRole = "user";
  if (token) {
    const payload = decodeJwtPayload(token);
    jwtRole = (payload?.role || "user").toLowerCase();
  }
  const isRiderUser = storedRole === "rider" || jwtRole === "rider";

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Close stale profile dropdown when auth/session state changes.
    setShowProfile(false);
  }, [token]);

  const cartCount = Object.values(cartItems || {}).reduce(
    (sum, qty) => sum + (Number(qty) || 0),
    0
  );

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    setToken("");
    setUserName("");
    setUserEmail("");
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <nav className={[
      "sticky top-0 z-50 w-full transition-all duration-300",
      // Glassmorphism: blurred backdrop
      dark
        ? "bg-brand-dark/80 border-b border-brand-border backdrop-blur-md"
        : "bg-white/80 border-b border-brand-lightBorder backdrop-blur-md",
    ].join(" ")}>
      <div className="max-w-[1400px] mx-auto px-[2.5%] flex items-center justify-between h-16">

        {/* ── Logo ── */}
        <Link to="/" onClick={handleHomeClick} className="shrink-0">
          <img
            src={assets.logo}
            alt="BiteBlitz"
            className={`w-32 sm:w-36 transition-transform duration-200 hover:scale-105 ${dark ? "bg-white rounded-xl px-3 py-1" : "mix-blend-multiply"}`}
          />
        </Link>

        {/* ── Nav Links ── */}
        <ul className="hidden sm:flex items-center gap-6 text-sm font-medium">
          {!isRiderUser && (
            // ── Customer nav links ──
            [
              { label: "Home",    to: "/",             key: "home" },
              { label: "Menu",    href: "/#explore-menu", key: "menu" },
              { label: "Contact", href: "#footer",      key: "contact-us" },
            ].map(({ label, to, href, key }) => {
              const isActive = menu === key;
              const cls = [
                "relative pb-0.5 transition-colors duration-200 capitalize",
                isActive
                  ? "text-brand-accent"
                  : dark
                    ? "text-slate-300 hover:text-brand-accent"
                    : "text-slate-600 hover:text-brand-accent",
              ].join(" ");

              return to ? (
                <li key={key}>
                  <Link to={to} onClick={key === "home" ? handleHomeClick : () => setMenu(key)} className={cls}>
                    {label}
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-0 w-full h-0.5 rounded-full bg-brand-accent" />
                    )}
                  </Link>
                </li>
              ) : (
                <li key={key}>
                  <a
                    href={href}
                    onClick={key === "menu" ? handleMenuClick : (e) => {
                      e.preventDefault();
                      setMenu(key);
                      if (key === "contact-us") {
                        navigateHomeAndScroll("footer");
                      }
                    }}
                    className={cls}
                  >
                    {label}
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-0 w-full h-0.5 rounded-full bg-brand-accent" />
                    )}
                  </a>
                </li>
              );
            })
          )}
        </ul>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-3">

          {/* Search — hidden for riders (irrelevant on delivery dashboard) */}
          {!isRiderUser && (
            <div className={[
              "flex items-center gap-2 rounded-full transition-all duration-300 overflow-hidden",
              showSearch
                ? dark
                  ? "bg-brand-card border border-brand-border px-3 py-1.5"
                  : "bg-slate-100 border border-brand-lightBorder px-3 py-1.5"
                : "px-0",
            ].join(" ")}>
              <button
                onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchTerm(""); }}
                className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${dark ? "text-slate-300 hover:text-brand-accent hover:bg-brand-card" : "text-slate-500 hover:text-brand-accent hover:bg-slate-100"}`}
              >
                {showSearch ? <FiX className="w-4 h-4" /> : <FiSearch className="w-4 h-4" />}
              </button>
              {showSearch && (
                <input
                  type="text"
                  placeholder="Search food…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                  className={`w-36 sm:w-44 text-sm bg-transparent outline-none ${dark ? "text-white placeholder-slate-500" : "text-slate-800 placeholder-slate-400"}`}
                />
              )}
            </div>
          )}

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={[
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
              dark
                ? "text-yellow-400 hover:bg-yellow-400/10"
                : "text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {dark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>

          {/* Cart — hidden for riders */}
          {!isRiderUser && (
            <Link to="/cart" className="relative">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 ${dark ? "text-slate-300 hover:text-brand-accent hover:bg-brand-card" : "text-slate-600 hover:text-brand-accent hover:bg-slate-100"}`}>
                <FiShoppingCart className="w-4 h-4" />
              </div>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-brand-accent rounded-full flex items-center justify-center text-[9px] text-white font-bold px-1 animate-pulse-ring">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {/* Notifications */}
          {token && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 ${dark ? "text-slate-300 hover:text-brand-accent hover:bg-brand-card" : "text-slate-600 hover:text-brand-accent hover:bg-slate-100"}`}
              >
                <FiBell className="w-4 h-4" />
              </button>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold px-1 animate-pulse">
                  {unreadCount}
                </span>
              )}
              
              {showNotifications && (
                <div className={`absolute top-10 right-0 w-72 max-h-96 overflow-y-auto glass rounded-xl shadow-2xl z-50 p-2 fade-in`}>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-muted p-2 border-b border-brand-border mb-2">Notifications</h4>
                  {notifications.length === 0 ? (
                    <p className="text-center py-6 text-brand-muted text-sm">No notifications yet</p>
                  ) : (
                    notifications.map((n, idx) => (
                      <div key={idx} className={`p-3 rounded-lg mb-1 transition-colors ${n.is_read ? 'opacity-60' : 'bg-white/5'}`}>
                        <p className="text-sm text-brand-light">{n.message}</p>
                        <span className="text-[10px] text-brand-muted">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Auth */}
          {!token ? (
            <div className="flex items-center gap-2 sm:gap-3 transition-opacity duration-300">
              <button
                onClick={() => { setShowProfile(false); setShowLogin("Login"); }}
                disabled={Boolean(showLoginState)}
                className={`hidden sm:flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-transparent border border-white/20 transition-colors duration-200 hover:border-brand-accent ${dark ? "text-white" : "text-slate-800 border-slate-300 hover:text-brand-accent"}`}
              >
                Login
              </button>
              <button
                onClick={() => { setShowProfile(false); setShowLogin("Sign Up"); }}
                disabled={Boolean(showLoginState)}
                className="flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-accent transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-[0_4px_14px_rgba(233,69,96,0.4)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="relative" ref={profileRef}>
              {/* Avatar trigger (State-based onClick for mobile-first responsiveness) */}
              <button
                onClick={() => setShowProfile(!showProfile)}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 ${showProfile ? (dark ? "bg-brand-accent/20" : "bg-brand-accent/10") : "hover:bg-brand-accent/10"}`}
              >
                <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-[0_2px_10px_rgba(233,69,96,0.3)]">
                  {userName ? userName[0].toUpperCase() : <FiUser className="w-4 h-4" />}
                </div>
                {userName && (
                  <span className={`text-sm font-semibold hidden md:block ${dark ? "text-slate-200" : "text-slate-700"}`}>
                    {userName}
                  </span>
                )}
              </button>

              {/* Dropdown (Glassmorphism + Dynamic State visibility) */}
              <div className={[
                "absolute right-0 top-full mt-3 w-56 rounded-2xl border shadow-2xl py-2 transition-all duration-300 z-50",
                showProfile
                  ? "opacity-100 translate-y-0 pointer-events-auto scale-100"
                  : "opacity-0 translate-y-2 pointer-events-none scale-95",
                dark
                  ? "bg-brand-dark/90 border-brand-border backdrop-blur-xl"
                  : "bg-white/95 border-slate-200 backdrop-blur-xl",
              ].join(" ")}>
                {/* User info header */}
                {userName && (
                  <div className={`px-4 py-3 border-b rounded-t-2xl flex flex-col justify-center ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-slate-50"}`}>
                    <p className="text-sm font-bold truncate text-brand-accent">{userName}</p>
                    {userEmail && (
                      <p className={`text-xs truncate mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{userEmail}</p>
                    )}
                  </div>
                )}

                {(isRiderUser ? [
                  // ── Rider-only dropdown items ──
                  { icon: FiTruck,       label: "Rider Dashboard",  action: () => navigate("/rider-dashboard") },
                  { icon: FiDollarSign,  label: "My Earnings",      action: () => navigate("/earnings") },
                  { icon: FiClock,       label: "Delivery History", action: () => navigate("/deliveries") },
                  { icon: FiUser,        label: "My Profile",       action: () => navigate("/profile") },
                ] : [
                  // ── Customer-only dropdown items ──
                  { icon: FiShoppingBag, label: "My Orders",        action: () => navigate("/myorders") },
                  { icon: FiBarChart2,   label: "Calorie Tracker",  action: () => navigate("/calorie") },
                  { icon: FiUser,        label: "My Profile",       action: () => navigate("/profile") },
                ]).map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={() => { action(); setShowProfile(false); }}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
                      dark
                        ? "text-slate-300 hover:text-brand-accent hover:bg-brand-accent/10"
                        : "text-slate-600 hover:text-brand-accent hover:bg-brand-accent/5",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4 opacity-70" />
                    {label}
                  </button>
                ))}

                <div className={`mx-4 my-1 border-t ${dark ? "border-brand-border" : "border-brand-lightBorder"}`} />

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-150"
                >
                  <FiLogOut className="w-4 h-4 opacity-70" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
