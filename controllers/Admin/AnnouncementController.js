const AnnouncementModel = require("../../models/Admin/Announcement");

// ─── Post Announcement ────────────────────────────────────────────────────────
const postAnnouncement = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: "Message is required" });

        // Deactivate all previous
        await AnnouncementModel.updateMany({}, { isActive: false });

        const newAnnouncement = await new AnnouncementModel({ message, isActive: true }).save();

        const io = req.app.get("io");
        if (io) {
            io.emit("new_announcement", newAnnouncement.message);
        }
        res.status(201).json({ success: true, data: newAnnouncement });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to post announcement", error: error.message });
    }
};

// ─── Get Latest Announcement ──────────────────────────────────────────────────
const getLatestAnnouncement = async (req, res) => {
    try {
        const announcement = await AnnouncementModel.findOne({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: announcement ? announcement.message : "" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch announcement", error: error.message });
    }
};

module.exports = { postAnnouncement, getLatestAnnouncement };
