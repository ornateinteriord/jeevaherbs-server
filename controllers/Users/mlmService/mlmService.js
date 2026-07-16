const MemberModel = require("../../../models/Users/Member");
const PayoutModel = require("../../../models/Payout/Payout");
const TransactionModel = require("../../../models/Transaction/Transaction");

/**
 * Commission Rates for MLM System
 * 
 * Structure:
 * - Level 1 (Direct Referral): ₹100 - When a member directly refers someone
 * - Levels 2-10 (Indirect Referrals): ₹25 each - When someone in your downline refers someone
 * 
 * Example:
 * - A refers B → A gets ₹100 (Level 1)
 * - B refers C → B gets ₹100 (Level 1), A gets ₹25 (Level 2)
 * - C refers D → C gets ₹100 (Level 1), B gets ₹25 (Level 2), A gets ₹25 (Level 3)
 * 
 * Total potential commission per referral: ₹325 (₹100 + ₹25 × 9)
 */
const commissionRates = {
  1: 100,  // Direct referral commission
  2: 25,   // 2nd level indirect commission
  3: 25,   // 3rd level indirect commission
  4: 25,   // 4th level indirect commission
  5: 25,   // 5th level indirect commission
  6: 25,   // 6th level indirect commission
  7: 25,   // 7th level indirect commission
  8: 25,   // 8th level indirect commission
  9: 25,   // 9th level indirect commission
  10: 25   // 10th level indirect commission
};

const getOrdinal = (number) => {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = number % 100;
  return number + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
};

/**
 * Finds all upline sponsors from a given member up to maxLevels
 * Starts from the member and traverses up the sponsor chain
 * Level 1 = Direct sponsor, Level 2 = Sponsor's sponsor, etc.
 * 
 * Example: If A refers B, and B refers C:
 * - When C is activated, findUplineSponsors(C) returns:
 *   - Level 1: B (C's direct sponsor) - gets ₹100
 *   - Level 2: A (B's sponsor) - gets ₹25
 */
const findUplineSponsors = async (memberId, maxLevels = 10) => {
  const uplineSponsors = [];
  let currentMemberId = memberId;
  let level = 0;

  while (level < maxLevels) {
    const currentMember = await MemberModel.findOne({ Member_id: currentMemberId });

    if (!currentMember || !currentMember.sponsor_id) {
      break; // No more sponsors in the chain
    }

    const sponsor = await MemberModel.findOne({ Member_id: currentMember.sponsor_id });
    if (!sponsor) {
      break; // Sponsor not found
    }

    // Increment level and add to upline chain
    // Level 1 = Direct sponsor, Level 2 = Sponsor's sponsor, etc.
    level++;
    uplineSponsors.push({
      level: level,
      sponsor_id: sponsor.Member_id,
      Sponsor_code: sponsor.member_code || sponsor.Member_id,
      sponsor_name: sponsor.Name,
      sponsored_member_id: currentMemberId, // The member who triggered this commission
      sponsor_status: sponsor.status
    });

    // Move up the chain
    currentMemberId = sponsor.Member_id;
  }

  // console.log(`📊 Found ${uplineSponsors.length} upline sponsors for member ${memberId}`);
  // return uplineSponsors;
};

/**
 * Calculates commissions for all eligible upline sponsors when a new member joins
 * 
 * Commission Structure:
 * - Level 1 (Direct Sponsor): ₹100
 * - Levels 2-10 (Indirect Sponsors): ₹25 each
 * 
 * Example Flow:
 * - A refers B → When B activates: A gets ₹100 (Level 1)
 * - B refers C → When C activates: B gets ₹100 (Level 1), A gets ₹25 (Level 2)
 * - C refers D → When D activates: C gets ₹100 (Level 1), B gets ₹25 (Level 2), A gets ₹25 (Level 3)
 * 
 * @param {string} newMemberId - The newly activated member's ID
 * @param {string} directSponsorId - The direct sponsor's ID (for reference)
 * @returns {Array} Array of commission objects for eligible sponsors
 */
const calculateCommissions = async (newMemberId, directSponsorId) => {
  try {
    // Find all upline sponsors up to 10 levels
    const uplineSponsors = await findUplineSponsors(newMemberId, 10);

    if (uplineSponsors.length === 0) {
      // console.log(`⚠️ No upline sponsors found for member ${newMemberId}`);
      return [];
    }

    const commissions = [];

    // Process each upline sponsor
    for (const upline of uplineSponsors) {
      // Only active sponsors are eligible for commissions
      if (upline.sponsor_status !== 'active') {
        // console.log(`⚠️ Skipping Level ${upline.level} commission - Sponsor ${upline.sponsor_id} (${upline.sponsor_name}) is not active (${upline.sponsor_status})`);
        continue;
      }

      // Get commission amount based on level
      const commissionAmount = commissionRates[upline.level] || 0;

      if (commissionAmount > 0) {
        commissions.push({
          level: upline.level,
          sponsor_id: upline.sponsor_id,
          Sponsor_code: upline.Sponsor_code,
          sponsor_name: upline.sponsor_name,
          sponsored_member_id: upline.sponsored_member_id,
          new_member_id: newMemberId,
          amount: commissionAmount,
          payout_type: `${getOrdinal(upline.level)} Level Benefits`,
          description: `Level ${upline.level} commission from new member ${newMemberId}`,
          sponsor_status: upline.sponsor_status
        });

        console.log(`✅ Level ${upline.level}: ${upline.sponsor_name} (${upline.sponsor_id}) gets ₹${commissionAmount} from ${newMemberId}`);
      } else {
        // console.log(`⚠️ No commission rate configured for Level ${upline.level}`);
      }
    }

    // console.log(`💰 Total commissions calculated: ${commissions.length} for ${uplineSponsors.length} upline sponsors`);
    return commissions;

  } catch (error) {
    console.error("❌ Error calculating commissions:", error);
    throw error;
  }
};

/**
 * Processes commissions by creating payouts and transactions for each eligible sponsor
 * 
 * @param {Array} commissions - Array of commission objects from calculateCommissions
 * @returns {Array} Array of results with success/failure status for each commission
 */
const processCommissions = async (commissions) => {
  try {
    const results = [];

    // console.log(`🔄 Processing ${commissions.length} commissions...`);

    for (const commission of commissions) {
      try {
        // Verify sponsor is still active before processing
        const sponsor = await MemberModel.findOne({ Member_id: commission.sponsor_id });

        if (!sponsor || sponsor.status !== 'active') {
          results.push({
            success: false,
            level: commission.level,
            sponsor_id: commission.sponsor_id,
            sponsor_name: commission.sponsor_name,
            error: `Sponsor status is not active (${sponsor?.status || 'not found'})`
          });
          // console.log(`❌ Failed Level ${commission.level}: Sponsor ${commission.sponsor_id} not active`);
          continue;
        }

        // Generate unique payout ID
        const payoutId = Date.now() + Math.floor(Math.random() * 1000) + commission.level;

        // Create payout record
        const payout = new PayoutModel({
          payout_id: payoutId,
          date: new Date().toISOString().split('T')[0],
          memberId: commission.sponsor_id,
          payout_type: commission.payout_type,
          ref_no: commission.new_member_id,
          amount: commission.amount,
          level: commission.level,
          sponsored_member_id: commission.new_member_id,
          sponsor_id: commission.sponsor_id,
          status: "Completed",
          description: commission.description,
          sponsor_status: commission.sponsor_status
        });

        await payout.save();

        // Create transaction record for wallet credit
        const transaction = await createLevelBenefitsTransaction({
          payout_id: payoutId,
          memberId: commission.sponsor_id,
          payout_type: commission.payout_type,
          amount: commission.amount,
          level: commission.level,
          new_member_id: commission.new_member_id
        });

        results.push({
          success: true,
          level: commission.level,
          sponsor_id: commission.sponsor_id,
          Sponsor_code: commission.Sponsor_code,
          sponsor_name: commission.sponsor_name,
          sponsor_status: commission.sponsor_status,
          amount: commission.amount,
          payout_type: commission.payout_type,
          benefit_type: transaction?.benefit_type || (commission.level === 1 ? "direct" : "indirect"),
          payout: payout,
          transaction: transaction
        });

        // console.log(`✅ Commission processed: Level ${commission.level} - ${commission.sponsor_name} (${commission.sponsor_id}) received ₹${commission.amount}`);

      } catch (error) {
        console.error(`❌ Error processing commission for level ${commission.level} (${commission.sponsor_id}):`, error);
        results.push({
          success: false,
          level: commission.level,
          sponsor_id: commission.sponsor_id,
          sponsor_name: commission.sponsor_name,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    // console.log(`📊 Commission Processing Summary: ${successful} successful, ${failed} failed`);

    return results;

  } catch (error) {
    console.error("❌ Error in processCommissions:", error);
    throw error;
  }
};

const createLevelBenefitsTransaction = async (transactionData) => {
  try {
    const { payout_id, memberId, payout_type, amount, level, new_member_id } = transactionData;

    const lastTransaction = await TransactionModel.findOne({}).sort({ createdAt: -1 });
    let newTransactionId = 1;
    if (lastTransaction && lastTransaction.transaction_id) {
      const lastIdNumber = parseInt(lastTransaction.transaction_id.replace(/\D/g, ""), 10) || 0;
      newTransactionId = lastIdNumber + 1;
    }

    const transaction = new TransactionModel({
      transaction_id: newTransactionId.toString(),
      transaction_date: new Date(),
      member_id: memberId,
      reference_no: payout_id.toString(),
      description: payout_type,
      transaction_type: "Level Benefits",
      ew_credit: amount,
      ew_debit: 0,
      status: "Completed",
      level: level,
      benefit_type: level === 1 ? "direct" : "indirect",
      related_member_id: new_member_id,
      related_payout_id: payout_id
    });

    await transaction.save();
    return transaction;

  } catch (error) {
    console.error("❌ Error creating transaction:", error);
    throw error;
  }
};

const updateSponsorReferrals = async (sponsorId, newMemberId) => {
  try {
    const sponsor = await MemberModel.findOne({ Member_id: sponsorId });
    let directReferrals = sponsor.direct_referrals || [];

    if (!directReferrals.includes(newMemberId)) {
      directReferrals.push(newMemberId);
    }

    await MemberModel.findOneAndUpdate(
      { Member_id: sponsorId },
      {
        direct_referrals: directReferrals,
        $inc: { total_team: 1 }
      }
    );

    // console.log(`✅ Updated referrals for ${sponsorId}: Added ${newMemberId}`);

  } catch (error) {
    console.error("❌ Error updating referrals:", error);
    throw error;
  }
};

const getUplineTree = async (memberId, maxLevels = 10) => {
  try {
    const tree = [];
    let currentMemberId = memberId;
    let level = 0;

    while (level < maxLevels) {
      const currentMember = await MemberModel.findOne({ Member_id: currentMemberId });

      if (!currentMember || !currentMember.sponsor_id) {
        break;
      }

      const sponsor = await MemberModel.findOne({ Member_id: currentMember.sponsor_id });
      if (sponsor) {
        level++;
        tree.push({
          level: level,
          member_id: sponsor.Member_id,
          name: sponsor.Name,
          member_code: sponsor.member_code,
          status: sponsor.status,
          direct_referrals: sponsor.direct_referrals || [],
          total_team: sponsor.total_team || 0,
          commission_rate: commissionRates[level],
          eligible: sponsor.status === 'active'
        });

        currentMemberId = sponsor.Member_id;
      } else {
        break;
      }
    }

    return tree;
  } catch (error) {
    console.error("❌ Error getting upline tree:", error);
    throw error;
  }
};

const getCommissionSummary = () => {
  return {
    total_levels: 10,
    level_1_commission: 100,
    levels_2_to_10_commission: 25,
    total_potential: 325,
    rates: commissionRates,
    condition: "Commissions only for sponsors with 'active' status"
  };
};

const processMemberActivation = async (activatedMemberId) => {
  try {
    const member = await MemberModel.findOne({ Member_id: activatedMemberId });
    if (!member) {
      return { success: false, message: "Member not found" };
    }

    let sponsor = null;
    if (member.sponsor_id) {
      sponsor = await MemberModel.findOne({ Member_id: member.sponsor_id });
    }

    if (!sponsor) {
      return { success: false, message: "Sponsor not found" };
    }

    if (sponsor.status !== "active") {
      await updateSponsorReferrals(sponsor.Member_id, member.Member_id).catch(e => console.error(e));
      return { success: false, message: "Sponsor not active; payout skipped" };
    }

    const amount = commissionRates[1] || 0;
    if (amount <= 0) {
      return { success: false, message: "No commission configured for level 1" };
    }

    const payoutId = Date.now() + Math.floor(Math.random() * 1000) + 1;

    const payout = new PayoutModel({
      payout_id: payoutId,
      date: new Date().toISOString().split("T")[0],
      memberId: sponsor.Member_id,
      payout_type: `1st Level Benefits`,
      ref_no: member.Member_id,
      amount: amount,
      level: 1,
      sponsored_member_id: member.Member_id,
      sponsor_id: sponsor.Member_id,
      status: "Completed",
      description: `Direct referral commission from ${member.Member_id}`
    });

    await payout.save();

    const transaction = await createLevelBenefitsTransaction({
      payout_id: payoutId,
      memberId: sponsor.Member_id,
      payout_type: payout.payout_type,
      amount: amount,
      level: 1,
      new_member_id: member.Member_id
    });

    await updateSponsorReferrals(sponsor.Member_id, member.Member_id);

    return {
      success: true,
      payout,
      transaction
    };

  } catch (error) {
    console.error("❌ Error in processMemberActivation:", error);
    throw error;
  }
};

module.exports = {
  commissionRates,
  getOrdinal,
  findUplineSponsors,
  createLevelBenefitsTransaction,
  updateSponsorReferrals,
  calculateCommissions,
  processCommissions,
  getUplineTree,
  getCommissionSummary,
  processMemberActivation
};
