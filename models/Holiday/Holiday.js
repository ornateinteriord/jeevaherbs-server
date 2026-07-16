const mongoose = require("mongoose");

const HolidaySchema = new mongoose.Schema(
  {
    id: { type: Number },
    holiday_desc: { type: String },
    holiday_date: { type: String},
    status: { type: String, default: "active"  },
  },
  { timestamps: true, collection: "holiday_tbl" }
);


const HolidayModel = mongoose.model("holiday_tbl", HolidaySchema);
module.exports = HolidayModel;
