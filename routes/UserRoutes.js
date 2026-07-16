const express = require("express");
const getTransactionDetails = require("../controllers/Transaction/Transaction");
const { getEpins, transferEpin, getPackageHistory } = require("../controllers/Users/Epin/epin");
const {
  getMemberDetails,
  UpdateMemberDetails,
  activateMemberPackage,
} = require("../controllers/Users/Profile/Profile");
const { getSponsers, checkSponsorReward } = require("../controllers/Users/Sponser/sponser");
const { getMultiLevelSponsorship } = require("../controllers/Users/Sponser/multiLevelSponsorship");
const { createTicket, getTickets } = require("../controllers/Users/Ticket/TicketConntroller");
const Authenticated = require("../middlewares/auth");
const { triggerMLMCommissions, getMemberCommissionSummary, getDailyPayout, climeRewardLoan, repaymentLoan } = require("../controllers/Users/Payout/PayoutController");
const { getPendingTransactions, approveWithdrawal } = require("../controllers/Users/payoutPending/pendingTransactions");
const { getWalletOverview, getWalletWithdraw } = require("../controllers/Users/walletServiece/walletServies");
const { getUplineTree } = require("../controllers/Users/mlmService/mlmService");




const router = express.Router();


router.get("/member/:id", Authenticated, getMemberDetails);
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
router.get("/check-sponsor-reward/:memberId", Authenticated, checkSponsorReward);
router.get('/multi-level-sponsors', Authenticated, getMultiLevelSponsorship);

router.post("/mlm/trigger-commissions", triggerMLMCommissions);
router.get("/mlm/commission-summary/:member_id", getMemberCommissionSummary);
router.get("/mlm/upline-tree/:member_id", getUplineTree);
// router.get("/mlm/payouts/:memberId", Authenticated, getMemberPayouts);


router.get("/overview/:memberId", Authenticated, getWalletOverview);
router.post("/withdraw/:memberId", Authenticated, getWalletWithdraw);
router.put('/approve-withdrawal/:member_id', Authenticated, approveWithdrawal);


// router.get("/level-benefits/:member_id", getLevelBenefits);
// User-specific daily payout (requires member_id parameter)
router.get("/daily-payout/:member_id", Authenticated, getDailyPayout);
router.post("/clime-reward-loan/:memberId", climeRewardLoan)

router.post("/repayment-loan/:memberId", repaymentLoan)

module.exports = router;
