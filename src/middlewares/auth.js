// src/middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Extract access token from:
 * 1) HttpOnly cookie: accessToken
 * 2) Authorization header: Bearer <token>
 */
function getAccessToken(req) {
  // Cookie first (recommended)
  let token = req.cookies?.accessToken;

  // Header fallback (useful for Postman/testing)
  if (!token) {
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7);
  }

  return token;
}

/**
 * ✅ Require logged-in user (Authentication)
 * - Verifies JWT access token
 * - Loads fresh user from DB
 * - Attaches to req.user
 */
async function requireAuth(req, res, next) {
  try {
    const token = getAccessToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
      // expired/invalid token
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!payload?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Always fetch latest user (role updates apply instantly)
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch (err) {
    // generic fallback (don’t leak internals)
    return res.status(401).json({ message: "Unauthorized" });
  }
}

/**
 * ✅ Role Based Access Control (Authorization)
 * Usage:
 *  - requireRole("admin")
 *  - requireRole(["admin", "manager"])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    // If dev forgot to put requireAuth before requireRole
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}

/**
 * ✅ Backward-compatible helper if you already used requireAdmin in routes
 */
const requireAdmin = requireRole("admin");

module.exports = {
  getAccessToken,
  requireAuth,
  requireRole,
  requireAdmin,
};
