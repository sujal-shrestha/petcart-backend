const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1 },
        category: { type: String, default: "" },
        image: { type: String, default: "" },
      },
    ],

    subtotal: { type: Number, required: true, min: 0 },

    shipping: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
    },

    status: {
      type: String,
      enum: ["placed", "paid", "shipped", "delivered", "cancelled"],
      default: "placed",
    },

    // Stripe tracking
    stripeSessionId: { type: String, default: "" },
    stripePaymentIntentId: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
