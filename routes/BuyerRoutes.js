const express = require("express")
const BuyerController = require("../controllers/BuyerController")

const router = express.Router()

// Buyer CRUD routes
router.post("/", BuyerController.createBuyer)
router.get("/", BuyerController.getAllBuyers)
router.get("/:id", BuyerController.getBuyerById)
router.put("/:id", BuyerController.updateBuyer)
router.delete("/:id", BuyerController.deleteBuyer)

module.exports = router
