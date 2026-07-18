const express = require("express");
const router = express.Router();

const { createOrder } = require("../controllers/Payments/CashfreeController");

// Creates a Cashfree order (used when user chooses 'online' payment mode)
router.post("/create-order", createOrder);

module.exports = router;
