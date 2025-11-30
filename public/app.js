// API Base URL
const API_BASE = '/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkStatus();
    loadJobs();
    loadLogs();
    
    // Set up form submission
    document.getElementById('jobForm').addEventListener('submit', handleJobSubmit);
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        checkStatus();
        loadJobs();
    }, 30000);
});

// Tab Management
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    
    // Load data for the active tab
    if (tabName === 'logs') {
        loadLogs();
    } else if (tabName === 'jobs') {
        loadJobs();
    }
}

// Service Management Functions
async function checkStatus() {
    try {
        const response = await fetch(`${API_BASE}/service/status`);
        const data = await response.json();
        
        const statusElement = document.getElementById('serviceStatus');
        if (data.status === 'online') {
            statusElement.textContent = 'En Línea';
            statusElement.className = 'status-indicator status-online';
        } else {
            statusElement.textContent = 'Desconectado';
            statusElement.className = 'status-indicator status-offline';
        }
    } catch (error) {
        console.error('Error checking status:', error);
        const statusElement = document.getElementById('serviceStatus');
        statusElement.textContent = 'Error';
        statusElement.className = 'status-indicator status-offline';
    }
}

async function startService() {
    try {
        const response = await fetch(`${API_BASE}/service/start`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Servicio iniciado correctamente', 'success');
            setTimeout(checkStatus, 2000);
        } else {
            showNotification(data.error || 'Error iniciando servicio', 'error');
        }
    } catch (error) {
        console.error('Error starting service:', error);
        showNotification('Error conectando con el servidor', 'error');
    }
}

async function stopService() {
    try {
        const response = await fetch(`${API_BASE}/service/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Servicio detenido correctamente', 'success');
            setTimeout(checkStatus, 2000);
        } else {
            showNotification(data.error || 'Error deteniendo servicio', 'error');
        }
    } catch (error) {
        console.error('Error stopping service:', error);
        showNotification('Error conectando con el servidor', 'error');
    }
}

async function restartService() {
    try {
        const response = await fetch(`${API_BASE}/service/restart`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Servicio reiniciado correctamente', 'success');
            setTimeout(checkStatus, 2000);
        } else {
            showNotification(data.error || 'Error reiniciando servicio', 'error');
        }
    } catch (error) {
        console.error('Error restarting service:', error);
        showNotification('Error conectando con el servidor', 'error');
    }
}

// Job Management Functions
async function loadJobs() {
    try {
        const response = await fetch(`${API_BASE}/jobs`);
        const jobs = await response.json();
        
        displayJobs(jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
        document.getElementById('jobsList').innerHTML = '<p>Error cargando tareas</p>';
    }
}

function displayJobs(jobs) {
    const jobsList = document.getElementById('jobsList');
    
    if (jobs.length === 0) {
        jobsList.innerHTML = '<p>No hay tareas configuradas</p>';
        return;
    }
    
    jobsList.innerHTML = jobs.map(job => `
        <div class="job-card">
            <div style="display: flex; justify-content: between-content; align-items: center; margin-bottom: 10px;">
                <h4>Tarea #${job.id}</h4>
                <span class="job-status status-${job.status}">${getStatusText(job.status)}</span>
            </div>
            <p><strong>Carpeta:</strong> ${job.folder_path}</p>
            <p><strong>Frecuencia:</strong> ${job.frequency_minutes} minutos</p>
            <p><strong>Último respaldo:</strong> ${job.last_run ? new Date(job.last_run).toLocaleString() : 'Nunca'}</p>
            <p><strong>Reintentos:</strong> ${job.retries}</p>
            <div style="margin-top: 10px;">
                <button class="btn btn-warning" onclick="toggleJob(${job.id}, ${job.active})">
                    ${job.active ? 'Desactivar' : 'Activar'}
                </button>
                <button class="btn btn-danger" onclick="deleteJob(${job.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'running': 'Ejecutando',
        'ok': 'Completado',
        'error': 'Error',
        'recovered': 'Recuperado'
    };
    return statusMap[status] || status;
}

async function handleJobSubmit(event) {
    event.preventDefault();
    
    const folderPath = document.getElementById('folderPath').value;
    const frequency = document.getElementById('frequency').value;
    
    try {
        const response = await fetch(`${API_BASE}/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                folder_path: folderPath,
                frequency_minutes: parseInt(frequency)
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Tarea creada correctamente', 'success');
            document.getElementById('jobForm').reset();
            loadJobs();
        } else {
            showNotification(data.error || 'Error creando tarea', 'error');
        }
    } catch (error) {
        console.error('Error creating job:', error);
        showNotification('Error conectando con el servidor', 'error');
    }
}

async function toggleJob(jobId, currentActive) {
    try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                active: currentActive ? 0 : 1
            })
        });
        
        if (response.ok) {
            showNotification('Tarea actualizada correctamente', 'success');
            loadJobs();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Error actualizando tarea', 'error');
        }
    } catch (error) {
        console.error('Error toggling job:', error);
        showNotification('Error conectando con el servidor', 'error');
    }
}

async function deleteJob(jobId) {
    if (!confirm('¿Está seguro de que desea eliminar esta tarea?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Tarea eliminada correctamente', 'success');
            loadJobs();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Error eliminando tarea', 'error');
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        showNotification('Error conectando con el servidor', 'error');
    }
}

// Logs Management
async function loadLogs() {
    try {
        const response = await fetch(`${API_BASE}/logs`);
        const logs = await response.json();
        
        displayLogs(logs);
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logsContainer').innerHTML = '<p>Error cargando logs</p>';
    }
}

function displayLogs(logs) {
    const logsContainer = document.getElementById('logsContainer');
    
    if (logs.length === 0) {
        logsContainer.innerHTML = '<p>No hay logs disponibles</p>';
        return;
    }
    
    logsContainer.innerHTML = logs.map(log => `
        <div class="log-entry log-${log.level}">
            <strong>${new Date(log.timestamp).toLocaleString()}</strong> 
            [${log.level.toUpperCase()}] 
            ${log.folder_path ? `[${log.folder_path}]` : ''} 
            ${log.message}
        </div>
    `).join('');
}

async function refreshLogs() {
    await loadLogs();
    showNotification('Logs actualizados', 'success');
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#007bff'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);