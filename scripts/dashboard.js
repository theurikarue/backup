
        // API Configuration
        const API_CONFIG = {
            BACKUP_SERVICES_API: 'http://173.249.30.121:9000/core/api/',
            LOGIN_URL: 'index.html'
        };

        // Global state
        let userToken = null;
        let currentUser = null;
        let backupData = [];

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            checkAuthentication();
            setupEventListeners();
        });

        function checkAuthentication() {
            userToken = getStoredItem('access_token');
            const userData = getStoredItem('user_data');
            
            if (!userToken) {
                // Redirect to login if no token
                window.location.href = API_CONFIG.LOGIN_URL;
                return;
            }

            if (userData) {
                try {
                    currentUser = JSON.parse(userData);
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }

            initializeDashboard();
            loadDashboardData();
        }

        function initializeDashboard() {
            if (currentUser) {
                // Try multiple fields for the user's name/display name
                const userName = currentUser.username || 
                                currentUser.name || 
                                currentUser.full_name || 
                                currentUser.display_name || 
                                currentUser.first_name || 
                                currentUser.email || 
                                'User';
                
                document.getElementById('userName').textContent = userName;
                document.getElementById('userAvatar').textContent = userName.charAt(0).toUpperCase();
            } else {
                document.getElementById('userName').textContent = 'User';
                document.getElementById('userAvatar').textContent = 'U';
            }
            
            document.getElementById('statusBadge').textContent = 'Active';
        }

        async function loadDashboardData() {
            try {
                await Promise.all([
                    loadBackups(),
                    loadRecentActivity()
                ]);
                updateStats();
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                showError('Failed to load dashboard data. Please refresh the page.');
            }
        }

        async function loadBackups() {
            try {
                // const response = await makeApiCall(`${API_CONFIG.BACKUP_SERVICES_API}backups/`, 'GET');
                const response = await makeApiCall(`${API_CONFIG.BACKUP_SERVICES_API}/`, 'POST');
                backupData = response.backups || response.data || response.results || [];
                updateBackupsList();
            } catch (error) {
                console.error('Error loading backups:', error);
                // Show error message instead of mock data
                backupData = [];
                updateBackupsList();
                showError('Failed to load backups. Please check your connection and try again.');
            }
        }

        async function loadRecentActivity() {
            try {
                const response = await makeApiCall(`${API_CONFIG.BACKUP_SERVICES_API}activity/`, 'GET');
                const activities = response.activities || response.data || response.results || [];
                updateActivityList(activities);
            } catch (error) {
                console.error('Error loading activities:', error);
                // Show empty activity list instead of mock data
                updateActivityList([]);
            }
        }

        function updateStats() {
            const totalBackups = backupData.length;
            const totalSize = backupData.reduce((sum, backup) => {
                const sizeStr = backup.size || '0 GB';
                const size = parseFloat(sizeStr.replace(/[^\d.]/g, '')) || 0;
                return sum + size;
            }, 0);
            
            const latestBackup = backupData.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            )[0];

            document.getElementById('totalBackups').textContent = totalBackups;
            document.getElementById('storageUsed').textContent = totalSize.toFixed(1);
            
            if (latestBackup) {
                const timeAgo = getTimeAgo(new Date(latestBackup.created_at));
                document.getElementById('lastBackup').textContent = timeAgo;
            } else {
                document.getElementById('lastBackup').textContent = 'Never';
            }
        }

        function updateBackupsList() {
            const container = document.getElementById('backupsContainer');
            
            if (backupData.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No backups found. Create your first backup to get started!</p>';
                return;
            }

            container.innerHTML = backupData.map(backup => `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-name">${escapeHtml(backup.name)}</div>
                        <div class="backup-details">
                            Path: ${escapeHtml(backup.path)} • 
                            Type: ${backup.type} • 
                            Size: ${backup.size} • 
                            Created: ${formatDate(backup.created_at)}
                        </div>
                    </div>
                    <div class="backup-actions">
                        <span class="status-badge-small status-${backup.status.replace('_', '-')}">${backup.status.replace('_', ' ')}</span>
                        <button class="btn btn-secondary btn-small" onclick="restoreBackup(${backup.id})">
                            <span>📥</span>
                            Restore
                        </button>
                        <button class="btn btn-danger btn-small" onclick="deleteBackup(${backup.id})">
                            <span>🗑️</span>
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');
        }

        function updateActivityList(activities) {
            const container = document.getElementById('activityList');
            
            if (activities.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No recent activity</p>';
                return;
            }

            container.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        ${getActivityIcon(activity.type)}
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${escapeHtml(activity.title)}</div>
                        <div class="activity-time">${getTimeAgo(new Date(activity.timestamp))}</div>
                    </div>
                </div>
            `).join('');
        }

        function setupEventListeners() {
            // Modal controls
            const modal = document.getElementById('newBackupModal');
            const newBackupBtn = document.getElementById('newBackupBtn');
            const closeBtn = document.querySelector('.close');
            const form = document.getElementById('newBackupForm');
            
            newBackupBtn.addEventListener('click', () => {
                modal.style.display = 'block';
            });
            
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                form.reset();
                hideMessages();
            });
            
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                    form.reset();
                    hideMessages();
                }
            });

            // Form submission
            form.addEventListener('submit', handleNewBackup);

            // Other buttons
            document.getElementById('viewBackupsBtn').addEventListener('click', toggleBackupsList);
            document.getElementById('refreshBackupsBtn').addEventListener('click', refreshBackups);
            document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        }

        async function handleNewBackup(event) {
            event.preventDefault();
            
            const formData = {
                name: document.getElementById('backupName').value.trim(),
                path: document.getElementById('backupPath').value.trim(),
                type: document.getElementById('backupType').value,
                schedule: document.getElementById('backupSchedule').value,
                description: document.getElementById('backupDescription').value.trim()
            };

            if (!formData.name || !formData.path || !formData.type) {
                showModalError('Please fill in all required fields.');
                return;
            }

            const submitBtn = document.getElementById('createBackupBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span>⏳</span> Creating...';
            submitBtn.disabled = true;

            try {
                const response = await makeApiCall(`${API_CONFIG.BACKUP_SERVICES_API}backups/create/`, 'POST', formData);
                
                if (response.success || response.id) {
                    showModalSuccess('Backup created successfully!');
                    setTimeout(() => {
                        document.getElementById('newBackupModal').style.display = 'none';
                        document.getElementById('newBackupForm').reset();
                        hideMessages();
                        loadBackups();
                    }, 2000);
                } else {
                    throw new Error(response.message || 'Failed to create backup');
                }
            } catch (error) {
                console.error('Error creating backup:', error);
                showModalError('Failed to create backup: ' + error.message);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }

        function toggleBackupsList() {
            const backupsList = document.getElementById('backupsList');
            if (backupsList.style.display === 'none') {
                backupsList.style.display = 'block';
                loadBackups();
            } else {
                backupsList.style.display = 'none';
            }
        }

        async function refreshBackups() {
            const refreshBtn = document.getElementById('refreshBackupsBtn');
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<span>⏳</span> Loading...';
            refreshBtn.disabled = true;

            try {
                await loadBackups();
                showSuccess('Backups refreshed successfully!');
            } catch (error) {
                showError('Failed to refresh backups');
            } finally {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }
        }

        async function restoreBackup(backupId) {
            if (!confirm('Are you sure you want to restore this backup? This action cannot be undone.')) {
                return;
            }

            try {
                const response = await makeApiCall(`${API_CONFIG.BACKUP_SERVICES_API}backups/${backupId}/restore/`, 'POST');
                
                if (response.success) {
                    showSuccess('Backup restore initiated successfully!');
                    loadRecentActivity();
                } else {
                    throw new Error(response.message || 'Failed to restore backup');
                }
            } catch (error) {
                console.error('Error restoring backup:', error);
                showError('Failed to restore backup: ' + error.message);
            }
        }

        async function deleteBackup(backupId) {
            if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
                return;
            }

            try {
                const response = await makeApiCall(`${API_CONFIG.BACKUP_SERVICES_API}backups/${backupId}/`, 'DELETE');
                
                if (response.success || response.status === 'deleted') {
                    showSuccess('Backup deleted successfully!');
                    loadBackups();
                    loadRecentActivity();
                } else {
                    throw new Error(response.message || 'Failed to delete backup');
                }
            } catch (error) {
                console.error('Error deleting backup:', error);
                showError('Failed to delete backup: ' + error.message);
            }
        }

        function handleLogout() {
            if (confirm('Are you sure you want to logout?')) {
                clearStorageItems();
                window.location.href = API_CONFIG.LOGIN_URL;
            }
        }

        // Utility functions
        async function makeApiCall(url, method = 'GET', data = null) {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                }
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            
            if (response.status === 401) {
                clearStorageItems();
                window.location.href = API_CONFIG.LOGIN_URL;
                return;
            }

            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
            }

            return responseData;
        }

        function getStoredItem(key) {
            // Use sessionStorage for actual implementation
            return sessionStorage.getItem(key);
        }

        function clearStorageItems() {
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('user_data');
        }

        function showError(message) {
            const errorEl = document.getElementById('errorMessage');
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 5000);
        }

        function showSuccess(message) {
            const successEl = document.getElementById('successMessage');
            successEl.textContent = message;
            successEl.style.display = 'block';
            setTimeout(() => {
                successEl.style.display = 'none';
            }, 5000);
        }

        function showModalError(message) {
            const errorEl = document.getElementById('modalErrorMessage');
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }

        function showModalSuccess(message) {
            const successEl = document.getElementById('modalSuccessMessage');
            successEl.textContent = message;
            successEl.style.display = 'block';
        }

        function hideMessages() {
            document.getElementById('modalErrorMessage').style.display = 'none';
            document.getElementById('modalSuccessMessage').style.display = 'none';
        }

        function getTimeAgo(date) {
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 60) {
                return `${diffMins} mins`;
            } else if (diffHours < 24) {
                return `${diffHours} hours`;
            } else {
                return `${diffDays} days`;
            }
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }

        function getActivityIcon(type) {
            switch (type) {
                case 'success':
                    return '✅';
                case 'pending':
                    return '⏳';
                case 'error':
                    return '❌';
                default:
                    return '📝';
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Auto-refresh data every 30 seconds
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadRecentActivity();
                updateStats();
            }
        }, 30000);
    