const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/PropertyController');

// Property routes
router.post('/', propertyController.createProperty);
router.get('/', propertyController.getAllProperties);
router.get('/:id', propertyController.getPropertyById);
router.put('/:id', propertyController.updateProperty);
router.delete('/:id', propertyController.deleteProperty);
router.delete('/:propertyId/files/:fileType/:publicId', propertyController.deletePropertyFile);

module.exports = router;