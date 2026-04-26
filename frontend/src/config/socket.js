import { io } from "socket.io-client";
import { resolveSocketUserId } from "../utils/jwt.js";

let socket = null;

// Track the rider ID so we can re-join rider_room on reconnect.
let _riderRoomId = null;

function emitJoinUser(uid) {
  if (socket?.connected && uid) {
    socket.emit("join_user", uid);
  }
}

/**
 * Register the current session as a rider.
 * Call this from the Rider Dashboard — it persists across reconnects.
 * @param {string} riderId
 */
export function joinRiderRoom(riderId) {
  _riderRoomId = riderId;
  if (socket?.connected && riderId) {
    socket.emit("join_rider", riderId);
    console.log("[Socket] Joined rider_room as rider:", riderId);
  }
}

/**
 * Tear down rider room membership (call on unmount / logout).
 */
export function leaveRiderRoom() {
  _riderRoomId = null;
}

/**
 * Single shared Socket.IO client. Re-joins user room (and rider room if applicable)
 * on every connect / reconnect automatically.
 */
export function connectSocket(userId) {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const uid = resolveSocketUserId(userId);
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  if (socket?.connected) {
    emitJoinUser(uid);
    // Re-join rider room if this tab is a rider session
    if (_riderRoomId) joinRiderRoom(_riderRoomId);
    return socket;
  }

  if (!socket) {
    socket = io(apiUrl, {
      auth: { token },
    });
    socket.on("connect", () => {
      const id = resolveSocketUserId();
      emitJoinUser(id);
      // Re-join rider room automatically on every (re)connect
      if (_riderRoomId) {
        socket.emit("join_rider", _riderRoomId);
        console.log("[Socket] Reconnected — re-joined rider_room as rider:", _riderRoomId);
      }
      if (id) {
        console.log("[Socket] Connected; joined user room:", id);
      }
    });
  }

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  _riderRoomId = null;
}
