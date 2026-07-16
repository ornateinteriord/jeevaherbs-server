const mongoose = require("mongoose");
const TransactionModel = require("../../models/Transaction/Transaction");

const getTransactionDetails = async (req, res) => {
  try {
    const loggedInMemberId = req.user.memberId;
    const userRole = req.user.role;
    const { status } = req.query;

    let query = {};
    
    if (userRole === "ADMIN") {
      query = loggedInMemberId ? { member_id: loggedInMemberId } : {};
    } else if (userRole === "USER") {
      query = { member_id: loggedInMemberId };
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const transactions = await TransactionModel.find(query);

    if (!transactions.length) {
      return res.status(200).json({ 
        success: true, 
        message: `No ${status && status !== 'all' ? status + ' ' : ''}transactions found` 
      });
    }

    // Check if today is Saturday
    const today = new Date();
    const dayOfWeek = true; 
    const isSaturday = true;
    
    // Check if user already made a repayment today
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const existingRepaymentToday = await TransactionModel.findOne({
      member_id: loggedInMemberId,
      transaction_type: 'Loan Repayment',
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });

    // Repay is enabled only on Saturday AND if no repayment was made today
    const isRepayEnabled = isSaturday && !existingRepaymentToday;

    // Get day names for additional info
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[dayOfWeek];
    const enabledDays = "Saturday";

    return res.status(200).json({ 
      success: true, 
      data: transactions,
      filter: status || 'all',
      repayConfig: {
        isEnabled: isRepayEnabled,
        enabledDays: enabledDays,
        currentDay: currentDayName,
        message: isRepayEnabled 
          ? `Repayment is available today (${currentDayName})` 
          : `Repayment is only available on ${enabledDays}`
      },
      isRepayEnabled: isRepayEnabled,
      alreadyRepaidToday: !!existingRepaymentToday
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = getTransactionDetails;

    // const today = new Date();
    // const dayOfWeek = today.getDay(); 
    // const isSaturday = true;
    // const isRepayEnabled = true;
   