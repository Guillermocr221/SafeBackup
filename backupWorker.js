const { initDatabase } = require('./src/db/sqlite');
const SchedulerService = require('./src/services/schedulerService');

let scheduler;

async function startBackupWorker() {
  try {
    console.log('Inicializando worker de respaldo...');
    
    // Inicializar conexión a la base de datos
    await initDatabase();
    console.log('Base de datos conectada');
    
    // Iniciar el servicio de programación
    scheduler = new SchedulerService();
    await scheduler.start();
    
    console.log('Worker de respaldo iniciado exitosamente');
    
    // Manejar cierre elegante
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
  } catch (error) {
    console.error('Error al iniciar worker de respaldo:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('Señal de cierre recibida, deteniendo worker de respaldo...');
  
  if (scheduler) {
    await scheduler.stop();
  }
  
  console.log('Worker de respaldo detenido elegantemente');
  process.exit(0);
}

// Iniciar el worker
startBackupWorker();