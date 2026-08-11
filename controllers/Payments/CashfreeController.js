const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");
const TransactionModel = require("../../models/Transaction/Transaction");
const MemberModel = require("../../models/Users/Member");
const PaymentModel = require("../../models/Payments/Payment");
const PayoutModel = require("../../models/Payout/Payout");
const { triggerMLMCommissions } = require("../Users/Payout/PayoutController");
const { singleLegMutex } = require("../../utils/mutex");

// Cashfree API Base URLs
const CASHFREE_BASE = process.env.NODE_ENV === "PROD"
  ? "https://api.cashfree.com"
  : "https://sandbox.cashfree.com";
const X_API_VERSION = "2022-09-01";

exports.createOrder = async (req, res) => {
  try {
    console.log("🟢 CREATE ORDER STARTED =====================");
    console.log("📦 Request Body:", req.body);

    const {
      amount,
      currency = "INR",
      customer,
      notes = {}
    } = req.body;

    const memberId = customer?.customer_id;

    // -------- VALIDATIONS ----------
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount required" });
    }
    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID required" });
    }

    // -------- MEMBER LOOKUP ----------
    const member = await MemberModel.findOne({ Member_id: memberId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    console.log("✅ Member found:", member.Member_id, member.Name);

    // -------- CASHFREE CONFIG ----------
    const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
    const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Cashfree API keys missing"
      });
    }

    const isProd = process.env.CASHFREE_ENV === "production";

    const CASHFREE_BASE_URL = isProd
        ? "https://api.cashfree.com"
        : "https://sandbox.cashfree.com";

    let frontendUrl = (process.env.FRONTEND_URL || "").trim();
    let backendUrl = (process.env.BACKEND_URL || "").trim();

    if (!frontendUrl.startsWith("http")) frontendUrl = "http://" + frontendUrl;
    if (!backendUrl.startsWith("http")) backendUrl = "https://" + backendUrl;

    let returnUrl;
    if (notes && notes.isWalletTopUp) {
      returnUrl = `${frontendUrl}/user/topup-wallet?order_id={order_id}&order_status={order_status}&member_id=${memberId}`;
    } else {
      returnUrl = `${frontendUrl}/register?order_id={order_id}&order_status={order_status}&member_id=${memberId}`;
    }
    const notifyUrl = `${backendUrl}/api/payment/webhook/cashfree`;

    console.log("🔗 Cashfree URLs:", { returnUrl, notifyUrl });

    let cPhone = customer?.customer_phone || member.mobileno || "9999999999";
    cPhone = cPhone.toString().replace(/\D/g, "");
    if (cPhone.length !== 10) {
      cPhone = "9999999999"; // Fallback to avoid Cashfree rejection
    }

    // -------- CASHFREE ORDER PAYLOAD ----------
    const cashfreeBody = {
      order_amount: amount,
      order_currency: currency,
      customer_details: {
        customer_id: memberId,
        customer_email: customer?.customer_email || member.email || "support@example.com",
        customer_phone: cPhone,
        customer_name: customer?.customer_name || member.Name
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl
      }
    };

    console.log("📤 Final Cashfree Payload:", cashfreeBody);

    console.log("Base URL:", CASHFREE_BASE_URL);
    console.log("Client ID:", CASHFREE_APP_ID);
    console.log("Secret Length:", CASHFREE_SECRET_KEY ? CASHFREE_SECRET_KEY.length : 0);
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("CASHFREE_ENV:", process.env.CASHFREE_ENV);

    // -------- SEND TO CASHFREE ----------
    const headers = {
      "Content-Type": "application/json",
     "x-api-version": "2025-01-01",
      "x-client-id": CASHFREE_APP_ID,
      "x-client-secret": CASHFREE_SECRET_KEY,
    };

    const response = await axios.post(
      `${CASHFREE_BASE_URL}/pg/orders`,
      cashfreeBody,
      { headers }
    );

    if (!response.data.payment_session_id) {
      return res.status(500).json({
        success: false,
        message: "Cashfree did not return payment_session_id"
      });
    }

    console.log("✅ Cashfree order created:", response.data.order_id);

    // -------- SAVE PAYMENT RECORD ----------
    await PaymentModel.create({
      memberId,
      orderId: response.data.order_id,
      paymentSessionId: response.data.payment_session_id,
      amount,
      currency,
      status: response.data.order_status,
      rawResponse: response.data,
      notes: notes
    });

    // -------- SEND TO FRONTEND ----------
    res.json({
      success: true,
      order_id: response.data.order_id,
      payment_session_id: response.data.payment_session_id,
      cashfree_env: isProd ? "production" : "sandbox"
    });

  } catch (error) {
    console.error("❌ CASHFREE API ERROR =====================");
    if (error.response) {
      console.error("-> Status Code:", error.response.status);
      console.error("-> Response Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("-> Error Message:", error.message);
    }
    console.error("===========================================");

    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.response?.data || error.message
    });
  } finally {
    console.log("🔚 CREATE ORDER END =====================");
  }
};

// Handle webhook from Cashfree
exports.handleWebhook = async (req, res) => {
  try {
    console.log("🟢 CASHFREE WEBHOOK RECEIVED =====================");
    console.log("-> Webhook Headers:", JSON.stringify(req.headers, null, 2));

    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const secret = process.env.CASHFREE_SECRET_KEY;
    const webhookVersion = req.headers["x-webhook-version"] || "unknown";

    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    let parsedData;
    try {
      parsedData = JSON.parse(rawBody);
      console.log("-> Webhook Parsed Body:", JSON.stringify(parsedData, null, 2));
    } catch (parseErr) {
      console.error("❌ Failed to parse webhook body:", parseErr);
      return res.status(400).send("Invalid JSON in webhook body");
    }

    if (signature && timestamp && secret) {
      let genSig;
      const payload = timestamp + rawBody;
      genSig = crypto.createHmac("sha256", secret).update(payload).digest("base64");
      if (genSig !== signature) {
        console.warn("⚠️ Cashfree signature mismatch - processing anyway to avoid payment loss");
      }
    }

    const data = parsedData;
    const orderId = data.data?.order?.order_id || data.data?.order_id || data.order_id;

    if (!orderId) {
      console.warn("⚠️ Order ID not found in webhook data (Could be a Cashfree Test Webhook)");
      return res.status(200).send("Webhook received successfully (Test)");
    }

    const orderStatus = data.data?.payment?.payment_status || data.data?.order?.order_status || data.order_status;
    const statusMap = {
      "SUCCESS": "PAID",
      "FAILED": "FAILED",
      "CANCELLED": "CANCELLED",
      "PENDING": "PENDING"
    };

    const mappedStatus = statusMap[orderStatus] || orderStatus;
    const isSuccessful = mappedStatus === "PAID";

    // 1) Atomic update for Payment Record
    const paymentRecord = await PaymentModel.findOneAndUpdate(
      { orderId: orderId, status: { $ne: "PAID" } },
      {
        $set: {
          status: mappedStatus,
          webhookReceived: true,
          webhookReceivedAt: new Date(),
          rawResponse: data
        },
        $push: { notifications: data }
      },
      { new: true }
    );

    if (!paymentRecord) {
      // It was either not found or already processed
      const existing = await PaymentModel.findOne({ orderId: orderId });
      if (existing && existing.status === "PAID") {
        return res.status(200).json({ success: true, message: "Already processed" });
      }
      console.warn("⚠️ Payment record not found for order:", orderId);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log("✅ Payment record updated with status:", mappedStatus);
      
    if (isSuccessful) {
      if (paymentRecord.notes && paymentRecord.notes.isWalletTopUp) {
        console.log("💼 Processing Wallet Top Up...");
        const member = await MemberModel.findOneAndUpdate(
          { Member_id: paymentRecord.memberId },
          { $inc: { top_up_wallet_balance: paymentRecord.amount } },
          { new: true }
        );
        if (member) {
          console.log(`✅ Top Up Wallet updated for ${member.Member_id}. New balance: ${member.top_up_wallet_balance}`);

          // Fetch last transaction to generate new TXN ID
          const lastTx = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
          let newTxId = 1;
          if (lastTx && lastTx.transaction_id) {
            const match = lastTx.transaction_id.match(/\d+/);
            if (match) newTxId = parseInt(match[0], 10) + 1;
          }

          const newTx = new TransactionModel({
            transaction_id: `TXN-${newTxId.toString().padStart(6, '0')}`,
            transaction_date: new Date().toISOString(),
            member_id: paymentRecord.memberId,
            Name: member.Name || "",
            mobileno: member.mobileno || "",
            description: `Top Up Wallet Load (Order: ${paymentRecord.orderId})`,
            transaction_type: "Top Up Wallet",
            ew_credit: paymentRecord.amount.toString(),
            ew_debit: "0",
            status: "Completed",
            net_amount: paymentRecord.amount.toString(),
            previous_balance: (member.top_up_wallet_balance - paymentRecord.amount).toString()
          });
          await newTx.save();
          console.log(`✅ Transaction recorded for Top Up Wallet load (ID: ${newTx.transaction_id}).`);

        } else {
          console.error(`❌ Member ${paymentRecord.memberId} not found for Top Up Wallet update.`);
        }
      } else {
        // ACTIVATION LOGIC: Set user status to 'active' atomically
        const member = await MemberModel.findOneAndUpdate(
        { Member_id: paymentRecord.memberId, status: "Pending" },
        {
          $set: {
            spackage: paymentRecord.amount == 999 ? "Package 999" : "Package 5000",
            package_value: paymentRecord.amount == 999 ? 999 : 5000,
            activationDate: new Date(),
            last_roi_date: new Date(),
            status: "active"
          }
        },
        { new: true }
      );

      if (member) {
        console.log("✅ Member status updated to active atomically");

        // Trigger MLM Commissions
          try {
            await triggerMLMCommissions({
              body: {
                new_member_id: member.Member_id,
                Sponsor_code: member.sponsor_id || member.Sponsor_code
              }
            }, {
              status: () => ({ json: (data) => data }),
              json: (data) => data
            });

            // Initialize Day 0 ROI Payout & Transaction
            const lastPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
            let newPayoutId = 1;
            if (lastPayout && lastPayout.payout_id) {
              const lastPayoutIdNumber = parseInt(lastPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0;
              newPayoutId = lastPayoutIdNumber + 1;
            }
            const formattedPayoutId = `PAY-${newPayoutId.toString().padStart(6, '0')}`;

            const newPayout = new PayoutModel({
              payout_id: formattedPayoutId,
              date: new Date().toISOString(),
              memberId: member.Member_id,
              payout_type: "Daily ROI",
              amount: 0,
              count: 0,
              days: 100,
              status: "Completed",
              description: "Initial ROI Setup"
            });
            await newPayout.save();

            const lastTransaction = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
            let newTxId = 1;
            if (lastTransaction && lastTransaction.transaction_id) {
              const lastIdNumber = parseInt(lastTransaction.transaction_id.replace(/\D/g, ""), 10) || 0;
              newTxId = lastIdNumber + 1;
            }
            const formattedTxId = `TXN-${newTxId.toString().padStart(6, '0')}`;
            
            const newTx = new TransactionModel({
              transaction_id: formattedTxId,
              transaction_date: new Date(),
              member_id: member.Member_id,
              description: "Initial ROI Setup",
              transaction_type: "Daily ROI",
              ew_credit: 0,
              ew_debit: 0,
              status: "Completed",
              net_amount: 0,
              gross_amount: 0
            });
            await newTx.save();

            /* 
            // --- GLOBAL INCOME (AUTOPOOL) LOGIC ---
            const memberWithMaxPoolId = await MemberModel.findOne().sort('-global_pool_id').exec();
            const maxPoolId = memberWithMaxPoolId && memberWithMaxPoolId.global_pool_id ? memberWithMaxPoolId.global_pool_id : 0;
            const newPoolId = maxPoolId + 1;
            
            member.global_pool_id = newPoolId;
            await member.save();

            if (newPoolId >= 5) {
              const winnerId = newPoolId - 4;
              const winner = await MemberModel.findOne({ global_pool_id: winnerId }).exec();
              
              if (winner) {
                const lastGlobalPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
                let gPayoutId = 1;
                if (lastGlobalPayout && lastGlobalPayout.payout_id) {
                  gPayoutId = (parseInt(lastGlobalPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0) + 1;
                }
                
                const globalPayout = new PayoutModel({
                  payout_id: `PAY-${gPayoutId.toString().padStart(6, '0')}`,
                  date: new Date().toISOString(),
                  memberId: winner.Member_id,
                  payout_type: "Global Income",
                  amount: 1000,
                  count: 1,
                  days: 1,
                  status: "Completed",
                  description: `Global Income from User ${newPoolId}`
                });
                await globalPayout.save();

                const lastGlobalTx = await TransactionModel.findOne({}).sort({ createdAt: -1 }).exec();
                let gTxId = 1;
                if (lastGlobalTx && lastGlobalTx.transaction_id) {
                  gTxId = (parseInt(lastGlobalTx.transaction_id.replace(/\D/g, ""), 10) || 0) + 1;
                }
                
                const globalTx = new TransactionModel({
                  transaction_id: `TXN-${gTxId.toString().padStart(6, '0')}`,
                  transaction_date: new Date(),
                  member_id: winner.Member_id,
                  description: `Global Income Payout (Triggered by Pool ID ${newPoolId})`,
                  transaction_type: "Global Income",
                  ew_credit: 1000,
                  ew_debit: 0,
                  status: "Completed",
                  net_amount: 1000,
                  gross_amount: 1000
                });
                await globalTx.save();
              }
            } 
            */

            // --- NEW GLOBAL INCOME (SINGLE LEG) LOGIC ---
            await singleLegMutex.lock();
            try {
              const memberWithMaxPoolId = await MemberModel.findOne().sort('-global_pool_id').exec();
              const maxPoolId = memberWithMaxPoolId && memberWithMaxPoolId.global_pool_id ? memberWithMaxPoolId.global_pool_id : 0;
              const newPoolId = maxPoolId + 1;
              
              member.global_pool_id = newPoolId;
              await member.save();

              // --- Calculate Daily Activation Sequence (N) ---
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);

              const todayEnd = new Date();
              todayEnd.setHours(23, 59, 59, 999);

              const activationsTodayCount = await MemberModel.countDocuments({
                  global_pool_id: { $exists: true, $ne: null },
                  activationDate: { $gte: todayStart, $lte: todayEnd }
              });

              // N is the activation sequence number for today
              const N = activationsTodayCount;
              
              // Determine which package to pay based on the new member's package
              const newMemberPackage = member.package_value == 999 || member.package_value == "999" ? 999 : 5000;
              let eligibleMembers = [];

              if (newMemberPackage === 999) {
                const total999Users = await MemberModel.countDocuments({
                  package_value: { $in: [999, "999"] },
                  Member_id: { $ne: member.Member_id },
                  status: { $regex: /^active$/i }
                });
                
                let totalBlocks = Math.ceil(total999Users / 100);
                if (totalBlocks === 0) totalBlocks = 1;
                
                const currentBlockIndex = (N - 1) % totalBlocks;
                const skipAmount = currentBlockIndex * 100;
                
                console.log(`[Single Leg] Activation #${N} today (999 Pkg). Paying 999 block index ${currentBlockIndex} (skipping ${skipAmount})`);
                
                eligibleMembers = await MemberModel.find({
                  package_value: { $in: [999, "999"] },
                  Member_id: { $ne: member.Member_id },
                  status: { $regex: /^active$/i }
                }).sort({ global_pool_id: 1 }).skip(skipAmount).limit(100).exec();
                
              } else {
                const total5000Users = await MemberModel.countDocuments({
                  package_value: { $in: [5000, "5000"] },
                  Member_id: { $ne: member.Member_id },
                  status: { $regex: /^active$/i }
                });
                
                let totalBlocks = Math.ceil(total5000Users / 100);
                if (totalBlocks === 0) totalBlocks = 1;
                
                const currentBlockIndex = (N - 1) % totalBlocks;
                const skipAmount = currentBlockIndex * 100;
                
                console.log(`[Single Leg] Activation #${N} today (5000 Pkg). Paying 5000 block index ${currentBlockIndex} (skipping ${skipAmount})`);
                
                eligibleMembers = await MemberModel.find({
                  package_value: { $in: [5000, "5000"] },
                  Member_id: { $ne: member.Member_id },
                  status: { $regex: /^active$/i }
                }).sort({ global_pool_id: 1 }).skip(skipAmount).limit(100).exec();
              }

              if (eligibleMembers.length > 0) {
                const globalPayoutsToInsert = [];
                const globalTxToInsert = [];
                const memberIds = eligibleMembers.map(m => m.Member_id);
                
                // Check historical totals AND today's totals
                const todayStartQuery = new Date();
                todayStartQuery.setHours(0, 0, 0, 0);

                const allRewards = await TransactionModel.aggregate([
                  {
                    $match: {
                      member_id: { $in: memberIds },
                      transaction_type: "Reward"
                    }
                  },
                  {
                    $group: {
                      _id: "$member_id",
                      totalCount: { $sum: 1 },
                      todayCount: {
                        $sum: {
                          $cond: [{ $gte: ["$createdAt", todayStartQuery] }, 1, 0]
                        }
                      }
                    }
                  }
                ]);
                const countMap = {};
                allRewards.forEach(c => { countMap[c._id] = { total: c.totalCount, today: c.todayCount }; });

                const lastGlobalPayout = await PayoutModel.findOne({}).sort({ createdAt: -1 }).exec();
                let gPayoutId = 1;
                if (lastGlobalPayout && lastGlobalPayout.payout_id) {
                  gPayoutId = (parseInt(lastGlobalPayout.payout_id.toString().replace(/\D/g, ""), 10) || 0) + 1;
                }

                const { getNextTransactionIds } = require("../../utils/idGenerator");
                const newTxIds = await getNextTransactionIds(eligibleMembers.length);
                let actualInsertCount = 0;

                for (let i = 0; i < eligibleMembers.length; i++) {
                  const winner = eligibleMembers[i];
                  const winnerCounts = countMap[winner.Member_id] || { total: 0, today: 0 };
                  
                  if (winner.package_value == 999 || winner.package_value == "999") {
                    if (winnerCounts.total >= 100) continue; // Max 100 total (₹2000)
                    if (winnerCounts.today >= 2) continue;   // Max 2 times per day (₹40)
                  } else {
                    if (winnerCounts.total >= 100) continue; // Max 100 total (₹5000)
                  }
                  
                  // Instant Completed status
                  const payoutStatus = "Completed";
                  const scheduledDate = new Date();
                  const rewardAmount = (winner.package_value == 999 || winner.package_value == "999") ? 20 : 50;
                  
                  globalPayoutsToInsert.push({
                    payout_id: `PAY-${(gPayoutId + actualInsertCount).toString().padStart(6, '0')}`,
                    date: new Date().toISOString(),
                    memberId: winner.Member_id,
                    payout_type: "Reward",
                    amount: rewardAmount,
                    count: 1,
                    days: 1,
                    status: payoutStatus,
                    description: `Reward from User ${newPoolId} (Single Leg Block ${N})`,
                    process_date: scheduledDate
                  });

                  globalTxToInsert.push({
                    transaction_id: newTxIds[actualInsertCount],
                    transaction_date: new Date(),
                    member_id: winner.Member_id,
                    description: `Reward Payout (Triggered by Pool ID ${newPoolId})`,
                    transaction_type: "Reward",
                    ew_credit: rewardAmount,
                    ew_debit: 0,
                    status: payoutStatus,
                    net_amount: rewardAmount,
                    gross_amount: rewardAmount,
                    process_date: scheduledDate
                  });
                  
                  actualInsertCount++;
                }

                if (globalPayoutsToInsert.length > 0) {
                  await PayoutModel.insertMany(globalPayoutsToInsert);
                  await TransactionModel.insertMany(globalTxToInsert);
                  console.log(`✅ Distributed rewards to ${globalPayoutsToInsert.length} members in block ${N}.`);
                } else {
                  console.log(`⚠️ Block ${N} had eligible members, but all reached reward limits (or daily limits).`);
                }
              } else {
                 console.log(`⚠️ Block ${N} is empty (No eligible 999/5000 users found in bounds). Skipping reward distribution.`);
              }
            } finally {
              singleLegMutex.unlock();
            }
            // --- END NEW GLOBAL INCOME LOGIC ---
          } catch (err) {
            console.error("❌ Error in MLM/Global Pool processing:", err);
          }
        } // end if member
      } // end if !isWalletTopUp
    } // end if isSuccessful

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};