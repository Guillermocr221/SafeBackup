const express = require('express');
const backupController = require('./backupController');
const pm2Controller = require('./pm2Controller');

const router = express.Router();

// Backup job routes
router.get('/jobs', backupController.getJobs);
router.post('/jobs', backupController.createJob);
router.put('/jobs/:id', backupController.updateJob);
router.delete('/jobs/:id', backupController.deleteJob);

// PM2 service control routes
router.get('/service/status', pm2Controller.getStatus);
router.post('/service/start', pm2Controller.startService);
router.post('/service/stop', pm2Controller.stopService);
router.post('/service/restart', pm2Controller.restartService);

// Logs route
router.get('/logs', backupController.getLogs);

module.exports = router;