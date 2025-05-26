const buyerModel = require("../models/BuyerModel");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // cache expires in


// Create a new buyer
const createBuyer = async (req, res) => {
  try {
    const buyer = new buyerModel(req.body);
    await buyer.save();

    // Clear cache when new buyer is created
    cache.flushAll();

    res.status(201).json({
      data: buyer,
      message: "Buyer created successfully",
    });
  } catch (error) {
    console.error("Create buyer error:", error);
    res.status(500).json({
      message: "Error creating buyer",
      error: error.message,
    });
  }
};

// Get all buyers with pagination, search, filtering, and caching
const getAllBuyers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      groups, // comma-separated groups for filtering
    } = req.query;

    // Create cache key based on query parameters
    const cacheKey = `buyers_${page}_${limit}_${search || 'no-search'}_${groups || 'no-groups'}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    // Build filter object
    const filter = {};

    // Search across multiple fields
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { contact: new RegExp(search, "i") },
        { address: new RegExp(search, "i") },
        { workarea: new RegExp(search, "i") },
        { notes: new RegExp(search, "i") },
      ];
    }

    // Filter by groups
    if (groups) {
      const groupArray = groups.split(',').map(g => g.trim());
      filter.groups = { $in: groupArray };
    }

    const skip = (page - 1) * limit;

    // Get buyers with pagination
    const buyers = await buyerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    // Get total count for current filter
    const total = await buyerModel.countDocuments(filter);

    // Get counts by groups for statistics
    const groupCounts = await buyerModel.aggregate([
      {
        $unwind: {
          path: "$groups",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: "$groups",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total count of all buyers
    const totalAllBuyers = await buyerModel.countDocuments({});

    // Format counts for frontend
    const counts = {
      "Title Clear Lands": 0,
      "Dispute Lands": 0,
      "Govt. Dispute Lands": 0,
      "FP / NA": 0,
      "Others": 0,
      "All Buyers": totalAllBuyers,
    };

    // Populate counts from aggregation result
    groupCounts.forEach((item) => {
      if (item._id && counts.hasOwnProperty(item._id)) {
        counts[item._id] = item.count;
      }
    });

    const result = {
      data: buyers,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBuyers: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: counts,
      message: "Buyers fetched successfully",
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get all buyers error:", error);
    res.status(500).json({
      message: "Error fetching buyers",
      error: error.message,
    });
  }
};

// Get buyer by ID with caching
const getBuyerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Create cache key for individual buyer
    const cacheKey = `buyer_${id}`;
    
    // Check cache first
    const cachedBuyer = cache.get(cacheKey);
    if (cachedBuyer) {
      return res.status(200).json(cachedBuyer);
    }

    const buyer = await buyerModel.findById(id).lean();
    
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    const result = {
      data: buyer,
      message: "Buyer fetched successfully",
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get buyer by ID error:", error);
    res.status(500).json({
      message: "Error fetching buyer",
      error: error.message,
    });
  }
};

// Update buyer by ID
const updateBuyer = async (req, res) => {
  try {
    const { id } = req.params;
    const buyer = await buyerModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    // Clear cache when buyer is updated
    cache.flushAll();

    res.status(200).json({
      data: buyer,
      message: "Buyer updated successfully",
    });
  } catch (error) {
    console.error("Update buyer error:", error);
    res.status(500).json({
      message: "Error updating buyer",
      error: error.message,
    });
  }
};

// Delete buyer by ID
const deleteBuyer = async (req, res) => {
  try {
    const { id } = req.params;
    const buyer = await buyerModel.findByIdAndDelete(id);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    // Clear cache when buyer is deleted
    cache.flushAll();

    res.status(200).json({ message: "Buyer deleted successfully" });
  } catch (error) {
    console.error("Delete buyer error:", error);
    res.status(500).json({
      message: "Error deleting buyer",
      error: error.message,
    });
  }
};

module.exports = {
  createBuyer,
  getAllBuyers,
  getBuyerById,
  updateBuyer,
  deleteBuyer,
};
