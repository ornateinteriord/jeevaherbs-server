const MemberModel = require("../../../models/Users/Member");
const mongoose = require("mongoose");
const AdminModel = require("../../../models/Admin/Admin");
const { triggerMLMCommissions } = require("../Payout/PayoutController");
const { singleLegMutex } = require("../../../utils/mutex");

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

    // Get total team count using a single DB query and in-memory BFS (drastically faster)
    const getAllTeamMemberIds = async (sponsorId) => {
      // Fetch only required fields for all members to build the tree in memory
      const allMembers = await MemberModel.find({}, { Member_id: 1, Sponsor_code: 1, sponsor_id: 1 }).lean();
      
      // Build an adjacency list (sponsor -> array of children)
      const graph = {};
      for (const member of allMembers) {
        const parentId = member.Sponsor_code || member.sponsor_id;
        if (parentId) {
          if (!graph[parentId]) graph[parentId] = [];
          graph[parentId].push(member.Member_id);
        }
      }

      // In-memory BFS
      const queue = [sponsorId];
      const visited = new Set();
      let total = 0;
      
      while (queue.length > 0) {
        const current = queue.shift();
        const children = graph[current] || [];
        
        for (const childId of children) {
          if (!visited.has(childId)) {
            visited.add(childId);
            total++;
            queue.push(childId);
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
        activationDate: new Date(),
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
    const { status, package_value } = req.body;

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

    // Automatically assign package when activated by admin
    if (oldStatus !== "active" && status === "active") {
      const pValue = package_value || existingMember.package_value || 5000;
      updateData.spackage = pValue == 999 ? "Package 999" : "Package 5000";
      updateData.package_value = pValue;
      updateData.activationDate = new Date();
      updateData.last_roi_date = new Date();
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
        await singleLegMutex.lock();
        try {
          const memberWithMaxPoolId = await MemberModel.findOne().sort('-global_pool_id').exec();
          const maxPoolId = memberWithMaxPoolId && memberWithMaxPoolId.global_pool_id ? memberWithMaxPoolId.global_pool_id : 0;
          const newPoolId = maxPoolId + 1;
          
          updatedMember.global_pool_id = newPoolId;
          await updatedMember.save();

          // --- Calculate Daily Activation Sequence (N) ---
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const activationsTodayCount = await MemberModel.countDocuments({
              global_pool_id: { $exists: true, $ne: null },
              activationDate: { $gte: todayStart, $lte: todayEnd }
          });

          // N is the activation sequence number for today
          const N = activationsTodayCount;
          
          // Determine which package to pay based on the new member's package
          const newMemberPackage = updatedMember.package_value == 999 || updatedMember.package_value == "999" ? 999 : 5000;
          let eligibleMembers = [];

          if (newMemberPackage === 999) {
            const total999Users = await MemberModel.countDocuments({
              package_value: { $in: [999, "999"] },
              Member_id: { $ne: updatedMember.Member_id }
            });
            
            let totalBlocks = Math.ceil(total999Users / 100);
            if (totalBlocks === 0) totalBlocks = 1;
            
            const currentBlockIndex = (N - 1) % totalBlocks;
            const skipAmount = currentBlockIndex * 100;
            
            console.log(`[Single Leg] Activation #${N} today (999 Pkg). Paying 999 block index ${currentBlockIndex} (skipping ${skipAmount})`);
            
            eligibleMembers = await MemberModel.find({
              package_value: { $in: [999, "999"] },
              Member_id: { $ne: updatedMember.Member_id }
            }).sort({ global_pool_id: 1 }).skip(skipAmount).limit(100).exec();
            
          } else {
            const total5000Users = await MemberModel.countDocuments({
              package_value: { $in: [5000, "5000"] },
              Member_id: { $ne: updatedMember.Member_id }
            });
            
            let totalBlocks = Math.ceil(total5000Users / 100);
            if (totalBlocks === 0) totalBlocks = 1;
            
            const currentBlockIndex = (N - 1) % totalBlocks;
            const skipAmount = currentBlockIndex * 100;
            
            console.log(`[Single Leg] Activation #${N} today (5000 Pkg). Paying 5000 block index ${currentBlockIndex} (skipping ${skipAmount})`);
            
            eligibleMembers = await MemberModel.find({
              package_value: { $in: [5000, "5000"] },
              Member_id: { $ne: updatedMember.Member_id }
            }).sort({ global_pool_id: 1 }).skip(skipAmount).limit(100).exec();
          }

          if (eligibleMembers.length > 0) {
            const globalPayoutsToInsert = [];
            const globalTxToInsert = [];
            const memberIds = eligibleMembers.map(m => m.Member_id);
            
            // Check historical totals AND today's totals
            const todayStartQuery = new Date();
            todayStartQuery.setHours(0, 0, 0, 0);

            const allRewards = await TransactionModel.aggregate([
              {
                $match: {
                  member_id: { $in: memberIds },
                  transaction_type: "Reward"
                }
              },
              {
                $group: {
                  _id: "$member_id",
                  totalCount: { $sum: 1 },
                  todayCount: {
                    $sum: {
                      $cond: [{ $gte: ["$createdAt", todayStartQuery] }, 1, 0]
                    }
                  }
                }
              }
            ]);
            const countMap = {};
            allRewards.forEach(c => { countMap[c._id] = { total: c.totalCount, today: c.todayCount }; });

            const lastGlobalPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
            let gPayoutId = 1;
            if (lastGlobalPayout && lastGlobalPayout.payout_id) {
              gPayoutId = (parseInt(lastGlobalPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0) + 1;
            }

            const { getNextTransactionIds } = require("../../../utils/idGenerator");
            const newTxIds = await getNextTransactionIds(eligibleMembers.length);
            let actualInsertCount = 0;

            for (let i = 0; i < eligibleMembers.length; i++) {
              const winner = eligibleMembers[i];
              const winnerCounts = countMap[winner.Member_id] || { total: 0, today: 0 };
              
              if (winner.package_value == 999 || winner.package_value == "999") {
                if (winnerCounts.total >= 100) continue; // Max 100 total (₹2000)
                if (winnerCounts.today >= 2) continue;   // Max 2 times per day (₹40)
              } else {
                if (winnerCounts.total >= 100) continue; // Max 100 total (₹5000)
              }
              
              // Instant Completed status
              const payoutStatus = "Completed";
              const scheduledDate = new Date();
              const rewardAmount = (winner.package_value == 999 || winner.package_value == "999") ? 20 : 50;
              
              globalPayoutsToInsert.push({
                payout_id: `PAY-${(gPayoutId + actualInsertCount).toString().padStart(6, '0')}`,
                date: new Date().toISOString(),
                memberId: winner.Member_id,
                payout_type: "Reward",
                amount: rewardAmount,
                count: 1,
                days: 1,
                status: payoutStatus,
                description: `Reward from User ${newPoolId} (Single Leg Block ${N})`,
                process_date: scheduledDate
              });

              globalTxToInsert.push({
                transaction_id: newTxIds[actualInsertCount],
                transaction_date: new Date(),
                member_id: winner.Member_id,
                description: `Reward Payout (Triggered by Pool ID ${newPoolId})`,
                transaction_type: "Reward",
                ew_credit: rewardAmount,
                ew_debit: 0,
                status: payoutStatus,
                net_amount: rewardAmount,
                gross_amount: rewardAmount,
                process_date: scheduledDate
              });
              
              actualInsertCount++;
            }

            if (globalPayoutsToInsert.length > 0) {
              await PayoutModel.insertMany(globalPayoutsToInsert);
              await TransactionModel.insertMany(globalTxToInsert);
              console.log(`✅ Distributed rewards to ${globalPayoutsToInsert.length} members in block ${N}.`);
            } else {
              console.log(`⚠️ Block ${N} had eligible members, but all reached reward limits (or daily limits).`);
            }
          } else {
             console.log(`⚠️ Block ${N} is empty (No eligible 999/5000 users found in bounds). Skipping reward distribution.`);
          }
        } finally {
          singleLegMutex.unlock();
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

const loginAsMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await MemberModel.findOne({ Member_id: memberId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        id: member._id,
        role: "USER",
        memberId: member.Member_id,
        impersonatedByAdmin: req.user.id
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.status(200).json({
      success: true,
      role: "USER",
      user: member,
      token,
      message: `Direct login to ${member.Name || member.Member_id} successful`
    });
  } catch (error) {
    console.error("Error in loginAsMember:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const lookupMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required" });
    }
    const member = await MemberModel.findOne({ Member_id: memberId }).select("Member_id Name Member_Name");
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    return res.status(200).json({
      success: true,
      data: {
        Member_id: member.Member_id,
        Name: member.Name || member.Member_Name
      }
    });
  } catch (error) {
    console.error("Error in lookupMember:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getMemberDetails, UpdateMemberDetails, getMember, activateMemberPackage, updateMemberStatus, loginAsMember, lookupMember };
