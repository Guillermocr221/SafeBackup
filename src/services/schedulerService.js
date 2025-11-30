const cron = require('node-cron');
const { getDB } = require('../db/sqlite');
const BackupService = require('./backupService');

class SchedulerService {
  constructor() {
    this.backupService = new BackupService();
    this.activeJobs = new Map();
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    console.log('Starting backup scheduler...');
    this.isRunning = true;

    // Initialize backup directory
    await this.backupService.ensureBackupDirectory();

    // Check for recovery opportunities
    await this.backupService.checkAndRecoverJobs();

    // Start the main scheduler that checks for jobs every minute
    this.mainScheduler = cron.schedule('* * * * *', async () => {
      await this.checkAndRunJobs();
    });

    console.log('Backup scheduler started successfully');
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Scheduler not running');
      return;
    }

    console.log('Stopping backup scheduler...');
    
    if (this.mainScheduler) {
      this.mainScheduler.stop();
    }

    // Stop all active job schedulers
    this.activeJobs.forEach((scheduler, jobId) => {
      scheduler.stop();
    });
    
    this.activeJobs.clear();
    this.isRunning = false;
    
    console.log('Backup scheduler stopped');
  }

  async checkAndRunJobs() {
    try {
      const db = getDB();
      const jobs = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM jobs WHERE active = 1', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      for (const job of jobs) {
        await this.scheduleJob(job);
      }
    } catch (error) {
      console.error('Error checking jobs:', error);
    }
  }

  async scheduleJob(job) {
    const { id, frequency_minutes, last_run } = job;

    // Check if job should run based on frequency
    if (this.shouldRunJob(job)) {
      console.log(`Running backup job ${id}...`);
      
      // Run the backup (don't await to allow parallel execution)
      this.backupService.performBackup(job).catch(error => {
        console.error(`Error in backup job ${id}:`, error);
      });
    }
  }

  shouldRunJob(job) {
    const { frequency_minutes, last_run, status } = job;
    
    // Don't run if already running
    if (status === 'running') {
      return false;
    }

    // If never run, should run now
    if (!last_run) {
      return true;
    }

    // Check if enough time has passed since last run
    const lastRunTime = new Date(last_run);
    const now = new Date();
    const timeDiff = now - lastRunTime;
    const frequencyMs = frequency_minutes * 60 * 1000;

    return timeDiff >= frequencyMs;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      schedulerUptime: this.isRunning ? new Date().toISOString() : null
    };
  }
}

module.exports = SchedulerService;