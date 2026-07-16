const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    payout_id: Number,
    date: String,
    memberId: String,
    payout_type: String,
    ref_no: String,
    amount: Number,
    count: Number,
    days: Number,
    status: String,
    level: { type: Number }, 
    sponsored_member_id: { type: String }, 
    sponsor_id: { type: String },
    description: { type: String }
  },
  { timestamps: true, collection: "payouts" }
);

const PayoutModel = mongoose.model("Payout", payoutSchema);
module.exports = PayoutModel;