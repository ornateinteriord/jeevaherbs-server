const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema(
  {
    news_id: { type: String },
    news_details: { type: String },
    from_date: { type: String },
    to_date: { type: String },
    status: { type: String, default: "active" },
  },
  { timestamps: true, collection: "news_events_tbl" }
);
const NewsModel = mongoose.model("news_events_tbl", NewsSchema);
module.exports = NewsModel;
