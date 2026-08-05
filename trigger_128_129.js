const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { getNextTransactionIds } = require('./utils/idGenerator');
const TransactionModel = require('./models/Transaction/Transaction');
const PayoutModel = require('./models/Payout/Payout');
const MemberModel = require('./models/Users/Member');

async function triggerMissingSingleLeg() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const poolIdsToTrigger = [128, 129];
  let totalDistributed = 0;

  for (const newPoolId of poolIdsToTrigger) {
    console.log(`\n--- Processing Missing Rewards for Pool ID ${newPoolId} ---`);
    
    // Check if we already distributed for this pool ID to prevent double-crediting
    const existing = await TransactionModel.findOne({ description: `Reward Payout (Triggered by Pool ID ${newPoolId})` });
    if (existing) {
      console.log(`WARNING: Rewards for Pool ID ${newPoolId} already exist! Skipping to be perfectly safe.`);
      continue;
    }

    const startPoolId = Math.max(1, newPoolId - 100);
    const eligibleMembers = await MemberModel.find({
      global_pool_id: { $gte: startPoolId, $lt: newPoolId }
    }).exec();

    if (eligibleMembers.length === 0) {
      console.log(`No eligible members found for Pool ID ${newPoolId}.`);
      continue;
    }

    const globalPayoutsToInsert = [];
    const globalTxToInsert = [];
    
    // Strict UTC Start of today to match Render server timezone
    const todayStart = new Date('2026-08-05T00:00:00.000Z');
    
    const memberIds = eligibleMembers.map(m => m.Member_id);
    
    // Get daily reward counts
    const rewardCounts = await TransactionModel.aggregate([
      {
        $match: {
          member_id: { $in: memberIds },
          transaction_type: "Reward",
          $or: [
            { status: "Completed", createdAt: { $gte: todayStart } },
            { status: "Queued" }
          ]
        }
      },
      { $group: { _id: "$member_id", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    rewardCounts.forEach(c => { countMap[c._id] = c.count; });
    
    // Get historical reward counts (strict 100 limit)
    const totalHistoricalRewards = await TransactionModel.aggregate([
      {
        $match: {
          member_id: { $in: memberIds },
          transaction_type: "Reward"
        }
      },
      { $group: { _id: "$member_id", count: { $sum: 1 } } }
    ]);
    const historicalCountMap = {};
    totalHistoricalRewards.forEach(c => { historicalCountMap[c._id] = c.count; });

    // Generate Payout IDs
    const lastGlobalPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
    let gPayoutId = 1;
    if (lastGlobalPayout && lastGlobalPayout.payout_id) {
      gPayoutId = (parseInt(lastGlobalPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0) + 1;
    }

    // Generate Transaction IDs safely using the robust generator
    const newTxIds = await getNextTransactionIds(eligibleMembers.length);

    let insertedCount = 0;

    for (let i = 0; i < eligibleMembers.length; i++) {
      const winner = eligibleMembers[i];
      const totalHistorical = historicalCountMap[winner.Member_id] || 0;
      
      if (totalHistorical >= 100) continue; // STRICT LIMIT: Do not credit if they already have 100

      const totalRewards = countMap[winner.Member_id] || 0;
      const offsetDays = Math.floor(totalRewards / 4);
      
      const scheduledDate = new Date();
      scheduledDate.setHours(0,0,0,0);
      scheduledDate.setDate(scheduledDate.getDate() + offsetDays);

      const payoutStatus = offsetDays === 0 ? "Completed" : "Queued";
      
      globalPayoutsToInsert.push({
        payout_id: `PAY-${(gPayoutId + insertedCount).toString().padStart(6, '0')}`,
        date: new Date().toISOString(),
        memberId: winner.Member_id,
        payout_type: "Reward",
        amount: 50,
        count: 1,
        days: 1,
        status: payoutStatus,
        description: `Reward from User ${newPoolId} (Single Leg)`,
        process_date: scheduledDate
      });

      globalTxToInsert.push({
        transaction_id: newTxIds[i],
        transaction_date: new Date(),
        member_id: winner.Member_id,
        description: `Reward Payout (Triggered by Pool ID ${newPoolId})`,
        transaction_type: "Reward",
        ew_credit: 50,
        ew_debit: 0,
        status: payoutStatus,
        net_amount: 50,
        gross_amount: 50,
        process_date: scheduledDate
      });
      
      insertedCount++;
    }

    if (globalPayoutsToInsert.length > 0) {
      await PayoutModel.insertMany(globalPayoutsToInsert);
      await TransactionModel.insertMany(globalTxToInsert);
      console.log(`✅ Distributed 50 INR to ${globalPayoutsToInsert.length} eligible upline members for Pool ID ${newPoolId}.`);
      totalDistributed += globalPayoutsToInsert.length;
    }
  }

  console.log(`\n🎉 DONE! Total single leg rewards generated: ${totalDistributed}`);
  mongoose.connection.close();
}

triggerMissingSingleLeg().catch(console.error);
