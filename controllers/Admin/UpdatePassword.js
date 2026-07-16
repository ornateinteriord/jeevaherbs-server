const AdminModel = require("../../models/Admin/Admin");

const UpdatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }
    const admin = await AdminModel.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    if (oldPassword !== admin.PASSWORD) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }
    if (newPassword === admin.PASSWORD) {
      return res
        .status(400)
        .json({ message: "New password cannot be the same as old password" });
    }
    await AdminModel.findByIdAndUpdate(req.user.id, { PASSWORD: newPassword });
    res.status(200).json({success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Update Password Error:", error);
    res.status(500).json({success: false, message: error });
  }
};

module.exports = UpdatePassword;
