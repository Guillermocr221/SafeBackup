const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./api/routes');
const { initDatabase } = require('./db/sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS más permisiva para desarrollo
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como Postman, aplicaciones móviles, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir cualquier localhost en desarrollo
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Para producción, puedes especificar dominios específicos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://localhost:4200',
      'http://localhost:5000',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint para verificar que el servidor funciona
app.get('/', (req, res) => {
  res.json({
    message: 'Backup System API is running',
    version: '1.0.0',
    endpoints: {
      jobs: '/api/jobs',
      service: '/api/service',
      logs: '/api/logs'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api', routes);

// Manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`,
    availableRoutes: {
      root: '/',
      health: '/health',
      jobs: '/api/jobs',
      serviceStatus: '/api/service/status',
      logs: '/api/logs'
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 API endpoints: http://localhost:${PORT}/api/`);
      console.log('📋 Available endpoints:');
      console.log('  - GET  /api/jobs');
      console.log('  - POST /api/jobs');
      console.log('  - PUT  /api/jobs/:id');
      console.log('  - DEL  /api/jobs/:id');
      console.log('  - GET  /api/service/status');
      console.log('  - POST /api/service/start');
      console.log('  - POST /api/service/stop');
      console.log('  - POST /api/service/restart');
      console.log('  - GET  /api/logs');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();