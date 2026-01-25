const router = require("express").Router();
const Order = require("../models/Order");
const { requireAuth } = require("../middlewares/auth");

// POST /api/orders  (protected)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, subtotal, shipping } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    if (!shipping?.fullName || !shipping?.phone || !shipping?.address) {
      return res.status(400).json({ message: "Missing shipping details." });
    }

    // Basic validation: qty/price
    for (const it of items) {
      if (!it.productId || !it.name) {
        return res.status(400).json({ message: "Invalid order item." });
      }
      if (typeof it.price !== "number" || it.price < 0) {
        return res.status(400).json({ message: "Invalid item price." });
      }
      if (typeof it.qty !== "number" || it.qty < 1) {
        return res.status(400).json({ message: "Invalid item quantity." });
      }
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      subtotal: typeof subtotal === "number" ? subtotal : 0,
      shipping: {
        fullName: shipping.fullName,
        phone: shipping.phone,
        address: shipping.address,
      },
    });

    return res.status(201).json({ message: "Order placed.", order });
  } catch (e) {
    console.error("ORDER CREATE ERROR:", e);
    return res.status(500).json({ message: "Failed to place order." });
  }
});

// GET /api/orders/my (protected) - optional but useful
router.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ orders });
  } catch (e) {
    return res.status(500).json({ message: "Failed to fetch orders." });
  }
});

module.exports = router;
