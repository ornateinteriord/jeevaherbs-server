const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { getNextTransactionId } = require('./utils/idGenerator');
const TransactionModel = require('./models/Transaction/Transaction');
const PayoutModel = require('./models/Payout/Payout');
const MemberModel = require('./models/Users/Member');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const ids = ['JH0129', 'JH0141'];
  
  for (const id of ids) {
    const member = await MemberModel.findOne({ Member_id: id });
    if (!member) continue;
    
    console.log(`Fixing missed ROI for ${id}...`);
    
    // 1. Insert Aug 4 missed ROI (Day 2 for them)
    const formattedTxId = await getNextTransactionId();
    const newTransaction = new TransactionModel({
      transaction_id: formattedTxId,
      transaction_date: new Date('2026-08-04T12:00:00Z'),
      member_id: id,
      description: `Daily ROI - Day 2 (Recovery for Aug 4)`,
      transaction_type: "Daily ROI",
      ew_credit: 50,
      ew_debit: 0,
      status: "Completed",
      net_amount: 50,
      gross_amount: 50,
      createdAt: new Date('2026-08-04T12:00:00Z')
    });
    await newTransaction.save();

    const formattedPayoutId = await getNextTransactionId();
    const newPayout = new PayoutModel({
      payout_id: formattedPayoutId,
      date: new Date('2026-08-04T12:00:00Z').toISOString(),
      memberId: id,
      payout_type: "Daily ROI",
      amount: 50,
      count: 2,
      days: 100,
      status: "Completed",
      description: `Daily ROI - Day 2 (Recovery for Aug 4)`,
      createdAt: new Date('2026-08-04T12:00:00Z')
    });
    await newPayout.save();

    // 2. Increment their roi_days_completed
    member.roi_days_completed += 1;
    await member.save();
    
    // 3. Update the description of their Aug 5 ROI transaction from "Day 2" to "Day 3"
    const aug5Start = new Date('2026-08-05T00:00:00.000Z');
    const aug5End = new Date('2026-08-05T23:59:59.999Z');
    await TransactionModel.updateMany({
      member_id: id,
      transaction_type: 'Daily ROI',
      createdAt: { $gte: aug5Start, $lte: aug5End }
    }, {
      $set: { description: 'Daily ROI - Day 3' }
    });
    
    // Update Payout description as well
    await PayoutModel.updateMany({
      memberId: id,
      payout_type: 'Daily ROI',
      createdAt: { $gte: aug5Start, $lte: aug5End }
    }, {
      $set: { description: 'Daily ROI - Day 3', count: 3 }
    });
    
    console.log(`Fixed ${id}.`);
  }
  
  mongoose.connection.close();
}
fix().catch(console.error);
