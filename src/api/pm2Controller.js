const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const pm2Controller = {
  // Obtener estado del servicio PM2
  async getStatus(req, res) {
    try {
      // Usar pm2 jlist para salida JSON, que es más confiable
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);
      
      // Encontrar el proceso backup-worker
      const backupWorker = processes.find(proc => proc.name === 'backup-worker');
      
      if (backupWorker) {
        const isRunning = backupWorker.pm2_env.status === 'online';
        res.json({
          status: isRunning ? 'online' : 'offline',
          details: {
            status: backupWorker.pm2_env.status,
            uptime: backupWorker.pm2_env.pm_uptime,
            restarts: backupWorker.pm2_env.restart_time,
            memory: backupWorker.monit.memory,
            cpu: backupWorker.monit.cpu
          }
        });
      } else {
        res.json({
          status: 'offline',
          details: 'Process not found'
        });
      }
    } catch (error) {
      console.error('Error checking PM2 status:', error);
      res.json({
        status: 'offline',
        error: 'PM2 not available or service not found'
      });
    }
  },

  // Iniciar servicio de respaldo
  async startService(req, res) {
    try {
      // Primero verificar si el proceso ya existe
      try {
        const { stdout: listOutput } = await execAsync('pm2 jlist');
        const processes = JSON.parse(listOutput);
        const existingProcess = processes.find(proc => proc.name === 'backup-worker');
        
        if (existingProcess && existingProcess.pm2_env.status === 'online') {
          return res.json({
            message: 'Backup service is already running',
            status: 'already_running'
          });
        }
        
        if (existingProcess && existingProcess.pm2_env.status === 'stopped') {
          // Reiniciar proceso existente
          const { stdout } = await execAsync('pm2 restart backup-worker');
          return res.json({
            message: 'Backup service restarted successfully',
            output: stdout
          });
        }
      } catch (listError) {
        // Continuar para iniciar nuevo proceso si la lista falla
      }
      
      // Iniciar nuevo proceso
      const { stdout } = await execAsync('pm2 start ecosystem.config.js');
      res.json({
        message: 'Backup service started successfully',
        output: stdout
      });
    } catch (error) {
      console.error('Error starting service:', error);
      res.status(500).json({
        error: 'Failed to start backup service',
        details: error.message
      });
    }
  },

  // Detener servicio de respaldo
  async stopService(req, res) {
    try {
      const { stdout } = await execAsync('pm2 stop backup-worker');
      res.json({
        message: 'Backup service stopped successfully',
        output: stdout
      });
    } catch (error) {
      console.error('Error stopping service:', error);
      
      // Verificar si el error es porque el proceso no existe
      if (error.message.includes('process name not found')) {
        res.json({
          message: 'Backup service was not running',
          status: 'not_running'
        });
      } else {
        res.status(500).json({
          error: 'Failed to stop backup service',
          details: error.message
        });
      }
    }
  },

  // Reiniciar servicio de respaldo
  async restartService(req, res) {
    try {
      const { stdout } = await execAsync('pm2 restart backup-worker');
      res.json({
        message: 'Backup service restarted successfully',
        output: stdout
      });
    } catch (error) {
      console.error('Error restarting service:', error);
      
      // Si el reinicio falla, intentar iniciar en su lugar
      try {
        const { stdout: startOutput } = await execAsync('pm2 start ecosystem.config.js');
        res.json({
          message: 'Backup service started successfully (was not running)',
          output: startOutput
        });
      } catch (startError) {
        res.status(500).json({
          error: 'Failed to restart backup service',
          details: error.message
        });
      }
    }
  }
};

module.exports = pm2Controller;