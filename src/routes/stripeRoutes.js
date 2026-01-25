const router = require("express").Router();
const Stripe = require("stripe");
const { requireAuth } = require("../middlewares/auth");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/stripe/create-checkout-session
router.post("/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const { items, shipping } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    if (!shipping?.fullName || !shipping?.phone || !shipping?.address) {
      return res.status(400).json({ message: "Missing shipping details." });
    }

    const line_items = items.map((it) => ({
      quantity: Number(it.qty) || 1,
      price_data: {
        currency: "usd",
        product_data: {
          name: String(it.name || "Item"),
        },
        unit_amount: Math.round(Number(it.price) * 100),
      },
    }));

    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${frontend}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontend}/checkout`,
      metadata: {
        userId: String(req.user._id),
        shippingFullName: shipping.fullName,
        shippingPhone: shipping.phone,
        shippingAddress: shipping.address,
        cart: JSON.stringify(
          items.map((x) => ({
            id: x.id,
            name: x.name,
            price: x.price,
            qty: x.qty,
            category: x.category || "",
            image: x.image || "",
          }))
        ),
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("STRIPE SESSION ERROR:", e);
    return res.status(500).json({ message: "Failed to start Stripe checkout." });
  }
});

module.exports = router;
