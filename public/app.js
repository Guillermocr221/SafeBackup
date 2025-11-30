// Variables globales para la aplicación
let jobs = [];
let editingJobId = null;

// URLs de la API
const API_BASE = '/api';
const API_ENDPOINTS = {
    jobs: `${API_BASE}/jobs`,
    pm2Status: `${API_BASE}/pm2/status`,
    pm2Start: `${API_BASE}/pm2/start`,
    pm2Stop: `${API_BASE}/pm2/stop`,
    pm2Restart: `${API_BASE}/pm2/restart`,
    logs: `${API_BASE}/logs`
};

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Función principal de inicialización
async function initializeApp() {
    try {
        // Configurar eventos de la interfaz
        setupEventListeners();
        
        // Cargar datos iniciales
        await loadInitialData();
        
        // Configurar actualizaciones automáticas
        setupAutoRefresh();
        
        showNotification('Aplicación inicializada correctamente', 'success');
    } catch (error) {
        console.error('Error inicializando aplicación:', error);
        showNotification('Error al inicializar la aplicación', 'error');
    }
}

// Configurar todos los event listeners
function setupEventListeners() {
    // Botones de control del servicio
    document.getElementById('startService').addEventListener('click', startService);
    document.getElementById('stopService').addEventListener('click', stopService);
    document.getElementById('restartService').addEventListener('click', restartService);
    
    // Modal de trabajos
    document.getElementById('addJobBtn').addEventListener('click', openJobModal);
    document.getElementById('closeModal').addEventListener('click', closeJobModal);
    document.getElementById('cancelJob').addEventListener('click', closeJobModal);
    document.getElementById('jobForm').addEventListener('submit', handleJobSubmit);
    
    // Cerrar modal haciendo clic fuera de él
    document.getElementById('jobModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeJobModal();
        }
    });
}

// Cargar datos iniciales
async function loadInitialData() {
    await Promise.all([
        checkServiceStatus(),
        loadJobs(),
        loadLogs()
    ]);
}

// Configurar actualizaciones automáticas
function setupAutoRefresh() {
    // Actualizar estado del servicio cada 10 segundos
    setInterval(checkServiceStatus, 10000);
    
    // Actualizar trabajos cada 30 segundos
    setInterval(loadJobs, 30000);
    
    // Actualizar registros cada 30 segundos
    setInterval(loadLogs, 30000);
}

// === FUNCIONES DEL SERVICIO PM2 ===

async function checkServiceStatus() {
    try {
        const response = await fetch(API_ENDPOINTS.pm2Status);
        const data = await response.json();
        
        updateServiceStatus(data.status, data.details);
    } catch (error) {
        console.error('Error verificando estado del servicio:', error);
        updateServiceStatus('offline', { error: 'No se pudo conectar al servicio' });
    }
}

function updateServiceStatus(status, details) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const serviceInfo = document.getElementById('serviceInfo');
    
    // Actualizar indicador visual
    indicator.className = 'status-indicator';
    if (status === 'online') {
        indicator.classList.add('online');
        statusText.textContent = 'Servicio en Línea';
    } else {
        indicator.classList.add('offline');
        statusText.textContent = 'Servicio Fuera de Línea';
    }
    
    // Mostrar detalles del servicio si están disponibles
    if (details && typeof details === 'object') {
        let infoHTML = '<h4>Detalles del Servicio:</h4><ul>';
        
        if (details.status) infoHTML += `<li><strong>Estado:</strong> ${details.status}</li>`;
        if (details.uptime) infoHTML += `<li><strong>Tiempo Activo:</strong> ${formatUptime(details.uptime)}</li>`;
        if (details.restarts !== undefined) infoHTML += `<li><strong>Reinicios:</strong> ${details.restarts}</li>`;
        if (details.memory) infoHTML += `<li><strong>Memoria:</strong> ${formatBytes(details.memory)}</li>`;
        if (details.cpu !== undefined) infoHTML += `<li><strong>CPU:</strong> ${details.cpu}%</li>`;
        
        infoHTML += '</ul>';
        serviceInfo.innerHTML = infoHTML;
    } else if (details && typeof details === 'string') {
        serviceInfo.innerHTML = `<p><strong>Estado:</strong> ${details}</p>`;
    }
}

async function startService() {
    try {
        showNotification('Iniciando servicio...', 'info');
        const response = await fetch(API_ENDPOINTS.pm2Start, { method: 'POST' });
        const data = await response.json();
        
        showNotification(data.message || 'Servicio iniciado', 'success');
        await checkServiceStatus();
    } catch (error) {
        console.error('Error iniciando servicio:', error);
        showNotification('Error al iniciar el servicio', 'error');
    }
}

async function stopService() {
    try {
        showNotification('Deteniendo servicio...', 'info');
        const response = await fetch(API_ENDPOINTS.pm2Stop, { method: 'POST' });
        const data = await response.json();
        
        showNotification(data.message || 'Servicio detenido', 'success');
        await checkServiceStatus();
    } catch (error) {
        console.error('Error deteniendo servicio:', error);
        showNotification('Error al detener el servicio', 'error');
    }
}

async function restartService() {
    try {
        showNotification('Reiniciando servicio...', 'info');
        const response = await fetch(API_ENDPOINTS.pm2Restart, { method: 'POST' });
        const data = await response.json();
        
        showNotification(data.message || 'Servicio reiniciado', 'success');
        await checkServiceStatus();
    } catch (error) {
        console.error('Error reiniciando servicio:', error);
        showNotification('Error al reiniciar el servicio', 'error');
    }
}

// === FUNCIONES DE TRABAJOS ===

async function loadJobs() {
    try {
        const response = await fetch(API_ENDPOINTS.jobs);
        jobs = await response.json();
        renderJobs();
    } catch (error) {
        console.error('Error cargando trabajos:', error);
        showNotification('Error al cargar los trabajos', 'error');
    }
}

function renderJobs() {
    const grid = document.getElementById('jobsGrid');
    
    if (jobs.length === 0) {
        grid.innerHTML = '<div class="no-jobs">No hay trabajos de respaldo configurados</div>';
        return;
    }
    
    grid.innerHTML = jobs.map(job => `
        <div class="job-card ${job.active ? 'active' : 'inactive'}">
            <div class="job-header">
                <h3>📁 Trabajo ${job.id}</h3>
                <div class="job-status status-${job.status || 'pending'}">${getStatusText(job.status)}</div>
            </div>
            <div class="job-details">
                <p><strong>Carpeta:</strong> ${job.folder_path}</p>
                <p><strong>Frecuencia:</strong> ${job.frequency_minutes} minutos</p>
                <p><strong>Última ejecución:</strong> ${job.last_run ? formatDateTime(job.last_run) : 'Nunca'}</p>
                <p><strong>Reintentos:</strong> ${job.retries || 0}</p>
            </div>
            <div class="job-actions">
                <button onclick="editJob(${job.id})" class="btn btn-sm btn-primary">✏️ Editar</button>
                <button onclick="toggleJob(${job.id}, ${!job.active})" class="btn btn-sm ${job.active ? 'btn-warning' : 'btn-success'}">
                    ${job.active ? '⏸️ Pausar' : '▶️ Activar'}
                </button>
                <button onclick="deleteJob(${job.id})" class="btn btn-sm btn-danger">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

function openJobModal(jobId = null) {
    const modal = document.getElementById('jobModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('jobForm');
    
    editingJobId = jobId;
    
    if (jobId) {
        const job = jobs.find(j => j.id === jobId);
        title.textContent = 'Editar Trabajo de Respaldo';
        document.getElementById('folderPath').value = job.folder_path;
        document.getElementById('frequency').value = job.frequency_minutes;
    } else {
        title.textContent = 'Nuevo Trabajo de Respaldo';
        form.reset();
    }
    
    modal.style.display = 'block';
}

function closeJobModal() {
    document.getElementById('jobModal').style.display = 'none';
    editingJobId = null;
}

async function handleJobSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const jobData = {
        folder_path: formData.get('folderPath'),
        frequency_minutes: parseInt(formData.get('frequency'))
    };
    
    try {
        let response;
        if (editingJobId) {
            response = await fetch(`${API_ENDPOINTS.jobs}/${editingJobId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });
        } else {
            response = await fetch(API_ENDPOINTS.jobs, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(editingJobId ? 'Trabajo actualizado exitosamente' : 'Trabajo creado exitosamente', 'success');
            closeJobModal();
            await loadJobs();
        } else {
            showNotification(result.error || 'Error al guardar el trabajo', 'error');
        }
    } catch (error) {
        console.error('Error guardando trabajo:', error);
        showNotification('Error al guardar el trabajo', 'error');
    }
}

async function toggleJob(jobId, active) {
    try {
        const response = await fetch(`${API_ENDPOINTS.jobs}/${jobId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active })
        });
        
        if (response.ok) {
            showNotification(`Trabajo ${active ? 'activado' : 'pausado'} exitosamente`, 'success');
            await loadJobs();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error al actualizar el trabajo', 'error');
        }
    } catch (error) {
        console.error('Error actualizando trabajo:', error);
        showNotification('Error al actualizar el trabajo', 'error');
    }
}

async function deleteJob(jobId) {
    if (!confirm('¿Está seguro de que desea eliminar este trabajo de respaldo?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_ENDPOINTS.jobs}/${jobId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Trabajo eliminado exitosamente', 'success');
            await loadJobs();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error al eliminar el trabajo', 'error');
        }
    } catch (error) {
        console.error('Error eliminando trabajo:', error);
        showNotification('Error al eliminar el trabajo', 'error');
    }
}

function editJob(jobId) {
    openJobModal(jobId);
}

// === FUNCIONES DE REGISTROS ===

async function loadLogs() {
    try {
        const response = await fetch(API_ENDPOINTS.logs);
        const logs = await response.json();
        renderLogs(logs);
    } catch (error) {
        console.error('Error cargando registros:', error);
        showNotification('Error al cargar los registros', 'error');
    }
}

function renderLogs(logs) {
    const container = document.getElementById('logsContainer');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="no-logs">No hay registros disponibles</div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-entry level-${log.level}">
            <div class="log-header">
                <span class="log-timestamp">${formatDateTime(log.timestamp)}</span>
                <span class="log-level">${log.level.toUpperCase()}</span>
                ${log.folder_path ? `<span class="log-job">Trabajo: ${log.folder_path}</span>` : ''}
            </div>
            <div class="log-message">${log.message}</div>
        </div>
    `).join('');
}

// === FUNCIONES DE UTILIDAD ===

function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Remover notificación después de 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES');
}

function formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'running': 'Ejecutándose',
        'ok': 'Exitoso',
        'error': 'Error'
    };
    return statusMap[status] || 'Desconocido';
}