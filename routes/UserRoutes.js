const express = require("express");
const getTransactionDetails = require("../controllers/Transaction/Transaction");
const { getEpins, transferEpin, getPackageHistory } = require("../controllers/Users/Epin/epin");
const {
  getMemberDetails,
  UpdateMemberDetails,
  activateMemberPackage,
  lookupMember,
} = require("../controllers/Users/Profile/Profile");
const { getSponsers } = require("../controllers/Users/Sponser/sponser");
const { getMultiLevelSponsorship } = require("../controllers/Users/Sponser/multiLevelSponsorship");
const { createTicket, getTickets } = require("../controllers/Users/Ticket/TicketConntroller");
const Authenticated = require("../middlewares/auth");
const { triggerMLMCommissions, getMemberCommissionSummary, getDailyPayout, climeRewardLoan, repaymentLoan } = require("../controllers/Users/Payout/PayoutController");
const { getPendingTransactions, approveWithdrawal } = require("../controllers/Users/payoutPending/pendingTransactions");
const { processDailyROI } = require("../utils/cronJobs");
const { getWalletOverview, getWalletWithdraw, createManualTopupRequest, buyPackageFromTopup, transferToTopup, p2pTopupTransfer } = require("../controllers/Users/walletServiece/walletServies");
const { getUplineTree } = require("../controllers/Users/mlmService/mlmService");




const router = express.Router();


router.get("/member/:id", Authenticated, getMemberDetails);
router.get("/member-lookup/:memberId", Authenticated, lookupMember);
router.put("/member/:memberId", Authenticated, UpdateMemberDetails);
router.put("/activate-package/:memberId", activateMemberPackage);


router.get("/transactions", Authenticated, getTransactionDetails);
router.get("/trasactions/:status", getPendingTransactions);


router.post("/ticket", Authenticated, createTicket);
router.get("/ticket/:id", Authenticated, getTickets);


router.get("/epin", Authenticated, getEpins);
router.put('/transferPackage', Authenticated, transferEpin);
router.get('/package-history', Authenticated, getPackageHistory);

router.get('/sponsers/:memberId', Authenticated, getSponsers);
// router.get("/check-sponsor-reward/:memberId", Authenticated, checkSponsorReward);
router.get('/multi-level-sponsors', Authenticated, getMultiLevelSponsorship);

router.post("/mlm/trigger-commissions", triggerMLMCommissions);
router.get("/mlm/commission-summary/:member_id", getMemberCommissionSummary);
router.get("/mlm/upline-tree/:member_id", getUplineTree);
// router.get("/mlm/payouts/:memberId", Authenticated, getMemberPayouts);


router.get("/overview/:memberId", Authenticated, getWalletOverview);
router.post("/withdraw/:memberId", Authenticated, getWalletWithdraw);
router.put('/approve-withdrawal/:transactionId', Authenticated, approveWithdrawal);
router.post("/manual-topup-request", Authenticated, createManualTopupRequest);
router.post("/buy-package", Authenticated, buyPackageFromTopup);
router.post("/transfer-to-topup", Authenticated, transferToTopup);
router.post("/p2p-topup-transfer", Authenticated, p2pTopupTransfer);


// router.get("/level-benefits/:member_id", getLevelBenefits);
// User-specific daily payout (requires member_id parameter)
router.get("/daily-payout/:member_id", Authenticated, getDailyPayout);
router.post("/clime-reward-loan/:memberId", climeRewardLoan)

router.post("/repayment-loan/:memberId", repaymentLoan)

// Manual trigger for Daily ROI testing
router.post("/trigger-roi", async (req, res) => {
  const result = await processDailyROI();
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

module.exports = router;
