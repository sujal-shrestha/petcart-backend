const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendOtpEmail } = require("../utils/email");
const { writeAudit } = require("../utils/audit");
const { validatePassword } = require("../utils/passwordPolicy");

function isLocked(user) {
  return user.lockUntil && user.lockUntil.getTime() > Date.now();
}

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signAccess(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

function signRefresh(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === "production";

  const baseOptions = {
    httpOnly: true,
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  };

  res.cookie("accessToken", accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required." });

    // ✅ Strong password policy
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });

    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "Email already exists." });

    const passwordHash = await bcrypt.hash(String(password), 12);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
    });

    // ✅ OTP on signup
    const otp = makeOtp();
    user.otpCodeHash = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = new Date(
      Date.now() + (Number(process.env.OTP_EXPIRE_MIN) || 10) * 60 * 1000
    );
    user.otpAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, otp);
    await writeAudit(req, "REGISTER_SUCCESS_OTP_SENT", user._id, { email: user.email });

    return res.status(201).json({
      message: "OTP sent to email.",
      otpRequired: true,
      userId: user._id,
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: String(email || "").toLowerCase() });
    if (!user) {
      await writeAudit(req, "LOGIN_FAIL_NOUSER", null, { email });
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (isLocked(user)) {
      await writeAudit(req, "LOGIN_BLOCKED_LOCKED", user._id, {});
      return res.status(423).json({ message: "Account temporarily locked. Try later." });
    }

    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 3) {
        user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }

      await user.save();
      await writeAudit(req, "LOGIN_FAIL_BADPASS", user._id, {});
      return res.status(401).json({ message: "Invalid credentials." });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    const otp = makeOtp();
    user.otpCodeHash = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = new Date(
      Date.now() + (Number(process.env.OTP_EXPIRE_MIN) || 10) * 60 * 1000
    );
    user.otpAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, otp);
    await writeAudit(req, "LOGIN_PASSWORD_OK_OTP_SENT", user._id, {});

    return res.json({ message: "OTP sent to email.", otpRequired: true, userId: user._id });
  } catch (e) {
    return res.status(500).json({ message: "Server error." });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      await writeAudit(req, "OTP_FAIL_NOUSER", null, {});
      return res.status(401).json({ message: "Invalid OTP." });
    }

    if (!user.otpCodeHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      await writeAudit(req, "OTP_FAIL_EXPIRED", user._id, {});
      return res.status(401).json({ message: "OTP expired. Please login again." });
    }

    user.otpAttempts += 1;
    if (user.otpAttempts > 5) {
      user.otpCodeHash = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      await user.save();
      await writeAudit(req, "OTP_FAIL_TOO_MANY", user._id, {});
      return res.status(429).json({ message: "Too many OTP attempts. Please login again." });
    }

    const ok = await bcrypt.compare(String(otp || ""), user.otpCodeHash);
    if (!ok) {
      await user.save();
      await writeAudit(req, "OTP_FAIL_WRONG", user._id, {});
      return res.status(401).json({ message: "Invalid OTP." });
    }

    user.otpCodeHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    setAuthCookies(res, accessToken, refreshToken);

    await writeAudit(req, "OTP_SUCCESS_LOGIN_COMPLETE", user._id, {});

    return res.json({
      message: "Login successful.",
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error." });
  }
};

exports.me = async (req, res) => {
  return res.json({ user: req.user });
};

// ✅ UPDATE PROFILE (name/email)
// PUT /api/auth/me
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { name, email } = req.body;

    const updates = {};

    if (typeof name === "string") {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ message: "Name cannot be empty." });
      if (trimmed.length > 60) return res.status(400).json({ message: "Name is too long." });
      updates.name = trimmed;
    }

    if (typeof email === "string") {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return res.status(400).json({ message: "Email cannot be empty." });

      // prevent duplicates
      const exists = await User.findOne({ email: normalized, _id: { $ne: userId } });
      if (exists) return res.status(409).json({ message: "Email already exists." });

      updates.email = normalized;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No changes provided." });
    }

    const updated = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
      select: "-passwordHash",
    });

    await writeAudit(req, "PROFILE_UPDATED", userId, { fields: Object.keys(updates) });

    return res.json({
      message: "Profile updated.",
      user: updated,
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error." });
  }
};

// ✅ CHANGE PASSWORD
// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required." });
    }

    // ✅ Strong password policy
    const pwError = validatePassword(String(newPassword));
    if (pwError) return res.status(400).json({ message: pwError });

    const user = await User.findById(userId).select("+passwordHash");
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!ok) {
      await writeAudit(req, "CHANGE_PASSWORD_FAIL_BAD_CURRENT", userId, {});
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    // ✅ Prevent password reuse (new must differ from current)
    const isSame = await bcrypt.compare(String(newPassword), user.passwordHash);
    if (isSame) {
      return res.status(400).json({
        message: "New password must be different from the current password.",
      });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 12);
    await user.save();

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    setAuthCookies(res, accessToken, refreshToken);

    await writeAudit(req, "CHANGE_PASSWORD_SUCCESS", userId, {});

    return res.json({ message: "Password updated successfully." });
  } catch (e) {
    return res.status(500).json({ message: "Server error." });
  }
};

exports.logout = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd ? true : false,
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd ? true : false,
    path: "/",
  });

  res.json({ message: "Logged out." });
};
