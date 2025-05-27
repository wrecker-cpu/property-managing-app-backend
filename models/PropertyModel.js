const mongoose = require("mongoose");
const Schema = mongoose.Schema; //creation object of schema class

const propertySchema = new Schema({
  fileType: { 
    type: String, 
    enum: ['Title Clear Lands', 'Dispute Lands', 'Govt. Dispute Lands', 'FP / NA', 'Others'],
    required: true 
  },
  landType: { 
    type: String, 
    enum: ['Agriculture', 'None Agriculture'],
    required: true 
  },
  tenure: { 
    type: String, 
    enum: ['Old Tenure', 'New Tenure', 'Premium'],
    required: true 
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
  images: [{
    url: String,
    publicId: String,
    originalName: String
  }],
  pdfs: [{
    url: String,
    publicId: String,
    originalName: String
  }],
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
}, { timestamps: true });


module.exports = mongoose.model("property", propertySchema);