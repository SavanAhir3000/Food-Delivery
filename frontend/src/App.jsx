import { useState, useEffect } from "react";
import Navbar from "./components/Navbar/Navbar";
import { Route, Routes, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import Cart from "./pages/Cart/Cart";
import PlaceOrder from "./pages/PlaceOrder/PlaceOrder";
import Footer from "./components/Footer/Footer";
import LoginPopup from "./components/LoginPopup/LoginPopup";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Verify from "./pages/Verify/Verify";
import MyOrders from "./pages/MyOrders/MyOrders";
import Calorie from "./pages/Calorie/Calorie";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import RiderDashboard from "./pages/RiderDashboard/RiderDashboard";
import Deliveries from "./pages/Deliveries/Deliveries";
import Earnings from "./pages/Earnings/Earnings";
import Track from "./pages/Track/Track";
import Profile from "./pages/Profile/Profile";
import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
import AiChatbot from "./components/AiChatbot/AiChatbot";
import ProtectedRiderRoute from "./components/ProtectedRiderRoute/ProtectedRiderRoute";

const App = () => {
  const [showLoginState, setShowLoginState] = useState(null);

  // Network Offline Handler
  useEffect(() => {
    const handleOffline = () => {
      toast.error("You are offline. Please check your connection.", {
        position: "top-center",
        autoClose: false, // Keep it visible until they reconnect
        toastId: "offline-warning", // Prevent duplicate toasts
      });
    };

    const handleOnline = () => {
      toast.dismiss("offline-warning");
      toast.success("Connection restored!", {
        position: "top-center",
        autoClose: 3000,
      });
    };

    // Listen for events
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Initial check (in case they load the app already offline from cache)
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <>
      {showLoginState ? (
        <LoginPopup
          setShowLogin={setShowLoginState}
          initialState={showLoginState}
        />
      ) : (
        <></>
      )}
      <div className="app">
        <ToastContainer
          position="top-center"
          autoClose={2500}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss={false}
          draggable
          pauseOnHover
          limit={3}
          theme="colored"
        />
        <Navbar setShowLogin={setShowLoginState} />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/order" element={<PlaceOrder />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/myorders" element={<MyOrders />} />
            <Route path="/calorie" element={<Calorie />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/rider-dashboard" element={<ProtectedRiderRoute><RiderDashboard /></ProtectedRiderRoute>} />
            <Route path="/rider" element={<Navigate to="/rider-dashboard" replace />} />
            <Route path="/deliveries" element={<ProtectedRiderRoute><Deliveries /></ProtectedRiderRoute>} />
            <Route path="/earnings" element={<ProtectedRiderRoute><Earnings /></ProtectedRiderRoute>} />
            <Route path="/track/:orderId" element={<Track />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <Footer />
      <AiChatbot />
    </>
  );
};

export default App;
