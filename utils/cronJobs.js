const cron = require('node-cron');
const moment = require('moment');
const MemberModel = require('../models/Users/Member');
const TransactionModel = require('../models/Transaction/Transaction');
const PayoutModel = require('../models/Payout/Payout');

const startCronJobs = () => {
  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log(`[Cron] Starting Daily ROI distribution at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    
    try {
      // Find all active members who haven't completed their 100 days of ROI
      const activeMembers = await MemberModel.find({
        status: "active",
        roi_days_completed: { $lt: 100 }
      });

      console.log(`[Cron] Found ${activeMembers.length} active members eligible for ROI.`);

      const today = moment().startOf('day').toDate();
      let processedCount = 0;

      for (const member of activeMembers) {
        // Prevent double processing on the same day
        if (member.last_roi_date && moment(member.last_roi_date).isSame(today, 'day')) {
          continue;
        }

        // Get the latest transaction to generate a new transaction ID
        const lastTransaction = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
        let newTransactionId = 1;
        if (lastTransaction && lastTransaction.transaction_id) {
          const lastIdNumber = parseInt(lastTransaction.transaction_id.replace(/\D/g, ""), 10) || 0;
          newTransactionId = lastIdNumber + 1;
        }
        const formattedTxId = `TXN-${newTransactionId.toString().padStart(6, '0')}`;

        // Create the Daily ROI transaction
        const newTransaction = new TransactionModel({
          transaction_id: formattedTxId,
          transaction_date: new Date(),
          member_id: member.Member_id,
          description: `Daily ROI - Day ${member.roi_days_completed + 1}`,
          transaction_type: "Daily ROI",
          ew_credit: 50,
          ew_debit: 0,
          status: "Completed",
          net_amount: 50,
          gross_amount: 50
        });

        await newTransaction.save();

        // Create the Payout record
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
          memberId: member.Member_id,
          payout_type: "Daily ROI",
          amount: 50,
          count: member.roi_days_completed + 1,
          days: 100,
          status: "Completed",
          description: `Daily ROI - Day ${member.roi_days_completed + 1}`
        });

        await newPayout.save();

        // Update member record
        member.roi_days_completed += 1;
        member.last_roi_date = new Date();
        await member.save();

        processedCount++;
      }

      console.log(`[Cron] Daily ROI distributed to ${processedCount} members successfully.`);
    } catch (error) {
      console.error('[Cron] Error during Daily ROI distribution:', error);
    }
  });
};

module.exports = { startCronJobs };
