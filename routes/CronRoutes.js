const express = require("express");
const { processDailyROI } = require("../utils/cronJobs");

const router = express.Router();

// Secure the route with a simple secret key
// You should set CRON_SECRET in your .env file
const cronAuth = (req, res, next) => {
  const secret = process.env.CRON_SECRET || "my_super_secret_cron_key_123";
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret;

  // Check if either Authorization header or query parameter matches the secret
  if (authHeader === `Bearer ${secret}` || querySecret === secret) {
    return next();
  }

  return res.status(401).json({ success: false, message: "Unauthorized Cron Trigger" });
};

// @route   GET /api/cron/trigger-daily-roi
// @desc    Trigger the Daily ROI cron job manually (for external cron services)
router.get("/trigger-daily-roi", cronAuth, async (req, res) => {
  try {
    const result = await processDailyROI();
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/cron/force-trigger-roi
// @desc    Forcefully trigger 1 day of Daily ROI, bypassing date constraints (Catch-up script)
router.get("/force-trigger-roi", cronAuth, async (req, res) => {
  try {
    const result = await processDailyROI(true);
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
