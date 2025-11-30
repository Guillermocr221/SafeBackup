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
      callback(new Error('No permitido por CORS'));
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

// Endpoint raíz para verificar que el servidor funciona
app.get('/', (req, res) => {
  res.json({
    message: 'Backup System API está funcionando',
    version: '1.0.0',
    endpoints: {
      jobs: '/api/jobs',
      service: '/api/service',
      logs: '/api/logs'
    }
  });
});

// Endpoint de verificación de estado
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rutas API
app.use('/api', routes);

// Manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe`,
    availableRoutes: {
      root: '/',
      health: '/health',
      jobs: '/api/jobs',
      serviceStatus: '/api/service/status',
      logs: '/api/logs'
    }
  });
});

// Inicializar base de datos y arrancar servidor
async function startServer() {
  try {
    await initDatabase();
    console.log('Base de datos inicializada correctamente');
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
      console.log(`📊 Verificación de estado: http://localhost:${PORT}/health`);
      console.log(`🔌 Endpoints de la API: http://localhost:${PORT}/api/`);
      console.log('📋 Endpoints disponibles:');
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
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();