const mapsModel = require("../models/MapsModel");
const { processFilesAsync } = require("../utils/fileProcessingService");
const cloudinary = require("cloudinary").v2;
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // cache expires in 5 minutes

require("dotenv").config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create maps with async file processing - FIXED VERSION
const createMaps = async (req, res) => {
  try {
    const { area, notes } = req.body;

    // Validate required fields
    if (!area || !area.trim()) {
      return res.status(400).json({
        message: "Area is required",
      });
    }

    // Create maps without files first
    const maps = {
      area: area.trim(),
      notes: notes || "",
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

    maps.totalFiles = totalFiles;

    // Save maps to database immediately
    const savedMaps = await mapsModel.create(maps);

    // Clear cache when new maps is created
    cache.flushAll();

    // Respond immediately to client
    res.status(201).json({
      message:
        "Maps created successfully. Files are being uploaded in the background.",
      maps: savedMaps,
      uploadStatus: totalFiles > 0 ? "uploading" : "completed",
    });

    // Process files asynchronously if any files exist
    if (totalFiles > 0) {
      // FIXED: Pass the correct type parameter "maps" to processFilesAsync
      processFilesAsync(savedMaps._id, req.files, false, "maps")
        .then(() => {
          console.log(`File upload completed for maps ${savedMaps._id}`);
          cache.flushAll(); // ADD THIS LINE
        })
        .catch((error) => {
          console.error(`File upload failed for maps ${savedMaps._id}:`, error);
          cache.flushAll(); // ADD THIS LINE TOO
        });
    } else {
      // Update status to completed if no files
      await mapsModel.findByIdAndUpdate(savedMaps._id, {
        uploadStatus: "completed",
      });
    }
  } catch (error) {
    console.error("Create maps error:", error);
    res.status(500).json({
      message: "Error creating maps",
      error: error.message,
    });
  }
};

// Update maps with async file processing - FIXED VERSION
const updateMaps = async (req, res) => {
  const id = req.params.id;
  try {
    // Get existing maps to handle file updates
    const existingMaps = await mapsModel.findById(id);
    if (!existingMaps) {
      return res.status(404).json({ message: "Maps not found" });
    }

    const updateData = { ...req.body };

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

    // Update maps immediately without new files
    const updatedMaps = await mapsModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean();

    // Clear cache when maps is updated
    cache.flushAll();

    // Respond immediately to client
    res.status(200).json({
      data: updatedMaps,
      message:
        newFilesCount > 0
          ? "Maps updated successfully. New files are being uploaded in the background."
          : "Maps updated successfully",
      uploadStatus: newFilesCount > 0 ? "uploading" : "completed",
    });

    // Process new files asynchronously if any exist
    if (newFilesCount > 0) {
      // Update upload status
      await mapsModel.findByIdAndUpdate(id, {
        uploadStatus: "uploading",
        totalFiles: (existingMaps.totalFiles || 0) + newFilesCount,
        uploadedFiles: existingMaps.uploadedFiles || 0,
      });

      // FIXED: Pass the correct type parameter "maps" to processFilesAsync
      processFilesAsync(id, req.files, true, "maps") // true indicates this is an update
        .then(() => {
          console.log(`File upload completed for maps ${id}`);
          cache.flushAll(); // ADD THIS LINE
        })
        .catch((error) => {
          console.error(`File upload failed for maps ${id}:`, error);
          cache.flushAll(); // ADD THIS LINE
        });
    }
  } catch (error) {
    console.error("Update maps error:", error);
    res.status(500).json({
      message: "Error updating maps",
      error: error.message,
    });
  }
};

// Get all maps with pagination, search, and caching
// Get all maps with pagination, search, and caching
const getAllMaps = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      search,
      recycleBin,
      onBoard,
      bypassCache,
    } = req.query;



    // Check for recent uploads (last 2 minutes)
    const recentUploads = await mapsModel.countDocuments({
      uploadStatus: { $in: ["uploading", "pending"] },
      updatedAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    });

    // Clear cache if recent uploads detected or bypassCache requested
    if (recentUploads > 0 || bypassCache === "true") {
      cache.flushAll();
      console.log("🗑️ Cache cleared due to recent uploads");
    }

    // Create cache key
    const cacheKey = `maps_${page}_${limit}_${search || "no-search"}_${recycleBin || "all"}_${onBoard || "all"}`;

    // Check cache (will be empty if cleared above)
    const cachedResult = cache.get(cacheKey);
    if (cachedResult && !bypassCache) {
      return res.status(200).json({
        ...cachedResult,
        message: "Maps fetched from cache",
      });
    }

    // Fetch from database
    const filter = {};
    if (search) {
      filter.$or = [
        { area: new RegExp(search, "i") },
        { notes: new RegExp(search, "i") },
      ];
    }
    if (recycleBin === "true") {
      filter.recycleBin = true;
    } else if (recycleBin === "false") {
      filter.$or = [{ recycleBin: false }, { recycleBin: { $exists: false } }];
    }
    if (onBoard) filter.onBoard = onBoard;

    const skip = (page - 1) * limit;
    const maps = await mapsModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    const total = await mapsModel.countDocuments(filter);
    
    // Get total count based on recycleBin parameter
    let totalAllMaps;
    if (recycleBin === "true") {
      totalAllMaps = await mapsModel.countDocuments({ recycleBin: true });
    } else if (recycleBin === "false") {
      totalAllMaps = await mapsModel.countDocuments({
        $or: [{ recycleBin: false }, { recycleBin: { $exists: false } }]
      });
    } else {
      // If recycleBin is not specified, count all maps
      totalAllMaps = await mapsModel.countDocuments({});
    }

    const result = {
      data: maps,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalMaps: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: totalAllMaps,
    };

    // Cache the fresh result
    cache.set(cacheKey, result, 300);

    res.status(200).json({
      ...result,
      message: bypassCache
        ? "Maps fetched from database"
        : "Maps fetched successfully",
    });
  } catch (error) {
    console.error("Get maps error:", error);
    res.status(500).json({
      message: "Error fetching maps",
      error: error.message,
    });
  }
};

// Get maps by ID with caching
const getMapsById = async (req, res) => {
  try {
    const id = req.params.id;

    // Create cache key for individual maps
    const cacheKey = `maps_${id}`;

    // Check cache first
    const cachedMaps = cache.get(cacheKey);
    if (cachedMaps) {
      return res.status(200).json({
        message: "Maps fetched from cache",
        data: cachedMaps,
      });
    }

    const maps = await mapsModel.findById(id).lean();

    if (maps) {
      // Cache the result for 5 minutes
      cache.set(cacheKey, maps, 300);

      res.status(200).json({
        message: "Maps fetched successfully",
        data: maps,
      });
    } else {
      res.status(404).json({ message: "Maps not found" });
    }
  } catch (error) {
    console.error("Get maps by ID error:", error);
    res.status(500).json({
      message: "Server Error",
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

    const updatedProperty = await mapsModel.findByIdAndUpdate(
      id,
      { onBoard },
      { new: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({ message: "Maps Property not found" });
    }

    // Clear cache after toggling onBoard status
    cache.flushAll();

    res.status(200).json({
      message: `Maps Property ${
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

const moveToRecycleBin = async (req, res) => {
  const { id } = req.params;
  const { recycleBin } = req.body;

  try {
    if (typeof recycleBin !== "boolean") {
      return res
        .status(400)
        .json({ message: "'recycleBin' must be a boolean value" });
    }

    const updatedMaps = await mapsModel.findByIdAndUpdate(
      id,
      { recycleBin },
      { new: true }
    );

    if (!updatedMaps) {
      return res.status(404).json({ message: "Maps not found" });
    }

    // Clear cache after toggling onBoard status
    cache.flushAll();

    res.status(200).json({
      message: `Maps Property ${
        recycleBin ? "Moved To Recycle Bin" : "removed from Recycle Bin"
      }`,
      data: updateMaps,
    });
  } catch (error) {
    console.error("Moving Recycle Bin status error:", error);
    res.status(500).json({
      message: "Error Moving Property To Recycle Bin",
      error: error.message,
    });
  }
};

// Delete maps
const deleteMaps = async (req, res) => {
  const id = req.params.id;
  try {
    const maps = await mapsModel.findById(id);

    if (!maps) {
      return res.status(404).json({ message: "Maps not found" });
    }

    // Delete files from Cloudinary
    const deletePromises = [];

    // Delete images
    maps.images.forEach((image) => {
      if (image.publicId) {
        deletePromises.push(
          cloudinary.uploader.destroy(image.publicId, {
            resource_type: "image",
          })
        );
      }
    });

    // Delete PDFs
    maps.pdfs.forEach((pdf) => {
      if (pdf.publicId) {
        deletePromises.push(
          cloudinary.uploader.destroy(pdf.publicId, { resource_type: "raw" })
        );
      }
    });

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    // Delete maps from database
    const deletedMaps = await mapsModel.findByIdAndDelete(id).lean();

    // Clear cache when maps is deleted
    cache.flushAll();

    res.status(200).json({
      data: deletedMaps,
      message: "Maps deleted successfully",
    });
  } catch (error) {
    console.error("Delete maps error:", error);
    res.status(500).json({
      message: "Error deleting maps",
      error: error.message,
    });
  }
};

// Delete specific file from maps - FIXED VERSION
const deleteMapsFile = async (req, res) => {
  try {
    const { mapsId, fileType, publicId } = req.params;

    // Decode the publicId in case it's URL encoded
    const decodedPublicId = decodeURIComponent(publicId);

    const maps = await mapsModel.findById(mapsId);
    if (!maps) {
      return res.status(404).json({ message: "Maps not found" });
    }

    const fileArray = fileType === "image" ? maps.images : maps.pdfs;
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

    // Update maps
    const updateField =
      fileType === "image" ? { images: fileArray } : { pdfs: fileArray };
    const updatedMaps = await mapsModel
      .findByIdAndUpdate(mapsId, updateField, { new: true })
      .lean();

    // Clear cache when file is deleted
    cache.flushAll();

    res.status(200).json({
      data: updatedMaps,
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

// Get upload status for maps
const getUploadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const maps = await mapsModel
      .findById(id, "uploadStatus totalFiles uploadedFiles")
      .lean();

    if (!maps) {
      return res.status(404).json({ message: "Maps not found" });
    }

    res.status(200).json({
      uploadStatus: maps.uploadStatus || "completed",
      totalFiles: maps.totalFiles || 0,
      uploadedFiles: maps.uploadedFiles || 0,
      progress:
        maps.totalFiles > 0
          ? Math.round((maps.uploadedFiles / maps.totalFiles) * 100)
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
  createMaps,
  getAllMaps,
  getMapsById,
  updateMaps,
  deleteMaps,
  toggleOnBoardStatus,
  moveToRecycleBin,
  deleteMapsFile,
  getUploadStatus,
};
