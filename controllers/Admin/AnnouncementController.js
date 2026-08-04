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

const MemberModel = require("../../models/Users/Member");
const ChatRoomModel = require("../../models/Chat/ChatRoom");
const MessageModel = require("../../models/Chat/Message");
const AdminModel = require("../../models/Admin/Admin");

// ─── Broadcast Chat Message to All Users ──────────────────────────────────────
const broadcastChatMessage = async (req, res) => {
    try {
        const { message, messageType, imageUrl, fileName, fileSize } = req.body;
        if (!message && !imageUrl) return res.status(400).json({ success: false, message: "Message or file is required" });

        const adminId = "ADMIN_1";
        const senderName = "Admin";
        const senderRole = "ADMIN";

        const msgType = messageType || "text";
        const displayMessage = message ? message.substring(0, 100) : (msgType === 'audio' ? 'Voice Message' : (fileName || 'Attachment'));
        const now = new Date();

        // 1. Insert exactly ONE message for the broadcast
        const newMsg = await new MessageModel({
            roomId: "GLOBAL_BROADCAST",
            senderId: adminId,
            senderName,
            senderRole,
            recipientId: "ALL",
            messageType: msgType,
            text: message || "",
            imageUrl,
            fileName,
            fileSize,
            isRead: false,
            createdAt: now,
            updatedAt: now
        }).save();

        // 2. Update all existing admin chat rooms to show the latest message on the sidebar
        await ChatRoomModel.updateMany(
            { participants: adminId },
            { 
                $set: { 
                    lastMessage: displayMessage, 
                    lastMessageTime: now 
                } 
            }
        );

        // 3. Emit socket event
        const io = req.app.get("io");
        if (io) {
             io.emit("receiveMessage", { ...newMsg.toJSON() }); // Broadcast to everyone
        }

        res.status(200).json({ success: true, message: `Broadcast sent successfully and optimized for storage!` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to broadcast chat message", error: error.message });
    }
};

module.exports = { postAnnouncement, getLatestAnnouncement, broadcastChatMessage };
