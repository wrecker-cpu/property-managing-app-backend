const mongoose = require("mongoose");
const Schema = mongoose.Schema; //creation object of schema class

const notesSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("notes", notesSchema);
