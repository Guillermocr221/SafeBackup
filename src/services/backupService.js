const fs = require('fs-extra');
const path = require('path');
const { getDB } = require('../db/sqlite');

class BackupService {
  constructor() {
    this.maxRetries = 3;
    this.backupBaseDir = path.join(__dirname, '../../backups');
  }

  async ensureBackupDirectory() {
    try {
      await fs.ensureDir(this.backupBaseDir);
    } catch (error) {
      console.error('Error creando directorio de respaldo:', error);
      throw error;
    }
  }

  async performBackup(job) {
    const { id, folder_path } = job;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupBaseDir, `job_${id}`, timestamp);

    try {
      // Actualizar estado del trabajo a ejecutándose
      await this.updateJobStatus(id, 'running');
      await this.logMessage(id, `Iniciando respaldo de ${folder_path}`, 'info');

      // Verificar si la carpeta origen existe
      if (!await fs.pathExists(folder_path)) {
        throw new Error(`La carpeta origen no existe: ${folder_path}`);
      }

      // Asegurar que el directorio de respaldo exista
      await fs.ensureDir(backupDir);

      // Realizar el respaldo (copiar archivos)
      await fs.copy(folder_path, backupDir, {
        overwrite: true,
        errorOnExist: false
      });

      // Actualizar estado del trabajo a exitoso
      await this.updateJobStatus(id, 'ok', 0);
      await this.updateLastRun(id);
      await this.logMessage(id, `Respaldo completado exitosamente en ${backupDir}`, 'info');

      return { success: true, backupPath: backupDir };

    } catch (error) {
      console.error(`Respaldo falló para trabajo ${id}:`, error);
      
      const currentRetries = job.retries + 1;
      
      if (currentRetries < this.maxRetries) {
        // Incrementar contador de reintentos
        await this.updateJobRetries(id, currentRetries);
        await this.logMessage(id, `Respaldo falló, reintento ${currentRetries}/${this.maxRetries}: ${error.message}`, 'warning');
        
        // Reintentar después de un retraso
        setTimeout(() => {
          this.performBackup({ ...job, retries: currentRetries });
        }, 30000); // Esperar 30 segundos antes de reintentar
        
      } else {
        // Máximo de reintentos alcanzado, marcar como error
        await this.updateJobStatus(id, 'error', currentRetries);
        await this.logMessage(id, `Respaldo falló después de ${this.maxRetries} intentos: ${error.message}`, 'error');
      }

      return { success: false, error: error.message };
    }
  }

  async updateJobStatus(jobId, status, retries = null) {
    const db = getDB();
    return new Promise((resolve, reject) => {
      const query = retries !== null 
        ? 'UPDATE jobs SET status = ?, retries = ? WHERE id = ?'
        : 'UPDATE jobs SET status = ? WHERE id = ?';
      
      const params = retries !== null 
        ? [status, retries, jobId]
        : [status, jobId];

      db.run(query, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async updateJobRetries(jobId, retries) {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.run('UPDATE jobs SET retries = ? WHERE id = ?', [retries, jobId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async updateLastRun(jobId) {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE jobs SET last_run = ? WHERE id = ?',
        [new Date().toISOString(), jobId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async logMessage(jobId, message, level = 'info') {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO logs (job_id, message, level, timestamp) VALUES (?, ?, ?, ?)',
        [jobId, message, level, new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async checkAndRecoverJobs() {
    const db = getDB();
    
    // Verificar trabajos que estaban previamente en estado de error
    const errorJobs = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM jobs WHERE status = "error" AND active = 1', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const job of errorJobs) {
      // Intentar realizar respaldo nuevamente para ver si se ha recuperado
      try {
        if (await fs.pathExists(job.folder_path)) {
          await this.updateJobStatus(job.id, 'pending', 0);
          await this.logMessage(job.id, 'Trabajo recuperado: la carpeta origen ahora es accesible', 'info');
        }
      } catch (error) {
        // Aún en estado de error
        continue;
      }
    }
  }
}

module.exports = BackupService;