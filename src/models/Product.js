const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    category: {
      type: String,
      enum: ["Dog", "Cat", "Grooming", "Care", "Other"],
      default: "Other",
    },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
