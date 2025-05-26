const propertyModel = require("../models/PropertyModel");
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

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (
  fileBuffer,
  fileName,
  resourceType = "auto"
) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: `properties/${Date.now()}_${fileName}`,
        folder: "properties",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            originalName: fileName,
          });
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Create property
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
    };

    // Handle image uploads
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      for (const imageFile of imageFiles) {
        try {
          const uploadResult = await uploadToCloudinary(
            imageFile.data,
            imageFile.name,
            "image"
          );
          property.images.push(uploadResult);
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
        }
      }
    }

    // Handle PDF uploads
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs)
        ? req.files.pdfs
        : [req.files.pdfs];

      for (const pdfFile of pdfFiles) {
        try {
          const uploadResult = await uploadToCloudinary(
            pdfFile.data,
            pdfFile.name,
            "raw"
          );
          property.pdfs.push(uploadResult);
        } catch (uploadError) {
          console.error("PDF upload error:", uploadError);
        }
      }
    }

    const savedProperty = await propertyModel.create(property);

    if (savedProperty) {
      res.status(201).json({
        message: "Property created successfully",
        property: savedProperty,
      });
    } else {
      res.status(400).json({ message: "Property creation failed" });
    }
  } catch (error) {
    console.error("Create property error:", error);
    res.status(500).json({
      message: "Error creating property",
      error: error.message,
    });
  }
};

// Get all properties
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      fileType,
      landType,
      tenure,
      village,
      district,
      search,
    } = req.query;

    const cacheKey = `properties:${page}:${limit}:${fileType}:${landType}:${tenure}:${village}:${district}:${search}`;

    // Check if cached
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        message: "Properties fetched from cache",
      });
    }

    // Build filter object
    const filter = {};
    if (fileType) filter.fileType = fileType;
    if (landType) filter.landType = landType;
    if (tenure) filter.tenure = tenure;
    if (village) filter.village = new RegExp(village, "i");
    if (district) filter.district = new RegExp(district, "i");

    if (search) {
      filter.$or = [
        { personWhoShared: new RegExp(search, "i") },
        { village: new RegExp(search, "i") },
        { district: new RegExp(search, "i") },
        { nearByLandmark: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const properties = await propertyModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    const total = await propertyModel.countDocuments(filter);

    const fileTypeCounts = await propertyModel.aggregate([
      {
        $group: {
          _id: "$fileType",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalAllProperties = await propertyModel.countDocuments({});

    const counts = {
      "Title Clear Lands": 0,
      "Dispute Lands": 0,
      "Govt. Dispute Lands": 0,
      "FP / NA": 0,
      Others: 0,
      "All Properties": totalAllProperties,
    };

    fileTypeCounts.forEach((item) => {
      if (counts.hasOwnProperty(item._id)) {
        counts[item._id] = item.count;
      }
    });

    const responseData = {
      data: properties,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProperties: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: counts,
    };

    // Set to cache
    cache.set(cacheKey, responseData);

    res.status(200).json({
      ...responseData,
      message: "Properties fetched successfully",
    });
  } catch (error) {
    console.error("Get properties error:", error);
    res.status(500).json({
      message: "Error fetching properties",
      error: error.message,
    });
  }
};


// Get property by ID
const getPropertyById = async (req, res) => {
  try {
    const id = req.params.id;

    const cacheKey = `property:${id}`;

    // Try to get property from cache
    const cachedProperty = cache.get(cacheKey);
    if (cachedProperty) {
      return res.status(200).json({
        message: "Property fetched from cache",
        data: cachedProperty,
      });
    }

    // Fetch from DB if not in cache
    const property = await propertyModel.findById(id).lean();

    if (property) {
      cache.set(cacheKey, property); // Store in cache
      return res.status(200).json({
        message: "Property fetched successfully",
        data: property,
      });
    } else {
      return res.status(404).json({ message: "Property not found" });
    }
  } catch (error) {
    console.error("Get property by ID error:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// Update property
const updateProperty = async (req, res) => {
  const id = req.params.id;
  try {
    // Get existing property to handle file updates
    const existingProperty = await propertyModel.findById(id);
    if (!existingProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    const updateData = { ...req.body };

    // Convert numeric fields
    if (updateData.srRate) updateData.srRate = Number(updateData.srRate);
    if (updateData.fpRate) updateData.fpRate = Number(updateData.fpRate);

    // Handle new image uploads
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];
      const newImages = [];

      for (const imageFile of imageFiles) {
        try {
          const uploadResult = await uploadToCloudinary(
            imageFile.data,
            imageFile.name,
            "image"
          );
          newImages.push(uploadResult);
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
        }
      }

      updateData.images = [...existingProperty.images, ...newImages];
    }

    // Handle new PDF uploads
    if (req.files && req.files.pdfs) {
      const pdfFiles = Array.isArray(req.files.pdfs)
        ? req.files.pdfs
        : [req.files.pdfs];
      const newPdfs = [];

      for (const pdfFile of pdfFiles) {
        try {
          const uploadResult = await uploadToCloudinary(
            pdfFile.data,
            pdfFile.name,
            "raw"
          );
          newPdfs.push(uploadResult);
        } catch (uploadError) {
          console.error("PDF upload error:", uploadError);
        }
      }

      updateData.pdfs = [...existingProperty.pdfs, ...newPdfs];
    }

    const updatedProperty = await propertyModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean();

    res.status(200).json({
      data: updatedProperty,
      message: "Property updated successfully",
    });
  } catch (error) {
    console.error("Update property error:", error);
    res.status(500).json({
      message: "Error updating property",
      error: error.message,
    });
  }
};

// Delete property
const deleteProperty = async (req, res) => {
  const id = req.params.id;
  try {
    const property = await propertyModel.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Delete files from Cloudinary
    const deletePromises = [];

    // Delete images
    property.images.forEach((image) => {
      if (image.publicId) {
        deletePromises.push(
          cloudinary.uploader.destroy(image.publicId, {
            resource_type: "image",
          })
        );
      }
    });

    // Delete PDFs
    property.pdfs.forEach((pdf) => {
      if (pdf.publicId) {
        deletePromises.push(
          cloudinary.uploader.destroy(pdf.publicId, { resource_type: "raw" })
        );
      }
    });

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    // Delete property from database
    const deletedProperty = await propertyModel.findByIdAndDelete(id).lean();

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

module.exports = {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  deletePropertyFile,
};
