const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    transaction_id: { type: String },
    transaction_date: { type: String },
    member_id: { type: String },
    description: { type: String },
    Name: { type: String },
    mobileno: { type: String },
    transaction_type: { type: String },
    ew_credit: { type: String },
    ew_debit: { type: String },
    status: {
      type: String,
      enum: {
        values: ['active', 'Completed', 'Pending', 'Approved', 'Rejected', 'Processing', 'Failed'],
      },
      default: 'Pending'
    },
    deduction: { type: String },
    net_amount: { type: String },
    withdrawal_amount: { type: String },
    benefit_type: { type: String, default: "direct" },
    previous_balance: { type: String },

    level: { type: Number },
    related_member_id: { type: String },
    related_payout_id: { type: String },
    reference_no: { type: String },

    // Payment-related fields
    is_loan_repayment: { type: Boolean, default: false },
    repayment_status: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid'],
      default: 'Unpaid'
    },
    last_repayment_date: { type: String },

    // Payment context for loan repayments
    repayment_context: {
      member_id: { type: String },
      requested_amount: { type: Number },
      current_due_amount: { type: Number },
      new_due_amount: { type: Number },
      member_name: { type: String },
      member_phone: { type: String },
      original_loan_id: { type: mongoose.Schema.Types.ObjectId },
      original_loan_reference: { type: String },
      original_loan_transaction_id: { type: String }
    },

    // Payment details from webhook
    payment_details: {
      payment_method: { type: String },
      bank_reference: { type: String },
      payment_time: { type: String },
      payment_amount: { type: Number }
    },

    // Idempotency tracking for webhooks
    webhook_processed: { type: Boolean, default: false },
    webhook_processed_at: { type: Date }
  },
  { timestamps: true, collection: "transaction_tbl" }
);

const TransactionModel = mongoose.model("transaction_tbl", TransactionSchema);
module.exports = TransactionModel;