const router = require("express").Router();
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const Order = require("../models/Order"); // you’ll create/use this

// ✅ Stripe needs the raw body to verify signature
router.post(
  "/webhook",
  require("express").raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verify failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const userId = session.metadata?.userId;
        const shippingFullName = session.metadata?.shippingFullName;
        const shippingPhone = session.metadata?.shippingPhone;
        const shippingAddress = session.metadata?.shippingAddress;
        const cartStr = session.metadata?.cart || "[]";

        const items = JSON.parse(cartStr);

        const subtotal = (items || []).reduce(
          (sum, it) => sum + Number(it.price) * Number(it.qty),
          0
        );

        // ✅ Create order only after Stripe confirms payment
        await Order.create({
          user: userId,
          items: items.map((it) => ({
            productId: it.id,
            name: it.name,
            price: Number(it.price),
            qty: Number(it.qty),
            category: it.category || "",
            image: it.image || "",
          })),
          subtotal: Number(subtotal.toFixed(2)),
          shipping: {
            fullName: shippingFullName,
            phone: shippingPhone,
            address: shippingAddress,
          },
          status: "paid",
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || "",
        });
      }

      res.json({ received: true });
    } catch (e) {
      console.error("Webhook handler error:", e);
      res.status(500).json({ message: "Webhook handler failed." });
    }
  }
);

module.exports = router;
