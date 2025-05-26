const notesModel = require("../models/NotesModel");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // cache expires in

// Create a new notes
const createnotes = async (req, res) => {
  try {
    const notes = new notesModel(req.body);
    await notes.save();

    // Clear cache when new notes is created
    cache.flushAll();

    res.status(201).json({
      data: notes,
      message: "notes created successfully",
    });
  } catch (error) {
    console.error("Create notes error:", error);
    res.status(500).json({
      message: "Error creating notes",
      error: error.message,
    });
  }
};

// Get all notes with pagination, search, filtering, and caching
const getAllnotes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, createdFrom, createdTo } = req.query;

    // Create cache key based on query parameters
    const cacheKey = `notes_${page}_${limit}_${search || "no-search"}_${
      createdFrom || createdTo || "no-date"
    }`;

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
        { title: new RegExp(search, "i") },
        { note: new RegExp(search, "i") },
      ];
    }

    if (createdFrom || createdTo) {
      filter.createdAt = {};
      if (createdFrom) {
        const fromDate = new Date(createdFrom);
        if (!isNaN(fromDate)) filter.createdAt.$gte = fromDate;
      }
      if (createdTo) {
        const toDate = new Date(createdTo);
        if (!isNaN(toDate)) filter.createdAt.$lte = new Date(createdTo);
      }
    }

    const skip = (page - 1) * limit;

    // Get notes with pagination
    const notes = await notesModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    // Get total count for current filter
    const total = await notesModel.countDocuments(filter);

    // Get total count of all notes
    const totalAllnotes = await notesModel.countDocuments({});

    const result = {
      data: notes,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalnotes: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts: totalAllnotes,
      message: "notes fetched successfully",
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get all notes error:", error);
    res.status(500).json({
      message: "Error fetching notes",
      error: error.message,
    });
  }
};

// Get notes by ID with caching
const getnotesById = async (req, res) => {
  try {
    const { id } = req.params;

    // Create cache key for individual notes
    const cacheKey = `notes_${id}`;

    // Check cache first
    const cachednotes = cache.get(cacheKey);
    if (cachednotes) {
      return res.status(200).json(cachednotes);
    }

    const notes = await notesModel.findById(id).lean();

    if (!notes) {
      return res.status(404).json({ message: "notes not found" });
    }

    const result = {
      data: notes,
      message: "notes fetched successfully",
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get notes by ID error:", error);
    res.status(500).json({
      message: "Error fetching notes",
      error: error.message,
    });
  }
};

// Update notes by ID
const updatenotes = async (req, res) => {
  try {
    const { id } = req.params;
    const notes = await notesModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!notes) {
      return res.status(404).json({ message: "notes not found" });
    }

    // Clear cache when notes is updated
    cache.flushAll();

    res.status(200).json({
      data: notes,
      message: "notes updated successfully",
    });
  } catch (error) {
    console.error("Update notes error:", error);
    res.status(500).json({
      message: "Error updating notes",
      error: error.message,
    });
  }
};

// Delete notes by ID
const deletenotes = async (req, res) => {
  try {
    const { id } = req.params;
    const notes = await notesModel.findByIdAndDelete(id);
    if (!notes) {
      return res.status(404).json({ message: "notes not found" });
    }

    // Clear cache when notes is deleted
    cache.flushAll();

    res.status(200).json({ message: "notes deleted successfully" });
  } catch (error) {
    console.error("Delete notes error:", error);
    res.status(500).json({
      message: "Error deleting notes",
      error: error.message,
    });
  }
};

module.exports = {
  createnotes,
  getAllnotes,
  getnotesById,
  updatenotes,
  deletenotes,
};
