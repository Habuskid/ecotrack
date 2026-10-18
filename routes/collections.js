/**
 * EcoTrack Collection Routes (Admin)
 */

const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, collectionController.getCollections);
router.post('/', requireAdmin, collectionController.scheduleCollection);
router.patch('/:reportId/complete', requireAdmin, collectionController.completeCollection);

module.exports = router;
