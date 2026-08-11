// @desc    Get all pending transactions and member details
// @route   GET /api/transactions/pending

const TransactionModel = require("../../../models/Transaction/Transaction");
const MemberModel = require("../../../models/Users/Member");

// @access  Private/Admin
const getPendingTransactions = async (req, res) => {
  try {
    // Step 1: Get all pending transactions
    const { status } = req.params;
    const pendingTransactions = await TransactionModel.find({ status }).sort({ createdAt: -1 });

    if (!pendingTransactions.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: "No transactions found",
      });
    }

    // Step 2: Extract unique member IDs from transactions
    const memberIds = [...new Set(pendingTransactions.map((txn) => txn.member_id))];

    // Step 3: Fetch all required members in one query
    const members = await MemberModel.find(
      { Member_id: { $in: memberIds } },
      { Member_id: 1, mobileno: 1, ifsc_code: 1, account_number: 1, package_value: 1, spackage: 1, _id: 0 }
    );

    // Create a map for quick lookup
    const memberMap = {};
    members.forEach((member) => {
      memberMap[member.Member_id] = member;
    });

    // Step 4: Map member details to transactions
    const transactionsWithMember = pendingTransactions.map((txn) => {
      return {
        ...txn.toObject(),
        memberDetails: memberMap[txn.member_id] || {},
      };
    });

    // Step 5: Send response
    res.status(200).json({
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
    const { transactionId } = req.params;

    // Find pending withdrawal transaction by ID
    const transaction = await TransactionModel.findOne({
      transaction_id: transactionId,
      status: { $in: ['Pending', 'Processing'] }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "No pending withdrawal found for this transaction ID"
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
