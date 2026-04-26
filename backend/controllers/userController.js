import {
  initiateLogin,
  completeTwoFA,
  registerNewUser,
  rotateTokens,
  logoutUserById,
  initiateForgotPassword,
  completePasswordReset,
  addUserAddress,
  removeUserAddress,
  getUserAddresses,
} from "../services/userService.js";
import { logger } from '../utils/logger.js';

const ERROR_MESSAGES = {
  USER_NOT_FOUND:            "User doesn't exist",
  INVALID_CREDENTIALS:       "Invalid credentials",
  NO_PENDING_CODE:           "No verification code pending. Please login again.",
  CODE_EXPIRED:              "Code expired. Please login again.",
  INVALID_CODE:              "Invalid verification code",
  USER_EXISTS:               "User already exists",
  NAME_REQUIRED:             "Name is required",
  INVALID_EMAIL:             "Please enter a valid email address",
  PASSWORD_TOO_SHORT:        "Password must be at least 8 characters",
  INVALID_ROLE:              "Please select a valid role",
  REGISTRATION_FAILED:       "Registration failed. Please try again.",
  NO_REFRESH_TOKEN:          "Refresh token is required",
  INVALID_REFRESH_TOKEN:     "Invalid or expired refresh token. Please login again.",
  TOKEN_REUSE_DETECTED:      "Token reuse detected. Please login again.",
  INVALID_OR_EXPIRED_TOKEN:  "Invalid or expired reset token",
};

const handleServiceError = (res, error, fallback = "An unexpected error occurred") => {
  // Always log the raw error so issues are diagnosable in server logs
  if (!ERROR_MESSAGES[error.message]) {
    logger.error('[userController] Unhandled service error:', error);
  }
  const msg = ERROR_MESSAGES[error.message] || fallback;
  res.json({ success: false, message: msg });
};

// ── Controllers ────────────────────────────────────────────────────────────────

const loginUser = async (req, res) => {
  try {
    const result = await initiateLogin(req.body.email, req.body.password);
    if (result.skip2FA) {
      // SMTP not configured — tokens already issued, login complete
      return res.json({ success: true, ...result, message: "Login successful" });
    }
    // Normal 2FA flow — OTP sent to email
    res.json({ success: true, requires2FA: true, message: "Verification code sent to your email" });
  } catch (error) {
    handleServiceError(res, error, "Login error");
  }
};

const verify2FA = async (req, res) => {
  try {
    const result = await completeTwoFA(req.body.email, req.body.code);
    res.json({ success: true, ...result, message: "Login successful" });
  } catch (error) {
    handleServiceError(res, error, "Verification error");
  }
};

const registerUser = async (req, res) => {
  try {
    const result = await registerNewUser(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handleServiceError(res, error, "Registration error");
  }
};

const refreshTokenHandler = async (req, res) => {
  try {
    const result = await rotateTokens(req.body.refreshToken);
    res.json({ success: true, ...result });
  } catch (error) {
    handleServiceError(res, error, "Token refresh error");
  }
};

const logoutUser = async (req, res) => {
  try {
    await logoutUserById(req.body.userId);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.json({ success: false, message: "Error logging out" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    await initiateForgotPassword(req.body.email);
    res.json({ success: true, message: "Password reset link sent to email" });
  } catch (error) {
    handleServiceError(res, error, "Could not send reset email");
  }
};

const resetPassword = async (req, res) => {
  try {
    await completePasswordReset(req.body.token, req.body.password);
    res.json({ success: true, message: "Password reset successful. Please log in." });
  } catch (error) {
    handleServiceError(res, error, "Error resetting password");
  }
};

const addAddress = async (req, res) => {
  try {
    const address = await addUserAddress(req.body.userId, req.body.address);
    res.json({ success: true, message: "Address added successfully", address });
  } catch (error) {
    res.json({ success: false, message: "Error adding address" });
  }
};

const removeAddress = async (req, res) => {
  try {
    await removeUserAddress(req.body.userId, req.params.addressId);
    res.json({ success: true, message: "Address removed successfully" });
  } catch (error) {
    res.json({ success: false, message: "Error removing address" });
  }
};

const getAddresses = async (req, res) => {
  try {
    const addresses = await getUserAddresses(req.body.userId);
    res.json({ success: true, addresses });
  } catch (error) {
    res.json({ success: false, message: "Error fetching addresses" });
  }
};

export {
  loginUser,
  registerUser,
  verify2FA,
  refreshTokenHandler,
  logoutUser,
  forgotPassword,
  resetPassword,
  addAddress,
  removeAddress,
  getAddresses,
};
