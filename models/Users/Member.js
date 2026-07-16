const mongoose = require("mongoose");
const moment = require("moment");

const MemberSchema = new mongoose.Schema(
  {
    Member_id: { type: String, required: true, unique: true },
    Name: { type: String, required: true },
    mobileno: { type: String, required: true },
    email: { type: String, required: true },
    state: { type: String },
    district: { type: String },
    city: { type: String },
    taluk: { type: String },
    address: { type: String },
    pincode: { type: String },
    Father_name: { type: String },
    gender: { type: String },
    dob: { type: String },
    password: { type: String, required: true },
    Sponsor_code: { type: String, },
    Sponsor_name: { type: String, },
    Date_of_joining: { type: String, default: () => moment().format("YYYY-MM-DD") },
    spackage: { type: String },
    package_value: { type: Number },
    epin_no: { type: String },
    amount: { type: Number },
    mode_of_payment: { type: String },
    Pan_no: { type: String },
    Nominee_name: { type: String },
    Nominee_age: { type: Number },
    Nominee_Relation: { type: String },
    status: { type: String, enum: ["Pending", "active", "Inactive"], default: "Pending" },
    node: { type: String },
    transaction_pass: { type: String },
    bdb_value: { type: String },
    directreferal_value: { type: String },
    bank_details: { type: String },
    last_logged_in: { type: String },
    google_pay: { type: String },
    phonepe: { type: String },
    member_code: { type: String },
    roi_status: { type: String },
    upgrade_package: { type: String },
    upgrade_status: {
      type: String,
      enum: ["Pending", "Processing", "Approved", "Completed", "Rejected"],
      default: "Pending"
    },
    level_eligible: { type: String },
    TBPDays: { type: String },
    level_income: { type: String },
    direct_income: { type: String },
    account_number: { type: String },
    ifsc_code: { type: String },
    bank_name: { type: String },
    profile_image: { type: String },
    sponsor_id: { type: String, default: null },
    direct_referrals: { type: [String], default: [] },
    total_team: { type: Number, default: 0 },
    // KYC fields
    kycStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "APPROVED", "REJECTED"],
      default: "PENDING"
    },
    // Beneficiary fields (optional)
    beneficiaryId: { type: String },
    beneficiaryStatus: {
      type: String,
      enum: ["NOT_CREATED", "FAILED", "CREATED"],
      default: "NOT_CREATED"
    }
  },
  { timestamps: true, collection: "member_tbl" }
);

const MemberModel = mongoose.model("member_tbl", MemberSchema);
module.exports = MemberModel;
