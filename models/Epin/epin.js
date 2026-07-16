const mongoose = require("mongoose");


const epinSchema = new mongoose.Schema({
    epin_id: { type: Number, unique: true, },
    date: { type: String, },
    epin_no: { type: String, unique: true, },
    purchasedby: { type: String, }, 
    spackage: { type: String, }, 
    amount: { type: String, },
    status: { type: String, enum: ["active", "used"]},
    used_on: { type: String, default: null }, 
    used_for: { type: String, default: null }, 
    generated_by: { type: String, }, 
    transfered_by: { type: String, },
    transfered_on: { type: Date, default : Date.now },
    transfered_to: { type: String, },
}, { timestamps: true , collection: "epin_tbl" });



const EpinModel = mongoose.model("epin_tbl", epinSchema);
module.exports = EpinModel;
