// tenant.js - Tenant Dashboard Logic

let currentTenant = null;

document.addEventListener('DOMContentLoaded', () => {
    initTypingAnimation('typingText', 'Welcome To Fine Villa Apartments...');
    
    // Check if tenant is already logged in
    const savedTenant = sessionStorage.getItem('currentTenant');
    if (savedTenant) {
        currentTenant = JSON.parse(savedTenant);
        showTenantDashboard();
    }
    
    // Login form handler
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    
    // Search handler
    document.getElementById('tenantSearch')?.addEventListener('input', handleTenantSearch);
});

function handleLogin(e) {
    e.preventDefault();
    
    const tenantIdInput = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!tenantIdInput || !password) {
        showToast('Please enter both Tenant ID and Password', 'danger');
        return;
    }

    const tenants = JSON.parse(localStorage.getItem('tenants')) || [];
    
    // Login using Tenant ID + Password
    const tenant = tenants.find(t => 
        t.tenantId === tenantIdInput && t.password === password
    );
    
    if (tenant) {
        currentTenant = tenant;
        sessionStorage.setItem('currentTenant', JSON.stringify(tenant));
        showTenantDashboard();
        showToast(`Welcome back, ${tenant.name}!`, 'success');
    } else {
        showToast('Invalid Tenant ID or Password', 'danger');
    }
}

function showTenantDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('tenantDashboard').style.display = 'block';
    
    document.getElementById('tenantName').textContent = currentTenant.name;
    document.getElementById('tenantRoom').textContent = currentTenant.room;
    document.getElementById('tenantFloor').textContent = currentTenant.floor;
    
    loadTenantPayments();
    loadTenantNotices();
}

function loadTenantPayments() {
    const payments = JSON.parse(localStorage.getItem('payments')) || [];
    const tenantPayments = payments.filter(p => p.tenantId === currentTenant.id);
    
    const container = document.getElementById('tenantPayments');
    
    if (tenantPayments.length === 0) {
        container.innerHTML = '<p>No payment records found.</p>';
        return;
    }
    
    let html = '能<tr><thead><tr><th>Month</th><th>Rent</th><th>Water</th><th>Total</th><th>Status</th><th>Penalty</th></tr></thead><tbody>';
    
    tenantPayments.forEach(p => {
        const statusClass = p.status === 'paid' ? 'status-paid' : 'status-pending';
        html += `<tr>
            <td>${p.month}</td>
            <td>KES ${p.rent || 8500}</td>
            <td>KES ${p.water || 170}</td>
            <td>KES ${(p.total || 8670) + (p.penalty || 0)}</td>
            <td><span class="${statusClass}">${p.status}</span></td>
            <td>${p.penalty ? 'KES ' + p.penalty : 'None'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function loadTenantNotices() {
    const notices = JSON.parse(localStorage.getItem('notices')) || [];
    const container = document.getElementById('tenantNotices');
    
    if (notices.length === 0) {
        container.innerHTML = '<p>No notices at this time.</p>';
        return;
    }
    
    let html = '';
    notices.slice().reverse().forEach(notice => {
        html += `<div class="notice-item">
            <strong>📢 ${notice.title}</strong>
            <p>${notice.message}</p>
            <small>Posted: ${formatDate(notice.date)}</small>
        </div>`;
    });
    
    container.innerHTML = html;
}

function handleTenantSearch() {
    const searchTerm = document.getElementById('tenantSearch').value.toLowerCase();
    const payments = JSON.parse(localStorage.getItem('payments')) || [];
    const tenantPayments = payments.filter(p => p.tenantId === currentTenant.id);
    
    const filtered = tenantPayments.filter(p => 
        p.month.toLowerCase().includes(searchTerm) ||
        currentTenant.name.toLowerCase().includes(searchTerm) ||
        currentTenant.room.toString().includes(searchTerm)
    );
    
    const container = document.getElementById('tenantSearchResults');
    
    if (searchTerm.length < 2) {
        container.innerHTML = '';
        return;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="status-pending" style="padding: 1rem;">No matching records found.</p>';
        return;
    }
    
    let html = '<h4>🔍 Search Results:</h4>能<table><thead> hilab<th>Month</th><th>Total</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(p => {
        html += `<tr>
            <td>${p.month}</td>
            <td>KES ${(p.total || 8670) + (p.penalty || 0)}</td>
            <td>${p.status}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Logout function
function logout() {
    sessionStorage.removeItem('currentTenant');
    window.location.href = 'index.html';
}