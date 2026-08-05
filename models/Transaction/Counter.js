const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const CounterModel = mongoose.model("counter_tbl", CounterSchema);
module.exports = CounterModel;
