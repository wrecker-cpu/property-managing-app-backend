const mongoose = require("mongoose");
const Schema = mongoose.Schema; //creation object of schema class

const brokerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
    },
    workarea: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    groups: {
      type: [String], // array of strings like ["Title Clear Lands", "Others"]
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("broker", brokerSchema);
