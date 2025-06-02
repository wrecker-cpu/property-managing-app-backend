const propertyModel = require("../models/PropertyModel");
const cloudinary = require("cloudinary").v2;
const { processFilesAsync } = require("../utils/fileProcessingService");
require("dotenv").config();
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🚀 HELPER FUNCTION: Clear all cache when data changes
const clearAllCache = (operation = "data change") => {
  try {
    const cacheKeys = cache.keys();
    const clearedCount = cacheKeys.length;

    cache.flushAll();

    return true;
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
    return false;
  }
};

// Create property with async file processing
const createProperty = async (req, res) => {
  try {
    const {
      fileType,
      landType,
      tenure,
      personWhoShared,
      contactNumber,
      village,
      taluko,
      district,
      serNoNew,
      serNoOld,
      fpNo,
      tp,
      zone,
      srArea,
      fpArea,
      srRate,
      fpRate,
      mtrRoad,
      nearByLandmark,
      notes,
      mapLink,
    } = req.body;

    // Validate required fields
    if (
      !fileType ||
      !landType ||
      !tenure ||
      !personWhoShared ||
      !contactNumber
    ) {
      return res.status(400).json({
        message:
          "Required fields missing: fileType, landType, tenure, personWhoShared, contactNumber",
      });
    }

    // Create property without files first
    const property = {
      fileType,
      landType,
      tenure,
      personWhoShared,
      contactNumber,
      village,
      taluko,
      district,
      serNoNew,
      serNoOld,
      fpNo,
      tp,
      zone,
      srArea,
      fpArea,
      srRate: srRate ? Number(srRate) : undefined,
      fpRate: fpRate ? Number(fpRate) : undefined,
      mtrRoad,
      nearByLandmark,
      notes,
      mapLink,
      images: [],
      pdfs: [],
      uploadStatus: "pending",
      totalFiles: 0,
      uploadedFiles: 0,
    };

    // Count total files to upload
    let totalFiles = 0;
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];
      totalFiles += imageFiles.length;
    }
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs)
        ? req.files.pdfs
        : [req.files.pdfs];
      totalFiles += pdfFiles.length;
    }

    property.totalFiles = totalFiles;

    // Save property to database immediately
    const savedProperty = await propertyModel.create(property);

    // 🗑️ Clear cache after creating property
    clearAllCache("property creation");

    // Respond immediately to client
    res.status(201).json({
      message:
        "Property created successfully. Files are being uploaded in the background.",
      property: savedProperty,
      uploadStatus: totalFiles > 0 ? "uploading" : "completed",
    });

    // Process files asynchronously if any files exist
    if (totalFiles > 0) {
      processFilesAsync(savedProperty._id, req.files)
        .then(() => {
          // 🗑️ Clear cache after file upload completion
          clearAllCache("file upload completion");
        })
        .catch((error) => {
          // 🗑️ Clear cache even on file upload failure
          clearAllCache("file upload failure");
        });
    } else {
      // Update status to completed if no files
      await propertyModel.findByIdAndUpdate(savedProperty._id, {
        uploadStatus: "completed",
      });
      // 🗑️ Clear cache after status update
      clearAllCache("upload status update");
    }
  } catch (error) {
    console.error("Create property error:", error);
    res.status(500).json({
      message: "Error creating property",
      error: error.message,
    });
  }
};

// Get all properties with counts
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      fileType,
      landType,
      tenure,
      onBoard,
      village,
      district,
      search,
      bypassCache,
    } = req.query;

    // Check for recent uploads and clear cache if needed
    const recentUploads = await propertyModel.countDocuments({
      uploadStatus: { $in: ["uploading", "pending"] },
      updatedAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    });

    if (recentUploads > 0 || bypassCache === "true") {
      clearAllCache("recent uploads detected or cache bypass requested");
    }

    // Create cache key based on query parameters
    const cacheKey = `properties_${page}_${limit}_${fileType || "all"}_${
      landType || "all"
    }_${tenure || "all"}_${village || "all"}_${district || "all"}_${
      search || "no-search"
    }`;

    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult && !bypassCache) {
      return res.status(200).json({
        ...cachedResult,
        message: "Properties fetched from cache",
      });
    }

    // Build filter object
    const filter = {};

    if (fileType) filter.fileType = fileType;
    if (landType) filter.landType = landType;
    if (tenure) filter.tenure = tenure;
    if (onBoard) filter.onBoard = onBoard;
    if (village) filter.village = new RegExp(village, "i");
    if (district) filter.district = new RegExp(district, "i");

    // Search across multiple fields
    if (search) {
      filter.$or = [
        { personWhoShared: new RegExp(search, "i") },
        { village: new RegExp(search, "i") },
        { district: new RegExp(search, "i") },
        { nearByLandmark: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    // Get properties with pagination
    const properties = await propertyModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    // Format properties to ensure arrays exist
    const formattedProperties = properties.map((property) => ({
      ...property,
      images: property.images || [],
      pdfs: property.pdfs || [],
      uploadStatus: property.uploadStatus || "completed",
      totalFiles: property.totalFiles || 0,
      uploadedFiles: property.uploadedFiles || 0,
    }));

    // Get total count for current filter
    const total = await propertyModel.countDocuments(filter);

    // Get counts by fileType for spotlight cards
    const fileTypeCounts = await propertyModel.aggregate([
      {
        $group: {
          _id: "$fileType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get total count of all properties
    const totalAllProperties = await propertyModel.countDocuments({});

    // Format counts for frontend
    const counts = {
      "Title Clear Lands": 0,
      "Dispute Lands": 0,
      "Govt. Dispute Lands": 0,
      "FP / NA": 0,
      Others: 0,
      "All Properties": totalAllProperties,
    };

    // Populate counts from aggregation result
    fileTypeCounts.forEach((item) => {
      if (counts.hasOwnProperty(item._id)) {
        counts[item._id] = item.count;
      }
    });

    const result = {
      data: formattedProperties,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProperties: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: counts,
    };

    // Cache the result
    cache.set(cacheKey, result, 300); // 5 minutes TTL

    res.status(200).json({
      ...result,
      message: bypassCache
        ? "Properties fetched from database"
        : "Properties fetched successfully",
    });
  } catch (error) {
    console.error("Get properties error:", error);
    res.status(500).json({
      message: "Error fetching properties",
      error: error.message,
    });
  }
};

// Get property by ID with caching
const getPropertyById = async (req, res) => {
  try {
    const id = req.params.id;
    const { bypassCache } = req.query;

    // Check cache first (unless bypassed)
    const cacheKey = `property_${id}`;
    const cachedProperty = cache.get(cacheKey);

    if (cachedProperty && bypassCache !== "true") {
      return res.status(200).json({
        message: "Property fetched from cache",
        data: cachedProperty,
      });
    }

    const property = await propertyModel.findById(id).lean();

    if (property) {
      // Ensure arrays exist
      if (!property.images) property.images = [];
      if (!property.pdfs) property.pdfs = [];
      if (!property.uploadStatus) property.uploadStatus = "completed";
      if (!property.totalFiles) property.totalFiles = 0;
      if (!property.uploadedFiles) property.uploadedFiles = 0;

      // Cache the property (unless bypassed)
      if (bypassCache !== "true") {
        cache.set(cacheKey, property, 300); // 5 minutes TTL
      }

      res.status(200).json({
        message:
          bypassCache === "true"
            ? "Property fetched from database (cache bypassed)"
            : "Property fetched successfully",
        data: property,
      });
    } else {
      res.status(404).json({ message: "Property not found" });
    }
  } catch (error) {
    console.error("Get property by ID error:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// Update property with async file processing
const updateProperty = async (req, res) => {
  const id = req.params.id;
  try {
    // 🗑️ Clear cache before update
    clearAllCache("property update start");

    // Get existing property to handle file updates
    const existingProperty = await propertyModel.findById(id);
    if (!existingProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    const updateData = { ...req.body };

    // Convert numeric fields
    if (updateData.srRate) updateData.srRate = Number(updateData.srRate);
    if (updateData.fpRate) updateData.fpRate = Number(updateData.fpRate);

    // Count new files to upload
    let newFilesCount = 0;
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];
      newFilesCount += imageFiles.length;
    }
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs)
        ? req.files.pdfs
        : [req.files.pdfs];
      newFilesCount += pdfFiles.length;
    }

    // Update property immediately without new files
    const updatedProperty = await propertyModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean();

    // 🗑️ Clear cache after property update
    clearAllCache("property data update");

    // Respond immediately to client
    res.status(200).json({
      data: updatedProperty,
      message:
        newFilesCount > 0
          ? "Property updated successfully. New files are being uploaded in the background."
          : "Property updated successfully",
      uploadStatus: newFilesCount > 0 ? "uploading" : "completed",
    });

    // Process new files asynchronously if any exist
    if (newFilesCount > 0) {
      // Update upload status
      await propertyModel.findByIdAndUpdate(id, {
        uploadStatus: "uploading",
        totalFiles: (existingProperty.totalFiles || 0) + newFilesCount,
        uploadedFiles: existingProperty.uploadedFiles || 0,
      });

      // 🗑️ Clear cache after status update
      clearAllCache("upload status update");

      processFilesAsync(id, req.files, true) // true indicates this is an update
        .then(() => {
          // 🗑️ Clear cache after file upload completion
          clearAllCache("file upload completion");
        })
        .catch((error) => {
          console.error(`File upload failed for property ${id}:`, error);
          // 🗑️ Clear cache even on file upload failure
          clearAllCache("file upload failure");
        });
    }
  } catch (error) {
    console.error("Update property error:", error);
    res.status(500).json({
      message: "Error updating property",
      error: error.message,
    });
  }
};

const toggleOnBoardStatus = async (req, res) => {
  const { id } = req.params;
  const { onBoard } = req.body;

  try {
    if (typeof onBoard !== "boolean") {
      return res
        .status(400)
        .json({ message: "'onBoard' must be a boolean value" });
    }

    const updatedProperty = await propertyModel.findByIdAndUpdate(
      id,
      { onBoard },
      { new: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Clear cache after toggling onBoard status
    clearAllCache("onBoard status update");

    res.status(200).json({
      message: `Property ${
        onBoard ? "marked as onboarded" : "removed from onboard"
      }`,
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Toggle onBoard status error:", error);
    res.status(500).json({
      message: "Error toggling onboard status",
      error: error.message,
    });
  }
};

// Delete property
const deleteProperty = async (req, res) => {
  const id = req.params.id;
  try {
    // 🗑️ Clear cache before deletion
    clearAllCache("property deletion start");

    const property = await propertyModel.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Delete files from Cloudinary
    const deletePromises = [];

    // Delete images
    if (property.images && property.images.length > 0) {
      property.images.forEach((image) => {
        if (image.publicId) {
          deletePromises.push(
            cloudinary.uploader.destroy(image.publicId, {
              resource_type: "image",
            })
          );
        }
      });
    }

    // Delete PDFs
    if (property.pdfs && property.pdfs.length > 0) {
      property.pdfs.forEach((pdf) => {
        if (pdf.publicId) {
          deletePromises.push(
            cloudinary.uploader.destroy(pdf.publicId, { resource_type: "raw" })
          );
        }
      });
    }

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    // Delete property from database
    const deletedProperty = await propertyModel.findByIdAndDelete(id).lean();

    // 🗑️ Clear cache after deletion
    clearAllCache("property deletion completion");

    res.status(200).json({
      data: deletedProperty,
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Delete property error:", error);
    res.status(500).json({
      message: "Error deleting property",
      error: error.message,
    });
  }
};

// Delete specific file from property
const deletePropertyFile = async (req, res) => {
  try {
    const { propertyId, fileType, publicId } = req.params;

    // 🗑️ Clear cache before file deletion
    clearAllCache("file deletion start");

    // Decode the publicId in case it's URL encoded
    const decodedPublicId = decodeURIComponent(publicId);

    const property = await propertyModel.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const fileArray = fileType === "image" ? property.images : property.pdfs;
    const fileIndex = fileArray.findIndex(
      (file) => file.publicId === decodedPublicId
    );

    if (fileIndex === -1) {
      return res.status(404).json({ message: "File not found" });
    }

    // Delete from Cloudinary
    const resourceType = fileType === "image" ? "image" : "raw";
    await cloudinary.uploader.destroy(decodedPublicId, {
      resource_type: resourceType,
    });

    // Remove from array
    fileArray.splice(fileIndex, 1);

    // Update property
    const updateField =
      fileType === "image" ? { images: fileArray } : { pdfs: fileArray };
    const updatedProperty = await propertyModel
      .findByIdAndUpdate(propertyId, updateField, { new: true })
      .lean();

    // 🗑️ Clear cache after file deletion
    clearAllCache("file deletion completion");

    res.status(200).json({
      data: updatedProperty,
      message: `${fileType} deleted successfully`,
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      message: "Error deleting file",
      error: error.message,
    });
  }
};

// Get upload status for a property (never cached for real-time data)
const getUploadStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Always fetch fresh data for upload status
    const property = await propertyModel
      .findById(id, "uploadStatus totalFiles uploadedFiles images pdfs")
      .lean();

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    clearAllCache("property update start");

    // Calculate actual file counts
    const actualImages = property.images ? property.images.length : 0;
    const actualPdfs = property.pdfs ? property.pdfs.length : 0;
    const actualTotalFiles = actualImages + actualPdfs;

    res.status(200).json({
      uploadStatus: property.uploadStatus || "completed",
      totalFiles: property.totalFiles || 0,
      uploadedFiles: property.uploadedFiles || 0,
      actualFiles: actualTotalFiles,
      actualImages: actualImages,
      actualPdfs: actualPdfs,
      progress:
        property.totalFiles > 0
          ? Math.round((property.uploadedFiles / property.totalFiles) * 100)
          : 100,
    });
  } catch (error) {
    console.error("Get upload status error:", error);
    res.status(500).json({
      message: "Error fetching upload status",
      error: error.message,
    });
  }
};

module.exports = {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  deletePropertyFile,
  getUploadStatus,
  toggleOnBoardStatus,
  clearAllCache, // Export the helper function for use in other modules
};
