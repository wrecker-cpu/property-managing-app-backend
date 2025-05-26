const express = require("express")
const BrokerController = require("../controllers/BrokerController")

const router = express.Router()

// broker CRUD routes
router.post("/", BrokerController.createbroker)
router.get("/", BrokerController.getAllbrokers)
router.get("/:id", BrokerController.getbrokerById)
router.put("/:id", BrokerController.updatebroker)
router.delete("/:id", BrokerController.deletebroker)

module.exports = router
