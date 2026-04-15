// script.js - Shared Functions for Fine Villa Apartments

// Dark Mode Toggle
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark');
    }
    
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', document.body.classList.contains('dark'));
        });
    }
}

// Typing Animation
function initTypingAnimation(elementId, text) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let i = 0;
    element.innerHTML = '';
    
    function typeWriter() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    }
    
    typeWriter();
}

// Show Notification Toast
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '1rem 2rem';
    toast.style.backgroundColor = type === 'success' ? '#10B981' : '#EF4444';
    toast.style.color = 'white';
    toast.style.borderRadius = '10px';
    toast.style.zIndex = '3000';
    toast.style.animation = 'slideIn 0.3s ease';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Format Date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Initialize LocalStorage Data
function initStorage() {
    // Tenants data
    if (!localStorage.getItem('tenants')) {
        const tenants = [
            { id: 1, name: "John Mwangi", room: "101", floor: 1, phone: "0712345678", email: "john@email.com", password: "tenant123", status: "active", moveOutChecked: false },
            { id: 2, name: "Mary Wanjiku", room: "205", floor: 2, phone: "0723456789", email: "mary@email.com", password: "tenant123", status: "active", moveOutChecked: false },
            { id: 3, name: "Peter Omondi", room: "312", floor: 3, phone: "0734567890", email: "peter@email.com", password: "tenant123", status: "active", moveOutChecked: false }
        ];
        localStorage.setItem('tenants', JSON.stringify(tenants));
    }
    
    // Payments
    if (!localStorage.getItem('payments')) {
        const payments = [
            { id: 1, tenantId: 1, tenantName: "John Mwangi", room: "101", month: "April 2026", rent: 8500, water: 170, total: 8670, status: "pending", dueDate: "2026-04-05", penalty: 0 },
            { id: 2, tenantId: 2, tenantName: "Mary Wanjiku", room: "205", month: "April 2026", rent: 8500, water: 170, total: 8670, status: "paid", dueDate: "2026-04-05", penalty: 0 }
        ];
        localStorage.setItem('payments', JSON.stringify(payments));
    }
    
    // Notices
    if (!localStorage.getItem('notices')) {
        const notices = [
            { id: 1, title: "Garbage Collection", message: "Garbage collection every Wednesday. Please use paper bags.", date: new Date().toISOString() },
            { id: 2, title: "Security Update", message: "24/7 security available. CCTV coming soon!", date: new Date().toISOString() }
        ];
        localStorage.setItem('notices', JSON.stringify(notices));
    }
    
    // Security Logs
    if (!localStorage.getItem('securityLogs')) {
        localStorage.setItem('securityLogs', JSON.stringify([]));
    }
    
    // Complaints
    if (!localStorage.getItem('complaints')) {
        localStorage.setItem('complaints', JSON.stringify([]));
    }
    
    // Vacant Rooms
    if (!localStorage.getItem('vacantRooms')) {
        const vacant = [];
        for (let i = 1; i <= 200; i++) {
            const occupied = [101, 205, 312];
            if (!occupied.includes(i)) {
                vacant.push({ room: i, floor: Math.ceil(i / 50), status: "vacant" });
            }
        }
        localStorage.setItem('vacantRooms', JSON.stringify(vacant));
    }
}// tenant.js - Tenant Dashboard Logic

let currentTenant = null;

document.addEventListener('DOMContentLoaded', () => {
    initTypingAnimation('typingText', 'Welcome To Fine Villa Apartments...');
    
    // Check if tenant is already logged in
    const savedTenant = getCurrentTenant();
    if (savedTenant) {
        currentTenant = savedTenant;
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
    const payments = JSON.parse(localStorage.getItem('payments'));
    const tenantPayments = payments.filter(p => p.tenantId === currentTenant.id);
    
    const container = document.getElementById('tenantPayments');
    
    if (tenantPayments.length === 0) {
        container.innerHTML = '<p>No payment records found.</p>';
        return;
    }
    
    let html = '<table><thead><tr><th>Month</th><th>Rent</th><th>Water</th><th>Total</th><th>Status</th><th>Penalty</th></tr></thead><tbody>';
    
    tenantPayments.forEach(p => {
        const statusClass = p.status === 'paid' ? 'status-paid' : 'status-pending';
        html += `<tr>
            <td>${p.month}</td>
            <td>KES ${p.rent}</td>
            <td>KES ${p.water}</td>
            <td>KES ${p.total + (p.penalty || 0)}</td>
            <td><span class="${statusClass}">${p.status}</span></td>
            <td>${p.penalty ? 'KES ' + p.penalty : 'None'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function loadTenantNotices() {
    const notices = JSON.parse(localStorage.getItem('notices'));
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
    const payments = JSON.parse(localStorage.getItem('payments'));
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
    
    let html = '<h4>🔍 Search Results:</h4><table><thead><tr><th>Month</th><th>Total</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(p => {
        html += `<tr>
            <td>${p.month}</td>
            <td>KES ${p.total + (p.penalty || 0)}</td>
            <td>${p.status}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Get Current Tenant (from session)
function getCurrentTenant() {
    const tenant = sessionStorage.getItem('currentTenant');
    return tenant ? JSON.parse(tenant) : null;
}

// Logout
function logout() {
    sessionStorage.removeItem('currentTenant');
    window.location.href = 'index.html';
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    initStorage();
    initDarkMode();
});