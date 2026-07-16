const MemberModel = require("../../../models/Users/Member");
const mongoose = require("mongoose");
const AdminModel = require("../../../models/Admin/Admin");
const { triggerMLMCommissions } = require("../Payout/PayoutController");

const getMemberDetails = async (req, res) => {
  try {
    const id = req.user.id;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid User ID" 
      });
    }

    const foundUser = await MemberModel.findById(id) || await AdminModel.findById(id);
                  
    if (!foundUser) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // If admin, return all members
    if (foundUser instanceof AdminModel) {
      const members = await MemberModel.find();
      return res.status(200).json({ 
        success: true, 
        data: foundUser, 
        members 
      });
    }

    // For regular members - get actual registration counts from database
    const directCount = await MemberModel.countDocuments({ 
      referred_by: foundUser.Member_id 
    });

    const totalTeamCount = await MemberModel.countDocuments({
      $or: [
        { referred_by: foundUser.Member_id },
        { referral_path: { $regex: foundUser.Member_id, $options: 'i' } }
      ]
    });

    const indirectCount = totalTeamCount - directCount;

    // Add registration data to response
    const responseData = {
      ...foundUser.toObject(),
      registration_stats: {
        direct: directCount,
        indirect: indirectCount,
        total: totalTeamCount
      }
    };

    return res.status(200).json({ 
      success: true, 
      data: responseData 
    });

  } catch (error) {
    console.error("Error fetching User details:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const activateMemberPackage = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { packageType } = req.body; 

    let query;
    if (mongoose.Types.ObjectId.isValid(memberId)) {
      query = { _id: memberId };
    } else {
      query = { Member_id: memberId };
    }

    // Fetch existing member
    const existingMember = await MemberModel.findOne(query);
    if (!existingMember) {
      return res.status(404).json({ 
        success: false, 
        message: "Member not found" 
      });
    }

    const oldStatus = existingMember.status;

    // Define available packages
    const packages = {
      standard: { name: "standard", value: 2600 },
      RD: { name: "RD", value: 1000 },
    };

    // Validate selected package
    const selectedPackage = packages[packageType] || packages.standard;

    // Update member
    const updatedMember = await MemberModel.findOneAndUpdate(
      query,
      {
        status: 'active',
        spackage: selectedPackage.name,
        package_value: selectedPackage.value,
      },
      { new: true }
    );

    if (!updatedMember) {
      return res.status(404).json({ 
        success: false, 
        message: "Member not found" 
      });
    }

    // MLM activation only when status changes to active
    if (oldStatus !== "active" && updatedMember.status === "active") {
      try {
        // Trigger MLM commissions
        const mlmResult = await triggerMLMCommissions({
          body: {
            new_member_id: updatedMember.Member_id,
            Sponsor_code: updatedMember.sponsor_id || updatedMember.Sponsor_code
          }
        }, {
          status: (code) => ({ json: (data) => data }),
          json: (data) => data
        });

        return res.status(200).json({
          success: true,
          data: updatedMember,
          message: `${selectedPackage.name} package activated successfully`,
          mlm_commission: mlmResult
        });
      } catch (mlmError) {
        console.error("MLM Commission Error:", mlmError);
        return res.status(200).json({
          success: true,
          data: updatedMember,
          message: `${selectedPackage.name} package activated successfully (MLM process error)`,
          mlm_error: mlmError.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: updatedMember,
      message: `${selectedPackage.name} package activated successfully`
    });

  } catch (error) {
    console.error("Error activating package:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


const getMember = async(req,res)=>{
  try {
    if(req.user.role !== "ADMIN"){
      return res
      .status(403)
      .json({ success: false, message: "Access Denied", });
    }
    const memberId = req.params.memberId
    const member = await MemberModel.findOne({Member_id:memberId})
    if(!member){
      return res
      .status(404)
      .json({ success: false, message: "Member not found", });
    }
    return res.status(200).json({ success: true, member });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

const UpdateMemberDetails = async (req, res) => {
  try {
    let memberId;

    if (req.user.role === "ADMIN") {
      memberId = req.params.memberId; 
    } else {
      memberId = req.user.memberId; 
    }

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "Member ID is required",
      });
    }

    const { oldPassword, newPassword, ...updateData } = req.body;

    // Find the user by Member_id (not _id)
    const foundUser = await MemberModel.findOne({ Member_id: memberId });

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Handle password update
    if (oldPassword && newPassword) {
      if (oldPassword !== foundUser.password) {
        return res.status(401).json({
          success: false,
          message: "Old password is incorrect",
        });
      }
      if (oldPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: "New password cannot be the same as old password",
        });
      }
      if (newPassword.length <= 5) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }
     
      updateData.password = newPassword;
    }

    // Update user details
    const updatedMember = await MemberModel.findOneAndUpdate(
      { Member_id: memberId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member details updated successfully",
      data: updatedMember,
    });
  } catch (error) {
    console.error("Error updating member details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const updateMemberStatus = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required in body" });
    }

    let query;
    if (mongoose.Types.ObjectId.isValid(memberId)) {
      query = { _id: memberId };
    } else {
      query = { Member_id: memberId };
    }

    const existingMember = await MemberModel.findOne(query);
    if (!existingMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const oldStatus = existingMember.status;
    const updatedMember = await MemberModel.findOneAndUpdate(query, { status }, { new: true });

    // If status changed to active (from any status) trigger MLM commissions
    if (oldStatus !== "active" && status === "active") {
      try {
        // Trigger MLM commissions
        const mlmResult = await triggerMLMCommissions({
          body: {
            new_member_id: updatedMember.Member_id,
            Sponsor_code: updatedMember.sponsor_id || updatedMember.Sponsor_code
          }
        }, {
          status: (code) => ({ json: (data) => data }),
          json: (data) => data
        });

        return res.status(200).json({
          success: true,
          message: "Member status updated to active",
          data: updatedMember,
          mlm_commission: mlmResult
        });
      } catch (mlmError) {
        console.error("MLM Commission Error:", mlmError);
        return res.status(200).json({
          success: true,
          message: "Member status updated to active (MLM process error)",
          data: updatedMember,
          mlm_error: mlmError.message
        });
      }
    }

    return res.status(200).json({ success: true, message: "Member status updated", data: updatedMember });
  } catch (error) {
    console.error("Error updating member status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getMemberDetails, UpdateMemberDetails,getMember ,activateMemberPackage, updateMemberStatus};
