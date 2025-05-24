const userController = require("../controllers/UserController");
const router = require("express").Router();

router.post("/", userController.createUser);

// Route for getting all users (admin-protected)
router.get("/", userController.getAllUser);

// Route for getting, updating, and deleting a user by ID
router.get("/data/:id", userController.getUserbyID);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);
router.post("/login", userController.loginUser);
router.put("/password/change-password", userController.changePassword);

module.exports = router;
