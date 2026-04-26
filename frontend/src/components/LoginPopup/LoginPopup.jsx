import React, { useContext, useState } from "react";
import "./LoginPopup.css";
import { assets } from "../../assets/frontend_assets/assets";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const LoginPopup = ({ setShowLogin, initialState = "Login" }) => {
  const { url, setToken, setUserName, setUserEmail } = useContext(StoreContext);
  const navigate = useNavigate();
  const [currentState, setCurrentState] = useState(initialState);
  const [show2FA, setShow2FA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  useEffect(() => {
    setCurrentState(initialState || "Login");
  }, [initialState]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onLogin = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Step 2: Verify 2FA code
    if (show2FA) {
      try {
        const response = await axios.post(url + "/api/user/verify-2fa", {
          email: data.email,
          code: otpCode,
        });

        if (response.data.success) {
          setToken(response.data.token);
          setUserName(response.data.name || "");
          setUserEmail(data.email || "");
          localStorage.setItem("token", response.data.token);
          localStorage.setItem("userName", response.data.name || "");
          localStorage.setItem("userEmail", data.email || "");
          localStorage.setItem("userId", response.data.userId || "");
          localStorage.setItem("role", response.data.role || "user");
          if (response.data.refreshToken) {
            localStorage.setItem("refreshToken", response.data.refreshToken);
          }
          toast.success("🎉 Login Successful!");
          setShowLogin(false);
          // Role-based redirect
          const role = response.data.role;
          if (role === "rider") {
            navigate("/rider-dashboard");
          } else if (role === "admin") {
            toast.info("Admin panel is available at http://localhost:5174");
          } else {
            navigate("/");
          }
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        toast.error("Verification failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Forgot Password Flow
    if (currentState === "Forgot Password") {
      try {
        const response = await axios.post(url + "/api/user/forgot-password", { email: data.email });
        if (response.data.success) {
          toast.success(response.data.message);
          setCurrentState("Login");
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Step 1: Login or Register
    let newUrl = url;
    if (currentState === "Login") {
      newUrl += "/api/user/login";
    } else {
      newUrl += "/api/user/register";
    }

    try {
      const payload =
        currentState === "Sign Up"
          ? data
          : { email: data.email, password: data.password };
      const response = await axios.post(newUrl, payload);

      if (response.data.success) {
        // Check if 2FA is required (login flow)
        if (response.data.requires2FA) {
          setShow2FA(true);
          toast.info("📧 Verification code sent to your email!");
          return;
        }

        // Direct token (login skip-2FA or registration flow)
        setToken(response.data.token);
        setUserName(response.data.name || "");
        setUserEmail(response.data.email || data.email || "");
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userName", response.data.name || "");
        localStorage.setItem("userEmail", response.data.email || data.email || "");
        localStorage.setItem("userId", response.data.userId || "");
        localStorage.setItem("role", response.data.role || "user");
        if (response.data.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        const successMessage =
          currentState === "Login"
            ? "🎉 Login Successful!"
            : "🎉 Account Created Successfully!";
        toast.success(successMessage);
        setShowLogin(false);
        // Role-based redirect
        const role = response.data.role;
        if (role === "rider") {
          navigate("/rider-dashboard");
        } else if (role === "admin") {
          toast.info("Admin panel is available at http://localhost:5174");
        } else {
          navigate("/");
        }
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-popup">
      <form onSubmit={onLogin} className="login-popup-container">
        <div className="login-popup-title">
          <h2>{show2FA ? "🔐 Verify Your Identity" : currentState}</h2>
          <img
            onClick={() => setShowLogin(false)}
            src={assets.cross_icon}
            alt=""
          />
        </div>

        {show2FA ? (
          /* 2FA OTP Input */
          <div className="login-popup-inputs">
            <p className="otp-message">
              We sent a 6-digit verification code to <strong>{data.email}</strong>
            </p>
            <input
              name="otp"
              onChange={(e) => setOtpCode(e.target.value)}
              value={otpCode}
              type="text"
              placeholder="Enter 6-digit code"
              maxLength={6}
              pattern="[0-9]{6}"
              className="otp-input"
              autoFocus
              required
            />
            <p className="otp-hint">
              Check your email inbox or spam folder. Code expires in 10 minutes.
            </p>
          </div>
        ) : (
          /* Normal Login/Register Inputs */
          <div className="login-popup-inputs">
            {currentState === "Login" || currentState === "Forgot Password" ? (
              <></>
            ) : (
              <>
                <input
                  name="name"
                  onChange={onChangeHandler}
                  value={data.name}
                  type="text"
                  placeholder="Your name"
                  required
                />
                <select
                  name="role"
                  onChange={onChangeHandler}
                  value={data.role}
                  required
                >
                  <option value="user">Customer</option>
                  <option value="rider">Rider</option>
                </select>
              </>
            )}
            <input
              name="email"
              onChange={onChangeHandler}
              value={data.email}
              type="email"
              placeholder="Your email"
              required
            />
            {currentState !== "Forgot Password" && (
              <input
                name="password"
                onChange={onChangeHandler}
                value={data.password}
                type="password"
                placeholder="Your password"
                required
              />
            )}
          </div>
        )}

        <button type="submit" disabled={isSubmitting}>
          {show2FA
            ? (isSubmitting ? "Verifying..." : "Verify & Login")
            : currentState === "Forgot Password"
              ? (isSubmitting ? "Sending..." : "Send Reset Link")
              : currentState === "Sign Up"
                ? (isSubmitting ? "Creating..." : "Create Account")
                : (isSubmitting ? "Logging in..." : "Login")}
        </button>

        {!show2FA && (
          <>
            {currentState !== "Forgot Password" && (
              <div className="login-popup-condition">
                <input type="checkbox" required />
                <p>By continuing, I agree to the terms of use & privacy policy.</p>
              </div>
            )}

            {currentState === "Login" ? (
              <>
                <p>
                  Create a new account?{" "}
                  <span onClick={() => !isSubmitting && setCurrentState("Sign Up")}>Click here</span>
                </p>
                <p>
                  Forgot your password?{" "}
                  <span onClick={() => !isSubmitting && setCurrentState("Forgot Password")}>Reset it here</span>
                </p>
              </>
            ) : currentState === "Sign Up" ? (
              <p>
                Already have an account?{" "}
                <span onClick={() => !isSubmitting && setCurrentState("Login")}>Login here</span>
              </p>
            ) : (
              <p>
                Remembered your password?{" "}
                <span onClick={() => !isSubmitting && setCurrentState("Login")}>Login here</span>
              </p>
            )}
          </>
        )}

        {show2FA && (
          <p>
            Didn't receive the code?{" "}
            <span
              onClick={() => {
                setShow2FA(false);
                setOtpCode("");
                toast.info("Please login again to resend the code.");
              }}
            >
              Try again
            </span>
          </p>
        )}
      </form>
    </div>
  );
};

export default LoginPopup;
