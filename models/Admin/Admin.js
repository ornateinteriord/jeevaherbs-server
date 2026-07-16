const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    PASSWORD: { type: String, required: true },
    role: { type: String, required: true },
    STATUS: { type: String, required: true },
  },
  {timestamps: true, collection: "admin_tbl" }
);

const AdminModel = mongoose.model("admin_tbl", AdminSchema);
module.exports = AdminModel;
