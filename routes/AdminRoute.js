const { getHoliday, addHoliday } = require("../controllers/Admin/Holiday/HolidayController");
const { getNews, addNews } = require("../controllers/Admin/News/NewsController");
const UpdatePassword = require("../controllers/Admin/UpdatePassword");
const getTransactionDetails = require("../controllers/Transaction/Transaction");
const { getEpinsSummary, generatePackage } = require("../controllers/Users/Epin/epin");
const { getDailyPayout,   getRewardLoansByStatus, processRewardLoan } = require("../controllers/Users/Payout/PayoutController");
const { getMemberDetails, UpdateMemberDetails, getMember, updateMemberStatus } = require("../controllers/Users/Profile/Profile");
const { editTicket, getTickets } = require("../controllers/Users/Ticket/TicketConntroller");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");

const router = require("express").Router();

router.put("/update-password",Authenticated,authorizeRoles("ADMIN"),UpdatePassword)
router.get("/members",Authenticated,authorizeRoles("ADMIN"),getMemberDetails)
router.get("/transactions",Authenticated,authorizeRoles("ADMIN"),getTransactionDetails)
router.put("/ticket/:id" ,Authenticated,authorizeRoles("ADMIN"), editTicket)
router.get("/tickets" ,Authenticated,authorizeRoles("ADMIN"), getTickets)
router.get("/epin-summary" ,Authenticated,authorizeRoles("ADMIN"), getEpinsSummary)
router.put('/update-member/:memberId',Authenticated,authorizeRoles("ADMIN"),UpdateMemberDetails)
router.get('/get-member/:memberId',Authenticated,authorizeRoles("ADMIN"),getMember)
router.get('/getnews',Authenticated,authorizeRoles("ADMIN"),getNews)
router.post('/addnews',Authenticated,authorizeRoles("ADMIN"),addNews)
router.get('/getholiday',Authenticated,authorizeRoles("ADMIN"),getHoliday)
router.post('/addholiday',Authenticated,authorizeRoles("ADMIN"),addHoliday)
router.post('/generate-package',Authenticated,authorizeRoles("ADMIN"),generatePackage)
router.put('/update-status/:memberId',updateMemberStatus)
// Admin can access all payouts or filter by member
router.get('/all-daily-payouts', Authenticated, authorizeRoles("ADMIN"), getDailyPayout);
// router.get('/all-daily-payouts/:member_id', Authenticated, authorizeRoles("ADMIN"), getDailyPayout);


router.get('/reward-loans/:status', getRewardLoansByStatus);

router.put('/reward-loans/:memberId/:action', processRewardLoan);

module.exports = router;
