const express = require("express");
const router = express.Router();
const propertyController = require("../controllers/PropertyController");

// Property routes
router.post("/", propertyController.createProperty);
router.get("/", propertyController.getAllProperties);
router.get("/:id", propertyController.getPropertyById);
router.patch("/:id/onboard", propertyController.toggleOnBoardStatus); // PATCH endpoint
router.put("/:id", propertyController.updateProperty);
router.delete("/:id", propertyController.deleteProperty);
router.delete(
  "/:propertyId/files/:fileType/:publicId",
  propertyController.deletePropertyFile
);

// Get upload status
router.get("/:id/upload-status", propertyController.getUploadStatus);

module.exports = router;
