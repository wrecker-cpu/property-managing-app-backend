const walletPropertyModel = require("../models/WalletPropertyModel")
const cloudinary = require("cloudinary").v2
const NodeCache = require("node-cache")
const cache = new NodeCache({ stdTTL: 300 }) // cache expires in 5 minutes

require("dotenv").config()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (fileBuffer, fileName, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: `Wallet-Properties/${Date.now()}_${fileName}`,
        folder: "WalletProperties",
      },
      (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            originalName: fileName,
          })
        }
      },
    )
    uploadStream.end(fileBuffer)
  })
}

// Create walletProperty
const createwalletProperty = async (req, res) => {
  try {
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
    }

    // Handle image uploads
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images]

      for (const imageFile of imageFiles) {
        try {
          const uploadResult = await uploadToCloudinary(imageFile.data, imageFile.name, "image")
          walletProperty.images.push(uploadResult)
        } catch (uploadError) {
          console.error("Image upload error:", uploadError)
        }
      }
    }

    // Handle PDF uploads
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs) ? req.files.pdfs : [req.files.pdfs]

      for (const pdfFile of pdfFiles) {
        try {
          const uploadResult = await uploadToCloudinary(pdfFile.data, pdfFile.name, "raw")
          walletProperty.pdfs.push(uploadResult)
        } catch (uploadError) {
          console.error("PDF upload error:", uploadError)
        }
      }
    }

    const savedwalletProperty = await walletPropertyModel.create(walletProperty)

    // Clear cache when new property is created
    cache.flushAll()

    if (savedwalletProperty) {
      res.status(201).json({
        message: "Wallet property created successfully",
        data: savedwalletProperty,
      })
    } else {
      res.status(400).json({ message: "Wallet property creation failed" })
    }
  } catch (error) {
    console.error("Create wallet property error:", error)
    res.status(500).json({
      message: "Error creating wallet property",
      error: error.message,
    })
  }
}

// Get all wallet properties with pagination, search, filtering, and caching
const getAllWalletProperties = async (req, res) => {
  try {
    const { page = 1, limit = 9, propertyCategory, fileType, landType, tenure, village, district, search } = req.query

    // Create cache key based on query parameters
    const cacheKey = `walletproperties_${page}_${limit}_${propertyCategory || "all"}_${fileType || "all"}_${landType || "all"}_${tenure || "all"}_${village || "all"}_${district || "all"}_${search || "no-search"}`

    // Check cache first
    const cachedResult = cache.get(cacheKey)
    if (cachedResult) {
      return res.status(200).json({
        ...cachedResult,
        message: "Wallet properties fetched from cache",
      })
    }

    // Build filter object
    const filter = {}
    if (propertyCategory) filter.propertyCategory = propertyCategory
    if (fileType) filter.fileType = fileType
    if (landType) filter.landType = landType
    if (tenure) filter.tenure = tenure
    if (village) filter.village = new RegExp(village, "i")
    if (district) filter.district = new RegExp(district, "i")

    // Search across multiple fields
    if (search) {
      filter.$or = [
        { personWhoShared: new RegExp(search, "i") },
        { village: new RegExp(search, "i") },
        { district: new RegExp(search, "i") },
        { nearByLandmark: new RegExp(search, "i") },
      ]
    }

    const skip = (page - 1) * limit

    // Get properties with pagination
    const properties = await walletPropertyModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean()

    // Get total count for current filter
    const total = await walletPropertyModel.countDocuments(filter)

    // Get counts by fileType for spotlight cards
    const fileTypeCounts = await walletPropertyModel.aggregate([
      ...(propertyCategory ? [{ $match: { propertyCategory } }] : []),
      {
        $group: {
          _id: "$fileType",
          count: { $sum: 1 },
        },
      },
    ])

    // Get total count for the specific category or all
    const categoryFilter = propertyCategory ? { propertyCategory } : {}
    const totalCategoryProperties = await walletPropertyModel.countDocuments(categoryFilter)

    // Format counts for frontend
    const counts = {
      "Title Clear Lands": 0,
      "Dispute Lands": 0,
      "Govt. Dispute Lands": 0,
      "FP / NA": 0,
      Others: 0,
      "All Properties": totalCategoryProperties,
    }

    // Populate counts from aggregation result
    fileTypeCounts.forEach((item) => {
      if (counts.hasOwnProperty(item._id)) {
        counts[item._id] = item.count
      }
    })

    const result = {
      data: properties,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProperties: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: counts,
    }

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300)

    res.status(200).json({
      ...result,
      message: "Wallet properties fetched successfully",
    })
  } catch (error) {
    console.error("Get wallet properties error:", error)
    res.status(500).json({
      message: "Error fetching wallet properties",
      error: error.message,
    })
  }
}

// Get walletProperty by ID with caching
const getwalletPropertyById = async (req, res) => {
  try {
    const id = req.params.id

    // Create cache key for individual property
    const cacheKey = `walletProperty_${id}`

    // Check cache first
    const cachedProperty = cache.get(cacheKey)
    if (cachedProperty) {
      return res.status(200).json({
        message: "Wallet property fetched from cache",
        data: cachedProperty,
      })
    }

    const walletProperty = await walletPropertyModel.findById(id).lean()

    if (walletProperty) {
      // Cache the result for 5 minutes
      cache.set(cacheKey, walletProperty, 300)

      res.status(200).json({
        message: "Wallet property fetched successfully",
        data: walletProperty,
      })
    } else {
      res.status(404).json({ message: "Wallet property not found" })
    }
  } catch (error) {
    console.error("Get wallet property by ID error:", error)
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    })
  }
}

// Update walletProperty
const updatewalletProperty = async (req, res) => {
  const id = req.params.id
  try {
    // Get existing walletProperty to handle file updates
    const existingwalletProperty = await walletPropertyModel.findById(id)
    if (!existingwalletProperty) {
      return res.status(404).json({ message: "Wallet property not found" })
    }

    const updateData = { ...req.body }

    // Convert numeric fields
    if (updateData.srRate) updateData.srRate = Number(updateData.srRate)
    if (updateData.fpRate) updateData.fpRate = Number(updateData.fpRate)

    // Handle new image uploads
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images]
      const newImages = []

      for (const imageFile of imageFiles) {
        try {
          const uploadResult = await uploadToCloudinary(imageFile.data, imageFile.name, "image")
          newImages.push(uploadResult)
        } catch (uploadError) {
          console.error("Image upload error:", uploadError)
        }
      }

      updateData.images = [...existingwalletProperty.images, ...newImages]
    }

    // Handle new PDF uploads
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs) ? req.files.pdfs : [req.files.pdfs]
      const newPdfs = []

      for (const pdfFile of pdfFiles) {
        try {
          const uploadResult = await uploadToCloudinary(pdfFile.data, pdfFile.name, "raw")
          newPdfs.push(uploadResult)
        } catch (uploadError) {
          console.error("PDF upload error:", uploadError)
        }
      }

      updateData.pdfs = [...existingwalletProperty.pdfs, ...newPdfs]
    }

    const updatedwalletProperty = await walletPropertyModel.findByIdAndUpdate(id, updateData, { new: true }).lean()

    // Clear cache when property is updated
    cache.flushAll()

    res.status(200).json({
      data: updatedwalletProperty,
      message: "Wallet property updated successfully",
    })
  } catch (error) {
    console.error("Update wallet property error:", error)
    res.status(500).json({
      message: "Error updating wallet property",
      error: error.message,
    })
  }
}

// Delete walletProperty
const deletewalletProperty = async (req, res) => {
  const id = req.params.id
  try {
    const walletProperty = await walletPropertyModel.findById(id)

    if (!walletProperty) {
      return res.status(404).json({ message: "Wallet property not found" })
    }

    // Delete files from Cloudinary
    const deletePromises = []

    // Delete images
    walletProperty.images.forEach((image) => {
      if (image.publicId) {
        deletePromises.push(cloudinary.uploader.destroy(image.publicId, { resource_type: "image" }))
      }
    })

    // Delete PDFs
    walletProperty.pdfs.forEach((pdf) => {
      if (pdf.publicId) {
        deletePromises.push(cloudinary.uploader.destroy(pdf.publicId, { resource_type: "raw" }))
      }
    })

    // Wait for all deletions to complete
    await Promise.all(deletePromises)

    // Delete walletProperty from database
    const deletedwalletProperty = await walletPropertyModel.findByIdAndDelete(id).lean()

    // Clear cache when property is deleted
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

// Delete specific file from walletProperty
const deletewalletPropertyFile = async (req, res) => {
  try {
    const { walletPropertyId, fileType, publicId } = req.params

    // Decode the publicId in case it's URL encoded
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

    // Delete from Cloudinary
    const resourceType = fileType === "image" ? "image" : "raw"
    await cloudinary.uploader.destroy(decodedPublicId, { resource_type: resourceType })

    // Remove from array
    fileArray.splice(fileIndex, 1)

    // Update walletProperty
    const updateField = fileType === "image" ? { images: fileArray } : { pdfs: fileArray }
    const updatedwalletProperty = await walletPropertyModel
      .findByIdAndUpdate(walletPropertyId, updateField, {
        new: true,
      })
      .lean()

    // Clear cache when file is deleted
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

module.exports = {
  createwalletProperty,
  getAllWalletProperties,
  getwalletPropertyById,
  updatewalletProperty,
  deletewalletProperty,
  deletewalletPropertyFile,
}
