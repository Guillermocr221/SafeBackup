const { initDatabase } = require('./src/db/sqlite');
const SchedulerService = require('./src/services/schedulerService');

let scheduler;

async function startBackupWorker() {
  try {
    console.log('Initializing backup worker...');
    
    // Initialize database connection
    await initDatabase();
    console.log('Database connected');
    
    // Start the scheduler service
    scheduler = new SchedulerService();
    await scheduler.start();
    
    console.log('Backup worker started successfully');
    
    // Handle graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
  } catch (error) {
    console.error('Failed to start backup worker:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('Received shutdown signal, stopping backup worker...');
  
  if (scheduler) {
    await scheduler.stop();
  }
  
  console.log('Backup worker stopped gracefully');
  process.exit(0);
}

// Start the worker
startBackupWorker();