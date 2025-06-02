const express = require("express")
const MapsController = require("../controllers/MapsController")

const router = express.Router()

// Maps CRUD routes - using the same middleware as property routes
router.post("/", MapsController.createMaps)
router.get("/", MapsController.getAllMaps)
router.get("/:id", MapsController.getMapsById)
router.put("/:id", MapsController.updateMaps)
router.patch("/:id/onboard", MapsController.toggleOnBoardStatus);
router.delete("/:id", MapsController.deleteMaps)

// Delete specific file from maps
router.delete("/:mapsId/files/:fileType/:publicId", MapsController.deleteMapsFile)

// Get upload status
router.get("/:id/upload-status", MapsController.getUploadStatus)

module.exports = router
