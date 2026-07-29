const TransactionModel = require("../../../models/Transaction/Transaction");
const MemberModel = require("../../../models/Users/Member");

const getLoadRequests = async (req, res) => {
  try {
    const { status } = req.query; // 'Pending', 'Completed', 'Rejected'
    const query = { transaction_type: "Top Up Wallet" };
    if (status) {
      query.status = status;
    }

    const requests = await TransactionModel.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error in getLoadRequests:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const processLoadRequest = async (req, res) => {
  try {
    const { transactionId, action } = req.body; // action: 'approve' or 'reject'

    if (!transactionId || !action) {
      return res.status(400).json({ success: false, message: "Transaction ID and action are required" });
    }

    const transaction = await TransactionModel.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (transaction.status !== "Pending") {
      return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });
    }

    if (action === "approve") {
      const member = await MemberModel.findOne({ Member_id: transaction.member_id });
      if (!member) {
        return res.status(404).json({ success: false, message: "Member not found" });
      }

      transaction.status = "Completed";
      await transaction.save();

      member.top_up_wallet_balance = (parseFloat(member.top_up_wallet_balance) || 0) + parseFloat(transaction.ew_credit);
      await member.save();

      return res.status(200).json({ success: true, message: "Load request approved successfully" });
    } else if (action === "reject") {
      transaction.status = "Rejected";
      await transaction.save();

      return res.status(200).json({ success: true, message: "Load request rejected successfully" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }
  } catch (error) {
    console.error("Error in processLoadRequest:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = { getLoadRequests, processLoadRequest };
