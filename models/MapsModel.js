const mongoose = require("mongoose");

const mapsSchema = new mongoose.Schema(
  {
    area: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },
    onBoard: {
      type: Boolean,
      default: false,
    },
    recycleBin: {
      type: Boolean,
      default: false,
    },
    images: [
      {
        url: String,
        publicId: String,
        originalName: String,
      },
    ],
    pdfs: [
      {
        url: String,
        publicId: String,
        originalName: String,
      },
    ],
    // Upload tracking fields
    uploadStatus: {
      type: String,
      enum: ["pending", "uploading", "completed", "failed"],
      default: "completed",
    },
    totalFiles: {
      type: Number,
      default: 0,
    },
    uploadedFiles: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Maps", mapsSchema);
