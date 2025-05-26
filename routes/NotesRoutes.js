const express = require("express")
const notesController = require("../controllers/NotesController")

const router = express.Router()

// notes CRUD routes
router.post("/", notesController.createnotes)
router.get("/", notesController.getAllnotes)
router.get("/:id", notesController.getnotesById)
router.put("/:id", notesController.updatenotes)
router.delete("/:id", notesController.deletenotes)

module.exports = router
