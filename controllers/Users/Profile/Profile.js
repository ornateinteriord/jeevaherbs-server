const MemberModel = require("../../../models/Users/Member");
const mongoose = require("mongoose");
const AdminModel = require("../../../models/Admin/Admin");
const { triggerMLMCommissions } = require("../Payout/PayoutController");

const getMemberDetails = async (req, res) => {
  try {
    // If admin, return all members immediately
    if (req.user && req.user.role === "ADMIN") {
      const members = await MemberModel.find();
      return res.status(200).json({ 
        success: true, 
        members 
      });
    }

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

    // Count direct referrals (members who have this user as their Sponsor_code)
    const directCount = await MemberModel.countDocuments({ 
      $or: [
        { Sponsor_code: foundUser.Member_id },
        { sponsor_id: foundUser.Member_id }
      ]
    });

    // Get total team count recursively using BFS across all downlines
    const getAllTeamMemberIds = async (sponsorId) => {
      const queue = [sponsorId];
      const visited = new Set();
      let total = 0;
      while (queue.length > 0) {
        const current = queue.shift();
        const children = await MemberModel.find(
          { $or: [{ Sponsor_code: current }, { sponsor_id: current }] },
          { Member_id: 1 }
        );
        for (const child of children) {
          if (!visited.has(child.Member_id)) {
            visited.add(child.Member_id);
            total++;
            queue.push(child.Member_id);
          }
        }
      }
      return total;
    };

    const totalTeamCount = await getAllTeamMemberIds(foundUser.Member_id);
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

    let updateData = { status };

    // Automatically assign a 5000 package when activated by admin
    if (oldStatus !== "active" && status === "active") {
      updateData.spackage = "Package 5000";
      updateData.package_value = 5000;
      updateData.activationDate = new Date();
    }

    const updatedMember = await MemberModel.findOneAndUpdate(query, updateData, { new: true });

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

        // Initialize Day 0 ROI Payout & Transaction
        const PayoutModel = require("../../../models/Payout/Payout");
        const TransactionModel = require("../../../models/Transaction/Transaction");

        const lastPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
        let newPayoutId = 1;
        if (lastPayout && lastPayout.payout_id) {
          const lastPayoutIdNumber = parseInt(lastPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0;
          newPayoutId = lastPayoutIdNumber + 1;
        }
        const formattedPayoutId = `PAY-${newPayoutId.toString().padStart(6, '0')}`;

        const newPayout = new PayoutModel({
          payout_id: formattedPayoutId,
          date: new Date().toISOString(),
          memberId: updatedMember.Member_id,
          payout_type: "Daily ROI",
          amount: 0,
          count: 0,
          days: 100,
          status: "Completed",
          description: "Initial ROI Setup"
        });
        await newPayout.save();

        const lastTransaction = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
        let newTxId = 1;
        if (lastTransaction && lastTransaction.transaction_id) {
          const lastIdNumber = parseInt(lastTransaction.transaction_id.replace(/\D/g, ""), 10) || 0;
          newTxId = lastIdNumber + 1;
        }
        const formattedTxId = `TXN-${newTxId.toString().padStart(6, '0')}`;
        
        const newTx = new TransactionModel({
          transaction_id: formattedTxId,
          transaction_date: new Date(),
          member_id: updatedMember.Member_id,
          description: "Initial ROI Setup",
          transaction_type: "Daily ROI",
          ew_credit: 0,
          ew_debit: 0,
          status: "Completed",
          net_amount: 0,
          gross_amount: 0
        });
        await newTx.save();

        /*
        // --- GLOBAL INCOME (AUTOPOOL) LOGIC ---
        // 1. Assign global_pool_id to the newly active member
        const memberWithMaxPoolId = await MemberModel.findOne().sort('-global_pool_id').exec();
        const maxPoolId = memberWithMaxPoolId && memberWithMaxPoolId.global_pool_id ? memberWithMaxPoolId.global_pool_id : 0;
        const newPoolId = maxPoolId + 1;
        
        updatedMember.global_pool_id = newPoolId;
        await updatedMember.save();

        // 2. Check if this activation triggers a Global Income payout
        if (newPoolId >= 5) {
          const winnerId = newPoolId - 4;
          const winner = await MemberModel.findOne({ global_pool_id: winnerId }).exec();
          
          if (winner) {
            // Generate IDs
            const lastGlobalPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
            let gPayoutId = 1;
            if (lastGlobalPayout && lastGlobalPayout.payout_id) {
              gPayoutId = (parseInt(lastGlobalPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0) + 1;
            }
            
            const globalPayout = new PayoutModel({
              payout_id: `PAY-${gPayoutId.toString().padStart(6, '0')}`,
              date: new Date().toISOString(),
              memberId: winner.Member_id,
              payout_type: "Global Income",
              amount: 1000,
              count: 1,
              days: 1,
              status: "Completed",
              description: `Global Income from User ${newPoolId}`
            });
            await globalPayout.save();

            const lastGlobalTx = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
            let gTxId = 1;
            if (lastGlobalTx && lastGlobalTx.transaction_id) {
              gTxId = (parseInt(lastGlobalTx.transaction_id.replace(/\D/g, ""), 10) || 0) + 1;
            }
            
            const globalTx = new TransactionModel({
              transaction_id: `TXN-${gTxId.toString().padStart(6, '0')}`,
              transaction_date: new Date(),
              member_id: winner.Member_id,
              description: `Global Income Payout (Triggered by Pool ID ${newPoolId})`,
              transaction_type: "Global Income",
              ew_credit: 1000,
              ew_debit: 0,
              status: "Completed",
              net_amount: 1000,
              gross_amount: 1000
            });
            await globalTx.save();
          }
        }
        // --- END GLOBAL INCOME LOGIC ---
        */

        // --- NEW GLOBAL INCOME (SINGLE LEG) LOGIC ---
        const memberWithMaxPoolId = await MemberModel.findOne().sort('-global_pool_id').exec();
        const maxPoolId = memberWithMaxPoolId && memberWithMaxPoolId.global_pool_id ? memberWithMaxPoolId.global_pool_id : 0;
        const newPoolId = maxPoolId + 1;
        
        updatedMember.global_pool_id = newPoolId;
        await updatedMember.save();

        // Distribute 50 INR to up to 100 users who joined immediately before this user
        const startPoolId = Math.max(1, newPoolId - 100);
        if (newPoolId > 1) {
          const eligibleMembers = await MemberModel.find({
            global_pool_id: { $gte: startPoolId, $lt: newPoolId }
          }).exec();

          if (eligibleMembers.length > 0) {
            const globalPayoutsToInsert = [];
            const globalTxToInsert = [];
            
            const lastGlobalPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
            let gPayoutId = 1;
            if (lastGlobalPayout && lastGlobalPayout.payout_id) {
              gPayoutId = (parseInt(lastGlobalPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0) + 1;
            }

            const lastGlobalTx = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
            let gTxId = 1;
            if (lastGlobalTx && lastGlobalTx.transaction_id) {
              gTxId = (parseInt(lastGlobalTx.transaction_id.replace(/\D/g, ""), 10) || 0) + 1;
            }

            const dateStr = new Date().toISOString();
            const dateObj = new Date();

            for (let i = 0; i < eligibleMembers.length; i++) {
              const winner = eligibleMembers[i];
              
              globalPayoutsToInsert.push({
                payout_id: `PAY-${(gPayoutId + i).toString().padStart(6, '0')}`,
                date: dateStr,
                memberId: winner.Member_id,
                payout_type: "Reward",
                amount: 50,
                count: 1,
                days: 1,
                status: "Completed",
                description: `Reward from User ${newPoolId} (Single Leg)`
              });

              globalTxToInsert.push({
                transaction_id: `TXN-${(gTxId + i).toString().padStart(6, '0')}`,
                transaction_date: dateObj,
                member_id: winner.Member_id,
                description: `Reward Payout (Triggered by Pool ID ${newPoolId})`,
                transaction_type: "Reward",
                ew_credit: 50,
                ew_debit: 0,
                status: "Completed",
                net_amount: 50,
                gross_amount: 50
              });
            }

            if (globalPayoutsToInsert.length > 0) {
              await PayoutModel.insertMany(globalPayoutsToInsert);
              await TransactionModel.insertMany(globalTxToInsert);
              console.log(`✅ Distributed 50 INR to ${globalPayoutsToInsert.length} upline single-leg members.`);
            }
          }
        }
        // --- END NEW GLOBAL INCOME LOGIC ---

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
