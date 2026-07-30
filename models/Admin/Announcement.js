const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
    {
        message: { type: String, required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);
