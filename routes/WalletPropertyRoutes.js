const express = require("express");
const walletPropertyController = require("../controllers/WalletPropertyController");

const router = express.Router();

// walletProperty CRUD routes
router.post("/", walletPropertyController.createwalletProperty);
router.get("/", walletPropertyController.getAllWalletProperties);
router.get("/:id", walletPropertyController.getwalletPropertyById);
router.put("/:id", walletPropertyController.updatewalletProperty);
router.delete("/:id", walletPropertyController.deletewalletProperty);

// Delete specific file from wallet property
router.delete(
  "/:walletPropertyId/files/:fileType/:publicId",
  walletPropertyController.deletewalletPropertyFile,
)


// Get upload status
router.get("/:id/upload-status", walletPropertyController.getUploadStatus)

module.exports = router;
