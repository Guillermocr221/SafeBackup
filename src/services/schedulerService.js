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
      console.log('Programador ya está ejecutándose');
      return;
    }

    console.log('Iniciando programador de respaldos...');
    this.isRunning = true;

    // Inicializar directorio de respaldos
    await this.backupService.ensureBackupDirectory();

    // Verificar oportunidades de recuperación
    await this.backupService.checkAndRecoverJobs();

    // Iniciar el programador principal que verifica trabajos cada minuto
    this.mainScheduler = cron.schedule('* * * * *', async () => {
      await this.checkAndRunJobs();
    });

    console.log('Programador de respaldos iniciado exitosamente');
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Programador no está ejecutándose');
      return;
    }

    console.log('Deteniendo programador de respaldos...');
    
    if (this.mainScheduler) {
      this.mainScheduler.stop();
    }

    // Detener todos los programadores de trabajos activos
    this.activeJobs.forEach((scheduler, jobId) => {
      scheduler.stop();
    });
    
    this.activeJobs.clear();
    this.isRunning = false;
    
    console.log('Programador de respaldos detenido');
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
      console.error('Error verificando trabajos:', error);
    }
  }

  async scheduleJob(job) {
    const { id, frequency_minutes, last_run } = job;

    // Verificar si el trabajo debe ejecutarse basado en la frecuencia
    if (this.shouldRunJob(job)) {
      console.log(`Ejecutando trabajo de respaldo ${id}...`);
      
      // Ejecutar el respaldo (no esperar para permitir ejecución en paralelo)
      this.backupService.performBackup(job).catch(error => {
        console.error(`Error en trabajo de respaldo ${id}:`, error);
      });
    }
  }

  shouldRunJob(job) {
    const { frequency_minutes, last_run, status } = job;
    
    // No ejecutar si ya se está ejecutando
    if (status === 'running') {
      return false;
    }

    // Si nunca se ha ejecutado, debe ejecutarse ahora
    if (!last_run) {
      return true;
    }

    // Verificar si ha pasado suficiente tiempo desde la última ejecución
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