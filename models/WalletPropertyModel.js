const mongoose = require("mongoose");
const Schema = mongoose.Schema; //creation object of schema class

const walletPropertySchema = new Schema(
  {
    propertyCategory: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: [
        "Title Clear Lands",
        "Dispute Lands",
        "Govt. Dispute Lands",
        "FP / NA",
        "Others",
      ],
      required: true,
    },
    landType: {
      type: String,
      enum: ["Agriculture", "None Agriculture"],
      required: true,
    },
    tenure: {
      type: String,
      enum: ["Old Tenure", "New Tenure", "Premium"],
      required: true,
    },
    personWhoShared: { type: String, required: true },
    contactNumber: { type: String, required: true },
    village: String,
    taluko: String,
    district: String,
    serNoNew: String,
    serNoOld: String,
    fpNo: String,
    tp: String,
    zone: String,
    srArea: String,
    fpArea: String,
    srRate: Number,
    fpRate: Number,
    mtrRoad: String,
    nearByLandmark: String,
    notes: String,
    mapLink: String,
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
    // NEW: Upload status tracking fields for async file processing
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
  { timestamps: true }
);

// Add indexes for better query performance
walletPropertySchema.index({ propertyCategory: 1 });
walletPropertySchema.index({ fileType: 1 });
walletPropertySchema.index({ personWhoShared: 1 });
walletPropertySchema.index({ village: 1 });
walletPropertySchema.index({ district: 1 });
walletPropertySchema.index({ uploadStatus: 1 });
walletPropertySchema.index({ createdAt: -1 });

// Add a compound index for common queries
walletPropertySchema.index({ propertyCategory: 1, fileType: 1, createdAt: -1 });

module.exports = mongoose.model("walletProperty", walletPropertySchema);
