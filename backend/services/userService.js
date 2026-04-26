import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import crypto from "crypto";
import {
  generateOTP,
  send2FAEmail,
  sendPasswordResetEmail,
} from "../utils/emailService.js";
import insforge from "../config/insforge.js";
import { logger } from '../utils/logger.js';

// ── Token Helpers ──────────────────────────────────────────────────────────────

export const createAccessToken = (id, role) =>
  jwt.sign(
    { id, role },
    process.env.JWT_SECRET || "dev_jwt_secret_change_me",
    { expiresIn: "1d" }
  );

export const createRefreshToken = (id) => {
  const secret =
    process.env.JWT_REFRESH_SECRET ||
    (process.env.JWT_SECRET || "dev_jwt_secret_change_me") + "_refresh";
  return jwt.sign({ id }, secret, { expiresIn: "7d" });
};

// ── DB Helpers ─────────────────────────────────────────────────────────────────

const findUserByEmail = async (email) => {
  const { data, error } = await insforge.database
    .from("users")
    .select()
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

const findUserById = async (id) => {
  const { data, error } = await insforge.database
    .from("users")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

const updateUser = async (id, fields) => {
  const { data, error } = await insforge.database
    .from("users")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ── Service Functions ──────────────────────────────────────────────────────────

/**
 * Step 1 of login — validates credentials and dispatches the 2FA OTP email.
 * If SMTP is not configured, skips 2FA and returns tokens directly.
 */
export const initiateLogin = async (email, password) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("USER_NOT_FOUND");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("INVALID_CREDENTIALS");

  const twoFactorEnabled = process.env.CHECK_2FA_ENABLED === 'true';

  if (!twoFactorEnabled) {
    logger.warn(`⚠️  2FA disabled or SMTP not configured — bypassing for: ${email}`);
    const accessToken = createAccessToken(user.id, user.role);
    const refreshToken = createRefreshToken(user.id);
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await updateUser(user.id, { refresh_token: hashedRefresh });
    return { token: accessToken, refreshToken, role: user.role, name: user.name, userId: user.id, skip2FA: true };
  }

  const code = generateOTP();
  const hashedCode = await bcrypt.hash(code, 10);
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await updateUser(user.id, {
    two_factor_code: hashedCode,
    two_factor_expiry: expiry,
  });

  await send2FAEmail(email, code);
  return { requires2FA: true };
};

/**
 * Step 2 of login — validates the OTP and issues access + refresh tokens.
 */
export const completeTwoFA = async (email, code) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("USER_NOT_FOUND");

  if (!user.two_factor_code || !user.two_factor_expiry) {
    throw new Error("NO_PENDING_CODE");
  }

  if (new Date() > new Date(user.two_factor_expiry)) {
    await updateUser(user.id, {
      two_factor_code: null,
      two_factor_expiry: null,
    });
    throw new Error("CODE_EXPIRED");
  }

  const isValid = await bcrypt.compare(code, user.two_factor_code);
  if (!isValid) throw new Error("INVALID_CODE");

  const accessToken = createAccessToken(user.id, user.role);
  const refreshToken = createRefreshToken(user.id);
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);

  await updateUser(user.id, {
    two_factor_code: null,
    two_factor_expiry: null,
    refresh_token: hashedRefresh,
  });

  return { token: accessToken, refreshToken, role: user.role, name: user.name, userId: user.id };
};

/**
 * Register a new user. Issues tokens directly (no 2FA on first signup).
 */
export const registerNewUser = async ({ name, email, password, role }) => {
  // Validate BEFORE hitting the DB to surface clean error messages
  if (!name || !name.trim())              throw new Error("NAME_REQUIRED");
  if (!validator.isEmail(email))           throw new Error("INVALID_EMAIL");
  if (!password || password.length < 8)   throw new Error("PASSWORD_TOO_SHORT");
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const dbRole = normalizedRole === "customer" ? "user" : normalizedRole;
  if (!["user", "rider"].includes(dbRole)) throw new Error("INVALID_ROLE");

  const exists = await findUserByEmail(email);
  if (exists) throw new Error("USER_EXISTS");

  const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // insert() returns an ARRAY even for single-row inserts — take [0]
  const { data: rows, error } = await insforge.database
    .from("users")
    .insert({ name: name.trim(), email, password: hashedPassword, role: dbRole })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const newUser = rows;
  if (!newUser?.id) throw new Error("REGISTRATION_FAILED");

  const accessToken  = createAccessToken(newUser.id, newUser.role || "user");
  const refreshToken = createRefreshToken(newUser.id);
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);

  await updateUser(newUser.id, { refresh_token: hashedRefresh });

  return { token: accessToken, refreshToken, role: newUser.role || "user", name: newUser.name, userId: newUser.id };
};

/**
 * Rotate access + refresh tokens using a valid refresh token.
 */
export const rotateTokens = async (refreshToken) => {
  if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");

  const secret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh";
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, secret);
  } catch {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const user = await findUserById(decoded.id);
  if (!user || !user.refresh_token) throw new Error("INVALID_REFRESH_TOKEN");

  const isValid = await bcrypt.compare(refreshToken, user.refresh_token);
  if (!isValid) {
    await updateUser(user.id, { refresh_token: null });
    throw new Error("TOKEN_REUSE_DETECTED");
  }

  const newAccessToken = createAccessToken(user.id, user.role);
  const newRefreshToken = createRefreshToken(user.id);
  const hashedRefresh = await bcrypt.hash(newRefreshToken, 10);

  await updateUser(user.id, { refresh_token: hashedRefresh });

  return { token: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logout — clears the refresh token from the database.
 */
export const logoutUserById = async (userId) => {
  await updateUser(userId, { refresh_token: null });
};

/**
 * Initiate a password reset — generates a reset token and emails the link.
 */
export const initiateForgotPassword = async (email) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("USER_NOT_FOUND");

  const resetToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await updateUser(user.id, {
    reset_password_token: hashedToken,
    reset_password_expire: expiry,
  });

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
};

/**
 * Complete a password reset — validates the token and sets the new password.
 */
export const completePasswordReset = async (token, newPassword) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const { data: users, error } = await insforge.database
    .from("users")
    .select()
    .eq("reset_password_token", hashedToken)
    .gt("reset_password_expire", new Date().toISOString());

  if (error) throw new Error(error.message);
  const user = users?.[0];
  if (!user) throw new Error("INVALID_OR_EXPIRED_TOKEN");

  const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await updateUser(user.id, {
    password: hashedPassword,
    reset_password_token: null,
    reset_password_expire: null,
  });
};

/**
 * Add an address to a user's saved addresses.
 */
export const addUserAddress = async (userId, address) => {
  if (!address.id) {
    address.id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  const user = await findUserById(userId);
  const existingAddresses = Array.isArray(user?.addresses) ? user.addresses : [];
  await updateUser(userId, { addresses: [...existingAddresses, address] });
  return address;
};

/**
 * Remove a saved address by its ID.
 */
export const removeUserAddress = async (userId, addressId) => {
  const user = await findUserById(userId);
  const existingAddresses = Array.isArray(user?.addresses) ? user.addresses : [];
  const filtered = existingAddresses.filter((a) => a.id !== addressId);
  await updateUser(userId, { addresses: filtered });
};

/**
 * Fetch all saved addresses for a user.
 */
export const getUserAddresses = async (userId) => {
  const user = await findUserById(userId);
  return user?.addresses || [];
};
