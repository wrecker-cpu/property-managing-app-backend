const brokerModel = require("../models/BrokerModel");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // cache expires in


// Create a new broker
const createbroker = async (req, res) => {
  try {
    const broker = new brokerModel(req.body);
    await broker.save();

    // Clear cache when new broker is created
    cache.flushAll();

    res.status(201).json({
      data: broker,
      message: "broker created successfully",
    });
  } catch (error) {
    console.error("Create broker error:", error);
    res.status(500).json({
      message: "Error creating broker",
      error: error.message,
    });
  }
};

// Get all brokers with pagination, search, filtering, and caching
const getAllbrokers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      groups, // comma-separated groups for filtering
    } = req.query;

    // Create cache key based on query parameters
    const cacheKey = `brokers_${page}_${limit}_${search || 'no-search'}_${groups || 'no-groups'}`;
    
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

    // Get brokers with pagination
    const brokers = await brokerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    // Get total count for current filter
    const total = await brokerModel.countDocuments(filter);

    // Get counts by groups for statistics
    const groupCounts = await brokerModel.aggregate([
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

    // Get total count of all brokers
    const totalAllbrokers = await brokerModel.countDocuments({});

    // Format counts for frontend
    const counts = {
      "Title Clear Lands": 0,
      "Dispute Lands": 0,
      "Govt. Dispute Lands": 0,
      "FP / NA": 0,
      "Others": 0,
      "All brokers": totalAllbrokers,
    };

    // Populate counts from aggregation result
    groupCounts.forEach((item) => {
      if (item._id && counts.hasOwnProperty(item._id)) {
        counts[item._id] = item.count;
      }
    });

    const result = {
      data: brokers,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalbrokers: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: counts,
      message: "brokers fetched successfully",
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get all brokers error:", error);
    res.status(500).json({
      message: "Error fetching brokers",
      error: error.message,
    });
  }
};

// Get broker by ID with caching
const getbrokerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Create cache key for individual broker
    const cacheKey = `broker_${id}`;
    
    // Check cache first
    const cachedbroker = cache.get(cacheKey);
    if (cachedbroker) {
      return res.status(200).json(cachedbroker);
    }

    const broker = await brokerModel.findById(id).lean();
    
    if (!broker) {
      return res.status(404).json({ message: "broker not found" });
    }

    const result = {
      data: broker,
      message: "broker fetched successfully",
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get broker by ID error:", error);
    res.status(500).json({
      message: "Error fetching broker",
      error: error.message,
    });
  }
};

// Update broker by ID
const updatebroker = async (req, res) => {
  try {
    const { id } = req.params;
    const broker = await brokerModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!broker) {
      return res.status(404).json({ message: "broker not found" });
    }

    // Clear cache when broker is updated
    cache.flushAll();

    res.status(200).json({
      data: broker,
      message: "broker updated successfully",
    });
  } catch (error) {
    console.error("Update broker error:", error);
    res.status(500).json({
      message: "Error updating broker",
      error: error.message,
    });
  }
};

// Delete broker by ID
const deletebroker = async (req, res) => {
  try {
    const { id } = req.params;
    const broker = await brokerModel.findByIdAndDelete(id);
    if (!broker) {
      return res.status(404).json({ message: "broker not found" });
    }

    // Clear cache when broker is deleted
    cache.flushAll();

    res.status(200).json({ message: "broker deleted successfully" });
  } catch (error) {
    console.error("Delete broker error:", error);
    res.status(500).json({
      message: "Error deleting broker",
      error: error.message,
    });
  }
};

module.exports = {
  createbroker,
  getAllbrokers,
  getbrokerById,
  updatebroker,
  deletebroker,
};
