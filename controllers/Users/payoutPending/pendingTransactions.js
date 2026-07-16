// @desc    Get all pending transactions and member details
// @route   GET /api/transactions/pending

const TransactionModel = require("../../../models/Transaction/Transaction");
const MemberModel = require("../../../models/Users/Member");

// @access  Private/Admin
const getPendingTransactions = async (req, res) => {
  try {
    // Step 1: Get all pending transactions
    const {status} = req.params;
    const pendingTransactions = await TransactionModel.find({ status });

    if (!pendingTransactions.length) {
      return res.json({
        success: true,
        count: 0,
        message: `No ${status} transactions found`,
      });
    }

    // Step 2: For each transaction, get member details
    const transactionsWithMember = await Promise.all(
      pendingTransactions.map(async (txn) => {
        const member = await MemberModel.findOne(
          { Member_id: txn.member_id },
          { mobileno: 1, ifsc_code: 1, account_number: 1, _id: 0 }
        );
        return {
          ...txn.toObject(),
          memberDetails: member || {},
        };
      })
    );

    // Step 3: Send response
    res.json({
      success: true,
      count: transactionsWithMember.length,
      data: transactionsWithMember,
    });
  } catch (error) {
    console.error("Error fetching pending transactions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
const approveWithdrawal = async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Find pending withdrawal transaction for this member
    const transaction = await TransactionModel.findOne({           // Match member ID
    status: { $in: ['Pending', 'Processing'] }// Only pending transactions
    }).sort({ createdAt: -1 });     // Get the most recent one

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "No pending withdrawal found for this member"
      });
    }

    // Update transaction status to Completed
    transaction.status = 'Completed';
    await transaction.save();

    return res.status(200).json({
      success: true,
      message: "Withdrawal approved successfully",
      data: {
        transactionId: transaction.transaction_id,
        memberId: transaction.member_id,
        amount: transaction.ew_debit,
        status: transaction.status
      }
    });
  } catch (error) {
    console.error("Error in approveWithdrawal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
module.exports = {
  getPendingTransactions,
  approveWithdrawal
};
