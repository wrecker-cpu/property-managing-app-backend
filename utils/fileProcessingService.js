const propertyModel = require("../models/PropertyModel")
const walletPropertyModel = require("../models/WalletPropertyModel")
const mapsModel = require("../models/MapsModel")
const cloudinary = require("cloudinary").v2

// Helper function to upload file to Cloudinary with optimized settings
const uploadToCloudinary = async (fileBuffer, fileName, resourceType = "auto", folder = "properties") => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: resourceType,
      public_id: `${folder}/${Date.now()}_${fileName}`,
      folder: folder,
    }

    // Optimize images
    if (resourceType === "image") {
      uploadOptions.quality = "auto:good"
      uploadOptions.fetch_format = "auto"
      uploadOptions.flags = "progressive"
      uploadOptions.transformation = [{ width: 1920, height: 1080, crop: "limit" }, { quality: "auto:good" }]
    }

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: fileName,
        })
      }
    })
    uploadStream.end(fileBuffer)
  })
}

// Get the appropriate model based on type
const getModel = (type) => {
  switch (type) {
    case "maps":
      return mapsModel
    case "wallet":
      return walletPropertyModel
    default:
      return propertyModel
  }
}

// Get the appropriate folder based on type
const getFolder = (type) => {
  switch (type) {
    case "maps":
      return "maps"
    case "wallet":
      return "wallet-properties"
    default:
      return "properties"
  }
}

// CRITICAL FIX: Process files asynchronously with proper database updates
const processFilesAsync = async (documentId, files, isUpdate = false, type = "property") => {
  try {
    console.log(`🚀 Starting file processing for ${type} ID: ${documentId}`)
    console.log(`📁 Files received:`, {
      images: files?.images ? (Array.isArray(files.images) ? files.images.length : 1) : 0,
      pdfs: files?.pdfs ? (Array.isArray(files.pdfs) ? files.pdfs.length : 1) : 0,
    })

    const Model = getModel(type)
    const folder = getFolder(type)

    // CRITICAL: Get fresh document from database
    const document = await Model.findById(documentId)
    if (!document) {
      throw new Error(`${type} not found with ID: ${documentId}`)
    }

    console.log(`📊 Current document state:`, {
      existingImages: document.images?.length || 0,
      existingPdfs: document.pdfs?.length || 0,
      uploadStatus: document.uploadStatus,
    })

    const uploadedImages = []
    const uploadedPdfs = []
    let uploadedCount = document.uploadedFiles || 0

    // Process images with actual upload logic
    if (files && files.images) {
      const imageFiles = Array.isArray(files.images) ? files.images : [files.images]
      console.log(`📸 Processing ${imageFiles.length} images...`)

      for (const imageFile of imageFiles) {
        try {
          console.log(`⬆️ Uploading image: ${imageFile.name}`)

          const uploadResult = await uploadToCloudinary(imageFile.data, imageFile.name, "image", folder)

          console.log(`✅ Image uploaded successfully:`, uploadResult.publicId)
          uploadedImages.push(uploadResult)
          uploadedCount++

          // Update progress in database
          await Model.findByIdAndUpdate(documentId, {
            uploadedFiles: uploadedCount,
          })
        } catch (uploadError) {
          console.error("❌ Image upload error:", uploadError)
        }
      }
    }

    // Process PDFs with actual upload logic
    if (files && files.pdfs) {
      const pdfFiles = Array.isArray(files.pdfs) ? files.pdfs : [files.pdfs]
      console.log(`📄 Processing ${pdfFiles.length} PDFs...`)

      for (const pdfFile of pdfFiles) {
        try {
          console.log(`⬆️ Uploading PDF: ${pdfFile.name}`)

          const uploadResult = await uploadToCloudinary(pdfFile.data, pdfFile.name, "raw", folder)

          console.log(`✅ PDF uploaded successfully:`, uploadResult.publicId)
          uploadedPdfs.push(uploadResult)
          uploadedCount++

          // Update progress in database
          await Model.findByIdAndUpdate(documentId, {
            uploadedFiles: uploadedCount,
          })
        } catch (uploadError) {
          console.error("❌ PDF upload error:", uploadError)
        }
      }
    }

    // CRITICAL FIX: Properly update document with uploaded files
    console.log(`💾 Updating document with ${uploadedImages.length} images and ${uploadedPdfs.length} PDFs`)

    // Get the current document again to ensure we have the latest state
    const currentDocument = await Model.findById(documentId)

    const updateData = {
      uploadStatus: "completed",
      uploadedFiles: uploadedCount,
    }

    if (isUpdate) {
      // For updates, append to existing arrays
      console.log(`🔄 Update mode: appending to existing files`)
      updateData.images = [...(currentDocument.images || []), ...uploadedImages]
      updateData.pdfs = [...(currentDocument.pdfs || []), ...uploadedPdfs]
    } else {
      // For new documents, combine existing with new
      console.log(`🆕 Create mode: setting file arrays`)
      updateData.images = [...(currentDocument.images || []), ...uploadedImages]
      updateData.pdfs = [...(currentDocument.pdfs || []), ...uploadedPdfs]
    }

    console.log(`📊 Final update data:`, {
      totalImages: updateData.images.length,
      totalPdfs: updateData.pdfs.length,
      uploadStatus: updateData.uploadStatus,
      uploadedFiles: updateData.uploadedFiles,
    })

    // CRITICAL: Use findByIdAndUpdate with proper options
    const updatedDocument = await Model.findByIdAndUpdate(documentId, updateData, {
      new: true, // Return the updated document
      runValidators: true, // Run schema validators
    })

    if (!updatedDocument) {
      throw new Error(`Failed to update ${type} with ID: ${documentId}`)
    }

    console.log(`🎉 File processing completed successfully for ${type} ID: ${documentId}`)
    console.log(`📊 Final document state:`, {
      images: updatedDocument.images?.length || 0,
      pdfs: updatedDocument.pdfs?.length || 0,
      uploadStatus: updatedDocument.uploadStatus,
      uploadedFiles: updatedDocument.uploadedFiles,
    })

    // VERIFICATION: Double-check the database was actually updated
    const verificationDoc = await Model.findById(documentId).lean()
    console.log(`🔍 Verification check:`, {
      imagesInDB: verificationDoc.images?.length || 0,
      pdfsInDB: verificationDoc.pdfs?.length || 0,
    })

    return { success: true, uploadedImages, uploadedPdfs, document: updatedDocument }
  } catch (error) {
    console.error("💥 File processing error:", error)

    // Update status to failed
    const Model = getModel(type)
    try {
      await Model.findByIdAndUpdate(documentId, {
        uploadStatus: "failed",
      })
    } catch (updateError) {
      console.error("Failed to update status to failed:", updateError)
    }

    throw error
  }
}

module.exports = {
  processFilesAsync,
  uploadToCloudinary,
}
