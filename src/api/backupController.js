const { getDB } = require('../db/sqlite');

const backupController = {
  // Get all backup jobs
  async getJobs(req, res) {
    try {
      const db = getDB();
      const jobs = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM jobs ORDER BY id DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      res.json(jobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  },

  // Create new backup job
  async createJob(req, res) {
    try {
      const { folder_path, frequency_minutes } = req.body;
      
      if (!folder_path || !frequency_minutes) {
        return res.status(400).json({ error: 'folder_path and frequency_minutes are required' });
      }

      const db = getDB();
      const result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO jobs (folder_path, frequency_minutes) VALUES (?, ?)',
          [folder_path, frequency_minutes],
          function(err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });

      // Log job creation
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO logs (job_id, message, level, timestamp) VALUES (?, ?, ?, ?)',
          [result.lastID, `Job created for path: ${folder_path}`, 'info', new Date().toISOString()],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.status(201).json({ id: result.lastID, message: 'Job created successfully' });
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  },

  // Update backup job
  async updateJob(req, res) {
    try {
      const { id } = req.params;
      const { folder_path, frequency_minutes, active } = req.body;
      
      const db = getDB();
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE jobs SET folder_path = COALESCE(?, folder_path), frequency_minutes = COALESCE(?, frequency_minutes), active = COALESCE(?, active) WHERE id = ?',
          [folder_path, frequency_minutes, active, id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ message: 'Job updated successfully' });
    } catch (error) {
      console.error('Error updating job:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  },

  // Delete backup job
  async deleteJob(req, res) {
    try {
      const { id } = req.params;
      const db = getDB();
      
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM jobs WHERE id = ?', [id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      console.error('Error deleting job:', error);
      res.status(500).json({ error: 'Failed to delete job' });
    }
  },

  // Get logs
  async getLogs(req, res) {
    try {
      const db = getDB();
      const logs = await new Promise((resolve, reject) => {
        db.all(
          `SELECT l.*, j.folder_path 
           FROM logs l 
           LEFT JOIN jobs j ON l.job_id = j.id 
           ORDER BY l.timestamp DESC 
           LIMIT 100`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }
};

module.exports = backupController;