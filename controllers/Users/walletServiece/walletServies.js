const TransactionModel = require("../../../models/Transaction/Transaction");
const MemberModel = require("../../../models/Users/Member");
const { triggerMLMCommissions } = require("../Payout/PayoutController");

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

    // Filter out loan-related and top-up-wallet transactions
    const nonLoanTransactions = transactions.filter(tx => 
      !tx.transaction_type?.toLowerCase().includes('loan') &&
      !tx.description?.toLowerCase().includes('loan') &&
      !tx.transaction_type?.toLowerCase().includes('top up wallet') &&
      !tx.description?.toLowerCase().includes('top up wallet') &&
      !tx.transaction_type?.toLowerCase().includes('wallet top-up')
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
        (tx.transaction_type?.toLowerCase() === "level income" || 
        tx.description?.toLowerCase() === "level income") &&
        tx.status === "Completed"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    const directBenefits = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type?.toLowerCase() === "direct income" || 
        tx.description?.toLowerCase() === "direct income") &&
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

    const dailyRoi = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type?.toLowerCase() === "daily roi" || 
        tx.description?.toLowerCase() === "daily roi" || 
        tx.transaction_type?.toLowerCase() === "roi") &&
        tx.status === "Completed"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    const dailyIncentive = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type?.toLowerCase() === "daily incentive" || 
        tx.description?.toLowerCase() === "daily incentive" || 
        tx.description?.toLowerCase().includes("daily incentive")) &&
        tx.status === "Completed"
      )
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0);

    const globalIncome = nonLoanTransactions
      .filter(tx => 
        (tx.transaction_type?.toLowerCase() === "global income" || 
         tx.transaction_type?.toLowerCase() === "reward" ||
         tx.description?.toLowerCase() === "global income" ||
         tx.description?.toLowerCase().includes("reward")) &&
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
        dailyRoi: dailyRoi.toFixed(2),
        dailyIncentive: dailyIncentive.toFixed(2),
        globalIncome: globalIncome.toFixed(2),
        totalBenefits: (levelBenefits + directBenefits + repaymentCommission + dailyRoi + dailyIncentive + globalIncome).toFixed(2),
        pendingWithdrawals: pendingWithdrawals.toFixed(2),
        // Loan information (for transparency)
        loanInfo: {
          totalLoanAmount: totalLoanCredits.toFixed(2),
          totalLoanRepaid: totalLoanDebits.toFixed(2),
          outstandingLoan: Math.max(0, netLoanBalance).toFixed(2),
          loanTransactionsCount: loanTransactions.length
        },
        top_up_wallet_balance: member.top_up_wallet_balance || 0,
        calculation: {
          formula: "Available Balance = Sum of All Credits - Sum of All Debits (excluding loan transactions)",
          breakdown: `₹${completedAndPendingTx.reduce((acc, tx) => acc + (parseFloat(tx.ew_credit) || 0), 0).toFixed(2)} - ₹${completedAndPendingTx.reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0).toFixed(2)} = ₹${Math.max(0, availableBalance).toFixed(2)}`,
          note: "Available balance excludes loan transactions. Pending withdrawals: ₹" + pendingWithdrawals.toFixed(2)
        },
        transactions: nonLoanTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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

    // Allow withdrawals only on 10th and 25th
    const currentDay = new Date().getDate();
    if (currentDay !== 10 && currentDay !== 25) {
      return res.status(400).json({ 
        success: false, 
        message: "Withdrawals are only allowed on the 10th and 25th of every month." 
      });
    }

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

    const totalWithdrawnSoFar = nonLoanTransactions
      .filter(tx => tx.transaction_type === "Withdrawal" && (tx.status === "Completed" || tx.status === "Pending" || tx.status === "Approved"))
      .reduce((acc, tx) => acc + (parseFloat(tx.ew_debit) || 0), 0);

    const newTotalWithdrawal = totalWithdrawnSoFar + withdrawalAmount;

    let requiredDirects = 0;
    if (newTotalWithdrawal <= 12000) {
      requiredDirects = 0;
    } else if (newTotalWithdrawal <= 20000) {
      requiredDirects = 2;
    } else if (newTotalWithdrawal <= 25000) {
      requiredDirects = 4;
    } else {
      const excess = newTotalWithdrawal - 25000;
      const tiersAbove25k = Math.ceil(excess / 5000);
      requiredDirects = 4 + (tiersAbove25k * 2);
    }

    if (requiredDirects > 0) {
      const activeDirectsCount = await MemberModel.countDocuments({ 
        Sponsor_code: memberId,
        status: "active"
      });

      if (activeDirectsCount < requiredDirects) {
        return res.status(400).json({ 
          success: false, 
          message: `Withdrawal blocked: You need ${requiredDirects} active direct referrals to withdraw up to ₹${newTotalWithdrawal.toFixed(2)}. You currently have ${activeDirectsCount}.` 
        });
      }
    }

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

    const deduction = withdrawalAmount * 0.10;
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
          deductionRate: "10%"
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
          deduction: `10% of ₹${withdrawalAmount.toFixed(2)} = ₹${deduction.toFixed(2)}`,
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

const createManualTopupRequest = async (req, res) => {
  try {
    const { memberId, amount, screenshot } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: "Member ID is required" });
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ success: false, message: "Valid amount is required" });
    if (!screenshot) return res.status(400).json({ success: false, message: "Screenshot is required for manual top-up" });

    const member = await MemberModel.findOne({ Member_id: memberId });
    if (!member) return res.status(404).json({ success: false, message: "Member not found" });

    const formattedTxId = `TXN-MAN-${Date.now()}`;

    const newTransaction = new TransactionModel({
      transaction_id: formattedTxId,
      transaction_date: new Date(),
      member_id: memberId,
      Name: member.Name,
      mobileno: member.mobileno,
      description: "Manual QR Top Up Request",
      transaction_type: "Top Up Wallet",
      ew_credit: amount,
      ew_debit: 0,
      status: "Pending",
      net_amount: amount,
      gross_amount: amount,
      screenshot: screenshot
    });

    await newTransaction.save();

    return res.status(200).json({
      success: true,
      message: "Top-up request submitted to Admin successfully",
    });
  } catch (error) {
    console.error("Error in createManualTopupRequest:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const buyPackageFromTopup = async (req, res) => {
  try {
    const { buyerMemberId, targetMemberId } = req.body;
    const packageAmount = 5000;

    if (!buyerMemberId || !targetMemberId) {
      return res.status(400).json({ success: false, message: "Buyer and Target Member IDs are required" });
    }

    const buyer = await MemberModel.findOne({ Member_id: buyerMemberId });
    if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

    if ((buyer.top_up_wallet_balance || 0) < packageAmount) {
      return res.status(400).json({ success: false, message: "Insufficient Top Up Wallet balance" });
    }

    const target = await MemberModel.findOne({ Member_id: targetMemberId });
    if (!target) return res.status(404).json({ success: false, message: "Target member not found" });

    if (target.status === "active") {
      return res.status(400).json({ success: false, message: "Target member is already active" });
    }

    // Deduct from buyer
    buyer.top_up_wallet_balance -= packageAmount;
    await buyer.save();

    // Create transaction for buyer
    const formattedTxId = `TXN-PKG-${Date.now()}`;
    const newTransaction = new TransactionModel({
      transaction_id: formattedTxId,
      transaction_date: new Date(),
      member_id: buyerMemberId,
      Name: buyer.Name,
      mobileno: buyer.mobileno,
      description: `Activated package for ${target.Name} (${targetMemberId})`,
      transaction_type: "Package Activation",
      ew_credit: 0,
      ew_debit: packageAmount,
      status: "Completed",
      net_amount: packageAmount,
      gross_amount: packageAmount
    });
    await newTransaction.save();

    // Update target
    target.status = 'active';
    target.spackage = 'standard';
    target.package_value = packageAmount;
    await target.save();

    // Trigger MLM
    try {
      const mlmResult = await triggerMLMCommissions({
        body: {
          new_member_id: target.Member_id,
          Sponsor_code: target.sponsor_id || target.Sponsor_code
        }
      }, {
        status: () => ({ json: (data) => data }),
        json: (data) => data
      });
      return res.status(200).json({
        success: true,
        message: "Package activated successfully",
        mlm_commission: mlmResult
      });
    } catch (mlmError) {
      console.error("MLM Commission Error:", mlmError);
      return res.status(200).json({
        success: true,
        message: "Package activated successfully (MLM process error)",
        mlm_error: mlmError.message
      });
    }
  } catch (error) {
    console.error("Error in buyPackageFromTopup:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const transferToTopup = async (req, res) => {
  try {
    const { memberId, amount } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: "Member ID is required" });
    if (!amount) return res.status(400).json({ success: false, message: "Transfer amount is required" });

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid transfer amount" });
    }

    const member = await MemberModel.findOne({ Member_id: memberId });
    if (!member) return res.status(404).json({ success: false, message: "Member not found" });

    // Calculate available balance just like in getWalletWithdraw
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

    if (transferAmount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance for transfer",
        details: {
          requested: transferAmount.toFixed(2),
          available: availableBalance.toFixed(2),
        }
      });
    }

    // Create a transaction for the withdrawal debit
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
      description: "Transfer to Top-up Wallet",
      transaction_type: "Transfer",
      ew_credit: 0,
      ew_debit: transferAmount,
      status: "Completed",
      net_amount: transferAmount,
      gross_amount: transferAmount
    });

    await newTransaction.save();

    // Add to top-up wallet
    member.top_up_wallet_balance = (member.top_up_wallet_balance || 0) + transferAmount;
    await member.save();

    return res.status(200).json({
      success: true,
      message: "Transferred to top-up wallet successfully",
      data: {
        transactionId: newTransaction.transaction_id,
        transferAmount: transferAmount.toFixed(2),
        newTopupBalance: member.top_up_wallet_balance.toFixed(2),
        newAvailableBalance: (availableBalance - transferAmount).toFixed(2)
      },
    });

  } catch (error) {
    console.error("Error in transferToTopup:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

const p2pTopupTransfer = async (req, res) => {
  try {
    const { senderId, receiverId, amount } = req.body;

    if (!senderId) return res.status(400).json({ success: false, message: "Sender ID is required" });
    if (!receiverId) return res.status(400).json({ success: false, message: "Receiver ID is required" });
    if (!amount) return res.status(400).json({ success: false, message: "Transfer amount is required" });
    if (senderId === receiverId) return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid transfer amount" });
    }

    const sender = await MemberModel.findOne({ Member_id: senderId });
    if (!sender) return res.status(404).json({ success: false, message: "Sender not found" });

    const receiver = await MemberModel.findOne({ Member_id: receiverId });
    if (!receiver) return res.status(404).json({ success: false, message: "Receiver not found" });

    const availableTopupBalance = sender.top_up_wallet_balance || 0;

    if (transferAmount > availableTopupBalance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Top-up balance for transfer",
        details: {
          requested: transferAmount.toFixed(2),
          available: availableTopupBalance.toFixed(2),
        }
      });
    }

    // Get the next transaction ID
    const lastTransaction = await TransactionModel.findOne({})
      .sort({ createdAt: -1 })
      .exec();

    let newTransactionId = 1;
    if (lastTransaction && lastTransaction.transaction_id) {
      const lastIdNumber = parseInt(lastTransaction.transaction_id.replace(/\D/g, ""), 10) || 0;
      newTransactionId = lastIdNumber + 1;
    }

    // Transaction for Sender (Debit)
    const senderTx = new TransactionModel({
      transaction_id: newTransactionId.toString(),
      transaction_date: new Date(),
      member_id: senderId,
      description: `P2P Top-up Transfer to ${receiverId}`,
      transaction_type: "Transfer",
      ew_credit: 0,
      ew_debit: transferAmount,
      status: "Completed",
      net_amount: transferAmount,
      gross_amount: transferAmount
    });
    
    // Transaction for Receiver (Credit)
    const receiverTx = new TransactionModel({
      transaction_id: (newTransactionId + 1).toString(),
      transaction_date: new Date(),
      member_id: receiverId,
      description: `P2P Top-up Transfer from ${senderId}`,
      transaction_type: "Transfer",
      ew_credit: transferAmount,
      ew_debit: 0,
      status: "Completed",
      net_amount: transferAmount,
      gross_amount: transferAmount
    });

    await senderTx.save();
    await receiverTx.save();

    // Update Top-up balances
    sender.top_up_wallet_balance -= transferAmount;
    receiver.top_up_wallet_balance = (receiver.top_up_wallet_balance || 0) + transferAmount;
    
    await sender.save();
    await receiver.save();

    return res.status(200).json({
      success: true,
      message: "Transferred to user's top-up wallet successfully",
      data: {
        transactionId: senderTx.transaction_id,
        transferAmount: transferAmount.toFixed(2),
        newTopupBalance: sender.top_up_wallet_balance.toFixed(2),
      },
    });

  } catch (error) {
    console.error("Error in p2pTopupTransfer:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

module.exports = { getWalletOverview, getWalletWithdraw, createManualTopupRequest, buyPackageFromTopup, transferToTopup, p2pTopupTransfer };