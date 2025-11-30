const fs = require('fs-extra');
const path = require('path');
const { getDB } = require('../db/sqlite');

class BackupService {
  constructor() {
    this.maxRetries = 3;
    this.backupBaseDir = path.join(__dirname, '../../backups');
  }

  // Función para obtener timestamp en zona horaria de Bogotá/Lima (UTC-5)
  getBogotaTimestamp() {
    const now = new Date();
    // Ajustar a UTC-5 (Bogotá/Lima)
    const bogotaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    return bogotaTime.toISOString();
  }

  // Función para formatear timestamp para nombres de carpetas
  getFormattedTimestamp() {
    return this.getBogotaTimestamp().replace(/[:.]/g, '-');
  }

  async ensureBackupDirectory() {
    try {
      await fs.ensureDir(this.backupBaseDir);
    } catch (error) {
      console.error('Error creating backup directory:', error);
      throw error;
    }
  }

  async performBackup(job) {
    const { id, folder_path } = job;
    const timestamp = this.getFormattedTimestamp();
    const backupDir = path.join(this.backupBaseDir, `job_${id}`, timestamp);

    try {
      // Update job status to running
      await this.updateJobStatus(id, 'running');
      await this.logMessage(id, `Starting backup of ${folder_path}`, 'info');

      // Check if source folder exists
      if (!await fs.pathExists(folder_path)) {
        throw new Error(`Source folder does not exist: ${folder_path}`);
      }

      // Ensure backup directory exists
      await fs.ensureDir(backupDir);

      // Perform the backup (copy files)
      await fs.copy(folder_path, backupDir, {
        overwrite: true,
        errorOnExist: false
      });

      // Update job status to success
      await this.updateJobStatus(id, 'ok', 0);
      await this.updateLastRun(id);
      await this.logMessage(id, `Backup completed successfully to ${backupDir}`, 'info');

      return { success: true, backupPath: backupDir };

    } catch (error) {
      console.error(`Backup failed for job ${id}:`, error);
      
      const currentRetries = job.retries + 1;
      
      if (currentRetries < this.maxRetries) {
        // Increment retry count
        await this.updateJobRetries(id, currentRetries);
        await this.logMessage(id, `Backup failed, retry ${currentRetries}/${this.maxRetries}: ${error.message}`, 'warning');
        
        // Retry after a delay
        setTimeout(() => {
          this.performBackup({ ...job, retries: currentRetries });
        }, 30000); // Wait 30 seconds before retry
        
      } else {
        // Max retries reached, mark as error
        await this.updateJobStatus(id, 'error', currentRetries);
        await this.logMessage(id, `Backup failed after ${this.maxRetries} attempts: ${error.message}`, 'error');
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
    
    // Check for jobs that were previously in error state
    const errorJobs = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM jobs WHERE status = "error" AND active = 1', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const job of errorJobs) {
      // Try to perform backup again to see if it's recovered
      try {
        if (await fs.pathExists(job.folder_path)) {
          await this.updateJobStatus(job.id, 'pending', 0);
          await this.logMessage(job.id, 'Job recovered: source folder is now accessible', 'info');
        }
      } catch (error) {
        // Still in error state
        continue;
      }
    }
  }
}

module.exports = BackupService;