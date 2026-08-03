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
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: "Message is required" });

        const adminId = "ADMIN_1";
        const senderName = "Admin";
        const senderRole = "ADMIN";
        const adminProfileImage = "https://cdn-icons-png.flaticon.com/512/9322/9322127.png"; // Default Admin Icon

        // 1. Fetch all active members
        const members = await MemberModel.find({ status: { $regex: /^active$/i } }).select("Member_id Name profile_image role").lean();
        if (!members.length) return res.status(200).json({ success: true, message: "No active members to broadcast to." });

        const now = new Date();
        const bulkRoomOps = [];
        const newMessages = [];
        const io = req.app.get("io");

        for (const member of members) {
             const participants = [adminId, member.Member_id].sort();
             const roomId = participants.join("_");

             // Prepare chat room upsert
             bulkRoomOps.push({
                 updateOne: {
                     filter: { roomId },
                     update: {
                         $setOnInsert: {
                             participants,
                             participantDetails: [
                                 { memberId: adminId, name: senderName, role: senderRole, profileImage: adminProfileImage },
                                 { memberId: member.Member_id, name: member.Name, role: member.role || "USER", profileImage: member.profile_image || "" },
                             ],
                         },
                         $set: {
                             lastMessage: message.substring(0, 100),
                             lastMessageTime: now,
                         },
                         $inc: { [`unreadCount.${member.Member_id}`]: 1 }
                     },
                     upsert: true
                 }
             });

             // Prepare message insert
             const newMsg = {
                 roomId,
                 senderId: adminId,
                 senderName,
                 senderRole,
                 recipientId: member.Member_id,
                 messageType: "text",
                 text: message,
                 isRead: false,
                 createdAt: now,
                 updatedAt: now
             };
             newMessages.push(newMsg);
        }

        // Execute bulk operations
        await ChatRoomModel.bulkWrite(bulkRoomOps);
        const insertedMessages = await MessageModel.insertMany(newMessages);

        // Emit socket events
        const activeUsers = req.app.get("activeUsers");
        if (io) {
             for (const msg of insertedMessages) {
                  io.to(msg.roomId).emit("receiveMessage", { ...msg.toJSON() });
                  if (activeUsers && msg.recipientId) {
                      const socketIds = activeUsers.get(msg.recipientId);
                      if (socketIds && socketIds.length > 0) {
                          socketIds.forEach(socketId => {
                              io.to(socketId).emit("new_message_notification", { 
                                  roomId: msg.roomId, 
                                  senderId: msg.senderId, 
                                  senderName: msg.senderName, 
                                  text: msg.text.substring(0, 50) 
                              });
                          });
                      }
                  }
             }
        }

        res.status(200).json({ success: true, message: `Broadcast sent to ${members.length} users successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to broadcast chat message", error: error.message });
    }
};

module.exports = { postAnnouncement, getLatestAnnouncement, broadcastChatMessage };
