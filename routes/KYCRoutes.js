const express = require("express");
const { submitKYC, approveKYC, getKycSubmissions } = require("../controllers/Users/KYC/kycController");
const router = express.Router();

// Submit KYC details
router.post("/submit", submitKYC);

// Approve KYC
router.post("/approve", approveKYC);

// Get KYC submissions (optional query: ?status=PENDING&q=search&page=1&limit=50)
router.get("/submissions", getKycSubmissions);

module.exports = router;