const TransactionModel = require("../../../models/Transaction/Transaction");
const MemberModel = require("../../../models/Users/Member");

const getWalletOverview = async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required" });
    }

    const member = await MemberModel.findOne({ Member_id: memberId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const transactions = await TransactionModel.find({ member_id: memberId });

    // Filter out loan-related transactions
    const nonLoanTransactions = transactions.filter(tx => 
      !tx.transaction_type?.toLowerCase().includes('loan') &&
      !tx.description?.toLowerCase().includes('loan')
    );

    const completedAndPendingTx = nonLoanTransactions.filter(tx => 
      tx.status === "Completed" || tx.status === "Pending" || tx.status === "Approved"
    );
    
    const availableBalance = completedAndPendingTx.reduce((acc, tx) => 
      acc + (parseFloat(tx.ew_credit) || 0) - (parseFloat(tx.ew_debit) || 0), 0
    );

    // For display purposes only - total income/expenses from completed transactions
    const completedTx = nonLoanTransactions.filter(tx => tx.status === "Completed");
    const totalIncome = completedTx.reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);
    const totalExpenses = completedTx.reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0);

    const totalWithdrawal = nonLoanTransactions
      .filter(tx => tx.transaction_type === "Withdrawal" && tx.status === "Completed")
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0);

    const otherDebits = nonLoanTransactions
      .filter(tx => tx.transaction_type !== "Withdrawal" && tx.status === "Completed")
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0);

    const levelBenefits = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type === "Level benefits" || 
        tx.description === "Level benefits" ||
        tx.transaction_type === "Level Benefits" || 
        tx.description === "Level Benefits") &&
        tx.status === "Completed"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    const directBenefits = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type === "Direct Benefits" || 
        tx.description === "Direct Benefits" ||
        tx.transaction_type === "Direct benefits" || 
        tx.description === "Direct benefits") &&
        tx.status === "Completed"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    // Repayment Commission calculation
    const repaymentCommission = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type === "Repayment Commission" || 
        tx.description === "Repayment Commission" ||
        tx.transaction_type === "Repayment commission" || 
        tx.description === "Repayment commission") &&
        tx.status === "Completed"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    // Get pending withdrawals for transparency
    const pendingWithdrawals = nonLoanTransactions
      .filter(tx => tx.transaction_type === "Withdrawal" && tx.status === "Pending")
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0);

    // Calculate loan amounts separately (for information only)
    const loanTransactions = transactions.filter(tx => 
      tx.transaction_type?.toLowerCase().includes('loan') ||
      tx.description?.toLowerCase().includes('loan')
    );

    const totalLoanCredits = loanTransactions.reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);
    const totalLoanDebits = loanTransactions.reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0);
    const netLoanBalance = totalLoanCredits - totalLoanDebits;

    return res.status(200).json({
      success: true,
      data: {
        balance: Math.max(0, availableBalance).toFixed(2),
        totalIncome: totalIncome.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        totalWithdrawal: totalWithdrawal.toFixed(2),
        otherDebits: otherDebits.toFixed(2),
        transactionsCount: nonLoanTransactions.length,
        availableForWithdrawal: Math.max(0, availableBalance).toFixed(2),
        levelBenefits: levelBenefits.toFixed(2),
        directBenefits: directBenefits.toFixed(2),
        repaymentCommission: repaymentCommission.toFixed(2),
        totalBenefits: (levelBenefits + directBenefits + repaymentCommission).toFixed(2),
        pendingWithdrawals: pendingWithdrawals.toFixed(2),
        // Loan information (for transparency)
        loanInfo: {
          totalLoanAmount: totalLoanCredits.toFixed(2),
          totalLoanRepaid: totalLoanDebits.toFixed(2),
          outstandingLoan: Math.max(0, netLoanBalance).toFixed(2),
          loanTransactionsCount: loanTransactions.length
        },
        calculation: {
          formula: "Available Balance = Sum of All Credits - Sum of All Debits (excluding loan transactions)",
          breakdown: `₹${completedAndPendingTx.reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0).toFixed(2)} - ₹${completedAndPendingTx.reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0).toFixed(2)} = ₹${Math.max(0, availableBalance).toFixed(2)}`,
          note: "Available balance excludes loan transactions. Pending withdrawals: ₹" + pendingWithdrawals.toFixed(2)
        },
      },
    });
  } catch (error) {
    console.error("Error in getWalletOverview:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getWalletWithdraw = async (req, res) => {
  try {
    const { memberId, amount } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: "Member ID is required" });
    if (!amount) return res.status(400).json({ success: false, message: "Withdrawal amount is required" });

    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    }

    const member = await MemberModel.findOne({ Member_id: memberId });
    if (!member) return res.status(404).json({ success: false, message: "Member not found" });

    // Calculate last Saturday
    const today = new Date();
    const lastSaturday = new Date(today);
    
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    // Correct calculation: go back to previous Saturday
    const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    
    lastSaturday.setDate(today.getDate() - daysSinceSaturday);
    lastSaturday.setHours(0, 0, 0, 0);

    console.log("dayOfweek:", dayOfWeek);
    console.log("daysSinceSaturday:", daysSinceSaturday);
    console.log("lastSaturday:", lastSaturday.toISOString());

    // Check if member has any ACTIVE LOAN (Approved with net_amount > 0)
    const activeLoan = await TransactionModel.findOne({
      member_id: memberId,
      transaction_type: { $regex: /loan/i },
      status: "Approved",
      net_amount: { $gt: "0" } // Loan is still unpaid
    });

    console.log("Active Loan Found:", !!activeLoan);
    if (activeLoan) {
      console.log("Active Loan Details:", {
        transaction_date: activeLoan.transaction_date,
        net_amount: activeLoan.net_amount,
        transaction_type: activeLoan.transaction_type
      });
    }

    // Check if loan was taken BEFORE last Saturday
    // New rule: if an active loan exists (net_amount > 0) AND the loan origination date is before lastSaturday
    // then block withdrawal UNLESS there was a repayment on or after lastSaturday.
    let hasUnpaidLoan = false;
    let lastRepayment = null;
    if (activeLoan) {
      const loanDate = new Date(activeLoan.transaction_date);
      console.log("Loan Date:", loanDate.toISOString());
      console.log("Last Saturday:", lastSaturday.toISOString());

      // Find the latest repayment (if any)
      lastRepayment = await TransactionModel.findOne({
        member_id: memberId,
        transaction_type: { $regex: /repay|repayment|loan repayment/i },
        status: { $in: ["Paid", "Completed", "Approved"] }
      }).sort({ transaction_date: -1 }).exec();

      if (lastRepayment) {
        console.log("Last repayment found:", lastRepayment.transaction_date);
      }

      const unpaidNumeric = parseFloat(activeLoan.net_amount || "0") || 0;

      // Block only if loan was taken before lastSaturday AND there was no repayment on/after lastSaturday AND unpaid amount > 0
      const repaidOnOrAfterLastSaturday = lastRepayment && (new Date(lastRepayment.transaction_date) >= lastSaturday);
      hasUnpaidLoan = loanDate < lastSaturday && unpaidNumeric > 0 && !repaidOnOrAfterLastSaturday;
      console.log("Loan taken before last Saturday:", loanDate < lastSaturday, "unpaidNumeric:", unpaidNumeric, "repaidOnOrAfterLastSaturday:", repaidOnOrAfterLastSaturday, "hasUnpaidLoan:", hasUnpaidLoan);
    }

    const allTransactions = await TransactionModel.find({ member_id: memberId });

    const nonLoanTransactions = allTransactions.filter(tx => 
      !tx.transaction_type?.toLowerCase().includes('loan') &&
      !tx.description?.toLowerCase().includes('loan')
    );

    let totalCredits = 0;
    let totalDebits = 0;

    nonLoanTransactions.forEach((tx) => {
      totalCredits += parseFloat(tx.ew_credit) || 0;
      totalDebits += parseFloat(tx.ew_debit) || 0;
    });

    let availableBalance = totalCredits - totalDebits;
    availableBalance = Math.max(0, availableBalance);

    const completedTransactions = nonLoanTransactions.filter(tx => tx.status === "Completed");
    
    const levelBenefits = completedTransactions
      .filter(tx => 
        tx.transaction_type === "Level benefits" || 
        tx.description === "Level benefits" ||
        tx.transaction_type === "Level Benefits" || 
        tx.description === "Level Benefits"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    const directBenefits = completedTransactions
      .filter(tx => 
        tx.transaction_type === "Direct Benefits" || 
        tx.description === "Direct Benefits" ||
        tx.transaction_type === "Direct benefits" || 
        tx.description === "Direct benefits"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    const repaymentCommission = completedTransactions
      .filter(tx => 
        tx.transaction_type === "Repayment Commission" || 
        tx.description === "Repayment Commission" ||
        tx.transaction_type === "Repayment commission" || 
        tx.description === "Repayment commission"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    if (withdrawalAmount < 500) {
      return res.status(400).json({ 
        success: false, 
        message: "Minimum withdrawal amount is ₹500",
        minimum: 500,
        loanStatus: {
          hasUnpaidLoan: hasUnpaidLoan,
          isWithdrawalAllowed: !hasUnpaidLoan,
          message: hasUnpaidLoan ? "Withdrawal blocked - Unpaid loan from before last Saturday" : "No unpaid loans"
        }
      });
    }

    if (withdrawalAmount > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: "Maximum withdrawal amount is ₹1000",
        maximum: 1000,
        loanStatus: {
          hasUnpaidLoan: hasUnpaidLoan,
          isWithdrawalAllowed: !hasUnpaidLoan,
          message: hasUnpaidLoan ? "Withdrawal blocked - Unpaid loan from before last Saturday" : "No unpaid loans"
        }
      });
    }

    // Check if member has unpaid loan from before last Saturday
    if (hasUnpaidLoan) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal not allowed - You have unpaid loan amount from before last Saturday",
        loanStatus: {
          hasUnpaidLoan: true,
          isWithdrawalAllowed: false,
          lastSaturday: lastSaturday.toDateString(),
          loanDate: activeLoan?.transaction_date,
          unpaidAmount: activeLoan?.net_amount,
          message: "Please clear your pending loan amount to enable withdrawals"
        },
        details: {
          requested: withdrawalAmount.toFixed(2),
          available: availableBalance.toFixed(2),
        }
      });
    }

    if (withdrawalAmount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
        loanStatus: {
          hasUnpaidLoan: hasUnpaidLoan,
          isWithdrawalAllowed: !hasUnpaidLoan,
          message: hasUnpaidLoan ? "Withdrawal blocked - Unpaid loan from before last Saturday" : "No unpaid loans - Withdrawal allowed if balance is sufficient"
        },
        details: {
          requested: withdrawalAmount.toFixed(2),
          available: availableBalance.toFixed(2),
          shortfall: (withdrawalAmount - availableBalance).toFixed(2),
        },
        benefitsBreakdown: {
          levelBenefits: levelBenefits.toFixed(2),
          directBenefits: directBenefits.toFixed(2),
          repaymentCommission: repaymentCommission.toFixed(2),
          totalBenefits: (levelBenefits + directBenefits + repaymentCommission).toFixed(2),
          availableBalance: availableBalance.toFixed(2)
        },
        note: "Loan amounts are not included in available balance for withdrawals."
      });
    }

    const deduction = withdrawalAmount * 0.15;
    const netAmount = withdrawalAmount - deduction;

    const lastTransaction = await TransactionModel.findOne({})
      .sort({ createdAt: -1 })
      .exec();

    let newTransactionId = 1;
    if (lastTransaction && lastTransaction.transaction_id) {
      const lastIdNumber = parseInt(lastTransaction.transaction_id.replace(/\D/g, ""), 10) || 0;
      newTransactionId = lastIdNumber + 1;
    }

    const newTransaction = new TransactionModel({
      transaction_id: newTransactionId.toString(),
      transaction_date: new Date(),
      member_id: memberId,
      description: "Withdrawal Request",
      transaction_type: "Withdrawal",
      ew_credit: 0,
      ew_debit: withdrawalAmount,
      status: "Pending",
      deduction: deduction,
      net_amount: netAmount,
      gross_amount: withdrawalAmount,
      benefits_source: {
        level_benefits_used: levelBenefits,
        direct_benefits_used: directBenefits,
        repayment_commission_used: repaymentCommission,
        total_benefits_available: levelBenefits + directBenefits + repaymentCommission
      }
    });

    await newTransaction.save();

    let newAvailableBalance = availableBalance - withdrawalAmount;
    newAvailableBalance = Math.max(0, newAvailableBalance);

    return res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: {
        transactionId: newTransaction.transaction_id,
        withdrawalDetails: {
          grossAmount: withdrawalAmount.toFixed(2),
          deduction: deduction.toFixed(2),
          netAmount: netAmount.toFixed(2),
          deductionRate: "15%"
        },
        balanceDetails: {
          previousBalance: availableBalance.toFixed(2),
          withdrawalAmount: withdrawalAmount.toFixed(2),
          newAvailableBalance: newAvailableBalance.toFixed(2)
        },
        benefitsBreakdown: {
          levelBenefits: levelBenefits.toFixed(2),
          directBenefits: directBenefits.toFixed(2),
          repaymentCommission: repaymentCommission.toFixed(2),
          totalBenefits: (levelBenefits + directBenefits + repaymentCommission).toFixed(2),
          benefitsContribution: `${((levelBenefits + directBenefits + repaymentCommission) / (totalCredits || 1) * 100).toFixed(1)}% of total income`
        },
        loanStatus: {
          hasUnpaidLoan: false,
          isWithdrawalAllowed: true,
          message: "No unpaid loans - Withdrawal processed successfully"
        },
        status: "Pending",
        calculation: {
          deduction: `15% of ₹${withdrawalAmount.toFixed(2)} = ₹${deduction.toFixed(2)}`,
          netAmount: `₹${withdrawalAmount.toFixed(2)} - ₹${deduction.toFixed(2)} = ₹${netAmount.toFixed(2)}`,
          balanceUpdate: `₹${availableBalance.toFixed(2)} - ₹${withdrawalAmount.toFixed(2)} = ₹${newAvailableBalance.toFixed(2)}`
        },
        note: "Your available balance excludes loan transactions and includes this pending withdrawal."
      },
    });
  } catch (error) {
    console.error("Error in getWalletWithdraw:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};


module.exports = { getWalletOverview, getWalletWithdraw };