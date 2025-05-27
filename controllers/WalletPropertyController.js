const walletPropertyModel = require("../models/WalletPropertyModel")
const { processFilesAsync } = require("../utils/fileProcessingService")
const cloudinary = require("cloudinary").v2
const NodeCache = require("node-cache")
const cache = new NodeCache({ stdTTL: 300 })

require("dotenv").config()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ENHANCED: Create wallet property with detailed logging
const createwalletProperty = async (req, res) => {
  try {
    console.log("🚀 Creating wallet property...")
    console.log("📝 Request body:", req.body)
    console.log("📁 Request files:", {
      images: req.files?.images ? (Array.isArray(req.files.images) ? req.files.images.length : 1) : 0,
      pdfs: req.files?.pdfs ? (Array.isArray(req.files.pdfs) ? req.files.pdfs.length : 1) : 0,
    })

    const {
      propertyCategory,
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
    } = req.body

    // Validate required fields
    if (!propertyCategory || !fileType || !landType || !tenure || !personWhoShared || !contactNumber) {
      return res.status(400).json({
        message:
          "Required fields missing: propertyCategory, fileType, landType, tenure, personWhoShared, contactNumber",
      })
    }

    // Create wallet property without files first
    const walletProperty = {
      propertyCategory,
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
    }

    // Count total files to upload
    let totalFiles = 0
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images]
      totalFiles += imageFiles.length
      console.log(`📸 Found ${imageFiles.length} images to upload`)
    }
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs) ? req.files.pdfs : [req.files.pdfs]
      totalFiles += pdfFiles.length
      console.log(`📄 Found ${pdfFiles.length} PDFs to upload`)
    }

    walletProperty.totalFiles = totalFiles
    console.log(`📊 Total files to upload: ${totalFiles}`)

    // Save wallet property to database immediately
    const savedwalletProperty = await walletPropertyModel.create(walletProperty)
    console.log(`💾 Wallet property saved with ID: ${savedwalletProperty._id}`)

    // Clear cache when new property is created
    cache.flushAll()

    // Respond immediately to client
    res.status(201).json({
      message: "Wallet property created successfully. Files are being uploaded in the background.",
      walletProperty: savedwalletProperty,
      uploadStatus: totalFiles > 0 ? "uploading" : "completed",
    })

    // Process files asynchronously if any files exist
    if (totalFiles > 0) {
      console.log(`🔄 Starting async file processing...`)

      // Update status to uploading
      await walletPropertyModel.findByIdAndUpdate(savedwalletProperty._id, {
        uploadStatus: "uploading",
      })

      // Process files with enhanced error handling
      processFilesAsync(savedwalletProperty._id, req.files, false, "wallet")
        .then((result) => {
          console.log(`✅ File upload completed for wallet property ${savedwalletProperty._id}`)
          console.log(`📊 Upload result:`, result)
          cache.flushAll()
        })
        .catch((error) => {
          console.error(`❌ File upload failed for wallet property ${savedwalletProperty._id}:`, error)
          cache.flushAll()
        })
    } else {
      // Update status to completed if no files
      await walletPropertyModel.findByIdAndUpdate(savedwalletProperty._id, {
        uploadStatus: "completed",
      })
      console.log(`✅ No files to upload, status set to completed`)
    }
  } catch (error) {
    console.error("💥 Create wallet property error:", error)
    res.status(500).json({
      message: "Error creating wallet property",
      error: error.message,
    })
  }
}

// ENHANCED: Update wallet property with detailed logging
const updatewalletProperty = async (req, res) => {
  const id = req.params.id
  try {
    console.log(`🔄 Updating wallet property ID: ${id}`)
    console.log("📁 Request files:", {
      images: req.files?.images ? (Array.isArray(req.files.images) ? req.files.images.length : 1) : 0,
      pdfs: req.files?.pdfs ? (Array.isArray(req.files.pdfs) ? req.files.pdfs.length : 1) : 0,
    })

    // Get existing wallet property to handle file updates
    const existingwalletProperty = await walletPropertyModel.findById(id)
    if (!existingwalletProperty) {
      return res.status(404).json({ message: "Wallet property not found" })
    }

    console.log(
      `📊 Existing property has ${existingwalletProperty.images?.length || 0} images and ${existingwalletProperty.pdfs?.length || 0} PDFs`,
    )

    const updateData = { ...req.body }

    // Convert numeric fields
    if (updateData.srRate) updateData.srRate = Number(updateData.srRate)
    if (updateData.fpRate) updateData.fpRate = Number(updateData.fpRate)

    // Count new files to upload
    let newFilesCount = 0
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images]
      newFilesCount += imageFiles.length
      console.log(`📸 Adding ${imageFiles.length} new images`)
    }
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs) ? req.files.pdfs : [req.files.pdfs]
      newFilesCount += pdfFiles.length
      console.log(`📄 Adding ${pdfFiles.length} new PDFs`)
    }

    console.log(`📊 Total new files to upload: ${newFilesCount}`)

    // Update wallet property immediately without new files
    const updatedwalletProperty = await walletPropertyModel.findByIdAndUpdate(id, updateData, { new: true }).lean()

    // Clear cache when property is updated
    cache.flushAll()

    // Respond immediately to client
    res.status(200).json({
      data: updatedwalletProperty,
      message:
        newFilesCount > 0
          ? "Wallet property updated successfully. New files are being uploaded in the background."
          : "Wallet property updated successfully",
      uploadStatus: newFilesCount > 0 ? "uploading" : "completed",
    })

    // Process new files asynchronously if any exist
    if (newFilesCount > 0) {
      console.log(`🔄 Starting async file processing for update...`)

      // Update upload status
      await walletPropertyModel.findByIdAndUpdate(id, {
        uploadStatus: "uploading",
        totalFiles: (existingwalletProperty.totalFiles || 0) + newFilesCount,
        uploadedFiles: existingwalletProperty.uploadedFiles || 0,
      })

      // Process files with enhanced error handling
      processFilesAsync(id, req.files, true, "wallet")
        .then((result) => {
          console.log(`✅ File upload completed for wallet property update ${id}`)
          console.log(`📊 Upload result:`, result)
          cache.flushAll()
        })
        .catch((error) => {
          console.error(`❌ File upload failed for wallet property update ${id}:`, error)
          cache.flushAll()
        })
    }
  } catch (error) {
    console.error("💥 Update wallet property error:", error)
    res.status(500).json({
      message: "Error updating wallet property",
      error: error.message,
    })
  }
}

// Get wallet property by ID with enhanced logging
const getwalletPropertyById = async (req, res) => {
  try {
    const id = req.params.id
    console.log(`🔍 Fetching wallet property ID: ${id}`)

    const cacheKey = `walletProperty_${id}`
    const cachedProperty = cache.get(cacheKey)
    if (cachedProperty) {
      console.log(`💨 Returning cached property`)
      return res.status(200).json({
        message: "Wallet property fetched from cache",
        data: cachedProperty,
      })
    }

    const walletProperty = await walletPropertyModel.findById(id).lean()

    if (walletProperty) {
      console.log(
        `📊 Property found with ${walletProperty.images?.length || 0} images and ${walletProperty.pdfs?.length || 0} PDFs`,
      )

      // Ensure arrays exist
      if (!walletProperty.images) walletProperty.images = []
      if (!walletProperty.pdfs) walletProperty.pdfs = []
      if (!walletProperty.uploadStatus) walletProperty.uploadStatus = "completed"
      if (!walletProperty.totalFiles) walletProperty.totalFiles = 0
      if (!walletProperty.uploadedFiles) walletProperty.uploadedFiles = 0

      cache.set(cacheKey, walletProperty, 300)

      res.status(200).json({
        message: "Wallet property fetched successfully",
        data: walletProperty,
      })
    } else {
      console.log(`❌ Property not found`)
      res.status(404).json({ message: "Wallet property not found" })
    }
  } catch (error) {
    console.error("💥 Get wallet property by ID error:", error)
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get all wallet properties (keeping existing implementation)
const getAllWalletProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      propertyCategory,
      fileType,
      landType,
      tenure,
      village,
      district,
      search,
      bypassCache,
    } = req.query

    const recentUploads = await walletPropertyModel.countDocuments({
      uploadStatus: { $in: ["uploading", "pending"] },
      updatedAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    })

    if (recentUploads > 0 || bypassCache === "true") {
      cache.flushAll()
      console.log("🗑️ Cache cleared due to recent uploads")
    }

    const cacheKey = `walletproperties_${page}_${limit}_${propertyCategory || "all"}_${fileType || "all"}_${landType || "all"}_${tenure || "all"}_${village || "all"}_${district || "all"}_${search || "no-search"}`

    const cachedResult = cache.get(cacheKey)
    if (cachedResult && !bypassCache) {
      return res.status(200).json({
        ...cachedResult,
        message: "Wallet properties fetched from cache",
      })
    }

    const filter = {}
    if (propertyCategory) filter.propertyCategory = propertyCategory
    if (fileType) filter.fileType = fileType
    if (landType) filter.landType = landType
    if (tenure) filter.tenure = tenure
    if (village) filter.village = new RegExp(village, "i")
    if (district) filter.district = new RegExp(district, "i")

    if (search) {
      filter.$or = [
        { personWhoShared: new RegExp(search, "i") },
        { village: new RegExp(search, "i") },
        { district: new RegExp(search, "i") },
        { nearByLandmark: new RegExp(search, "i") },
      ]
    }

    const skip = (page - 1) * limit

    const properties = await walletPropertyModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean()

    const formattedProperties = properties.map((property) => ({
      ...property,
      images: property.images || [],
      pdfs: property.pdfs || [],
      uploadStatus: property.uploadStatus || "completed",
      totalFiles: property.totalFiles || 0,
      uploadedFiles: property.uploadedFiles || 0,
    }))

    const total = await walletPropertyModel.countDocuments(filter)

    const fileTypeCounts = await walletPropertyModel.aggregate([
      ...(propertyCategory ? [{ $match: { propertyCategory } }] : []),
      {
        $group: {
          _id: "$fileType",
          count: { $sum: 1 },
        },
      },
    ])

    const categoryFilter = propertyCategory ? { propertyCategory } : {}
    const totalCategoryProperties = await walletPropertyModel.countDocuments(categoryFilter)

    const counts = {
      "Title Clear Lands": 0,
      "Dispute Lands": 0,
      "Govt. Dispute Lands": 0,
      "FP / NA": 0,
      Others: 0,
      "All Properties": totalCategoryProperties,
    }

    fileTypeCounts.forEach((item) => {
      if (counts.hasOwnProperty(item._id)) {
        counts[item._id] = item.count
      }
    })

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
    }

    cache.set(cacheKey, result, 300)

    res.status(200).json({
      ...result,
      message: bypassCache ? "Wallet properties fetched from database" : "Wallet properties fetched successfully",
    })
  } catch (error) {
    console.error("Get wallet properties error:", error)
    res.status(500).json({
      message: "Error fetching wallet properties",
      error: error.message,
    })
  }
}

// Delete wallet property (keeping existing implementation)
const deletewalletProperty = async (req, res) => {
  const id = req.params.id
  try {
    const walletProperty = await walletPropertyModel.findById(id)

    if (!walletProperty) {
      return res.status(404).json({ message: "Wallet property not found" })
    }

    const deletePromises = []

    if (walletProperty.images && walletProperty.images.length > 0) {
      walletProperty.images.forEach((image) => {
        if (image.publicId) {
          deletePromises.push(cloudinary.uploader.destroy(image.publicId, { resource_type: "image" }))
        }
      })
    }

    if (walletProperty.pdfs && walletProperty.pdfs.length > 0) {
      walletProperty.pdfs.forEach((pdf) => {
        if (pdf.publicId) {
          deletePromises.push(cloudinary.uploader.destroy(pdf.publicId, { resource_type: "raw" }))
        }
      })
    }

    await Promise.all(deletePromises)
    const deletedwalletProperty = await walletPropertyModel.findByIdAndDelete(id).lean()
    cache.flushAll()

    res.status(200).json({
      data: deletedwalletProperty,
      message: "Wallet property deleted successfully",
    })
  } catch (error) {
    console.error("Delete wallet property error:", error)
    res.status(500).json({
      message: "Error deleting wallet property",
      error: error.message,
    })
  }
}

// Delete specific file from wallet property (keeping existing implementation)
const deletewalletPropertyFile = async (req, res) => {
  try {
    const { walletPropertyId, fileType, publicId } = req.params
    const decodedPublicId = decodeURIComponent(publicId)

    const walletProperty = await walletPropertyModel.findById(walletPropertyId)
    if (!walletProperty) {
      return res.status(404).json({ message: "Wallet property not found" })
    }

    const fileArray = fileType === "image" ? walletProperty.images : walletProperty.pdfs
    const fileIndex = fileArray.findIndex((file) => file.publicId === decodedPublicId)

    if (fileIndex === -1) {
      return res.status(404).json({ message: "File not found" })
    }

    const resourceType = fileType === "image" ? "image" : "raw"
    await cloudinary.uploader.destroy(decodedPublicId, { resource_type: resourceType })

    fileArray.splice(fileIndex, 1)

    const updateField = fileType === "image" ? { images: fileArray } : { pdfs: fileArray }
    const updatedwalletProperty = await walletPropertyModel
      .findByIdAndUpdate(walletPropertyId, updateField, { new: true })
      .lean()

    cache.flushAll()

    res.status(200).json({
      data: updatedwalletProperty,
      message: `${fileType} deleted successfully`,
    })
  } catch (error) {
    console.error("Delete file error:", error)
    res.status(500).json({
      message: "Error deleting file",
      error: error.message,
    })
  }
}

// Get upload status for wallet property
const getUploadStatus = async (req, res) => {
  try {
    const { id } = req.params
    const walletProperty = await walletPropertyModel.findById(id, "uploadStatus totalFiles uploadedFiles").lean()

    if (!walletProperty) {
      return res.status(404).json({ message: "Wallet property not found" })
    }

    res.status(200).json({
      uploadStatus: walletProperty.uploadStatus || "completed",
      totalFiles: walletProperty.totalFiles || 0,
      uploadedFiles: walletProperty.uploadedFiles || 0,
      progress:
        walletProperty.totalFiles > 0
          ? Math.round((walletProperty.uploadedFiles / walletProperty.totalFiles) * 100)
          : 100,
    })
  } catch (error) {
    console.error("Get upload status error:", error)
    res.status(500).json({
      message: "Error fetching upload status",
      error: error.message,
    })
  }
}

module.exports = {
  createwalletProperty,
  getAllWalletProperties,
  getwalletPropertyById,
  updatewalletProperty,
  deletewalletProperty,
  deletewalletPropertyFile,
  getUploadStatus,
}
