const router = require("express").Router();
const auth = require("../controllers/authController");
const { requireAuth } = require("../middlewares/auth");
const { loginLimiter, otpLimiter } = require("../middlewares/rateLimiters");

router.post("/register", auth.register);
router.post("/login", loginLimiter, auth.login);
router.post("/verify-otp", otpLimiter, auth.verifyOtp);

router.get("/me", requireAuth, auth.me);

// ✅ NEW
router.put("/me", requireAuth, auth.updateMe);
router.put("/change-password", requireAuth, auth.changePassword);

router.post("/logout", auth.logout);

module.exports = router;
