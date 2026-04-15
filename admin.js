// ==================== FINAL FULL admin.js - Fine Villa Apartments ====================

let tenants = JSON.parse(localStorage.getItem('tenants')) || [];
let payments = JSON.parse(localStorage.getItem('payments')) || [];
let notices = JSON.parse(localStorage.getItem('notices')) || [];
let securityLogs = JSON.parse(localStorage.getItem('securityLogs')) || [];

// ====================== INITIALIZE ======================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);
    document.getElementById('addTenantForm')?.addEventListener('submit', handleAddTenant);

     document.getElementById('adminGlobalSearch')?.addEventListener('input', handleAdminSearch);
    
    loadAdminData();
});

// ====================== ADMIN LOGIN ======================
function handleAdminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    if (password === 'Tev.13n') {
        document.getElementById('adminLoginSection').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadAdminData();
        showToast('Welcome Admin!', 'success');
    } else {
        showToast('Wrong Password! Use: Tev.13n', 'danger');
    }
}

// ====================== ADD NEW TENANT ======================
function handleAddTenant(e) {
    e.preventDefault();

    const name = document.getElementById('newTenantName').value.trim();
    const room = parseInt(document.getElementById('newTenantRoom').value);
    const phone = document.getElementById('newTenantPhone').value.trim();
    const email = document.getElementById('newTenantEmail').value.trim();
    const floor = parseInt(document.getElementById('newTenantFloor').value);

    if (!name || !room || !phone || !email || !floor) {
        showToast('Please fill all fields', 'danger');
        return;
    }

    const tenantId = generateTenantId(room, name);
    const password = generatePassword();

    const newTenant = {
        id: Date.now(),
        tenantId: tenantId,
        name: name,
        room: room,
        floor: floor,
        phone: phone,
        email: email,
        password: password,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    tenants.push(newTenant);
    localStorage.setItem('tenants', JSON.stringify(tenants));

    // Auto create payment record
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  // FIXED - added rent and water fields
payments.push({
    id: Date.now(),
    tenantId: newTenant.id,
    tenantName: name,
    room: room,
    month: currentMonth,
    rent: 8500,
    water: 170,
    total: 8670,
    status: 'pending',
    dueDate: new Date().toISOString().split('T')[0]
});
    // Show credentials
    const credDiv = document.getElementById('generatedCredentials');
    credDiv.style.display = 'block';
    credDiv.innerHTML = `
        <h4>✅ Tenant Created Successfully!</h4>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Room:</strong> ${room} (Floor ${floor})</p>
        <p><strong>Tenant ID:</strong> <code>${tenantId}</code></p>
        <p><strong>Password:</strong> <code>${password}</code></p>
        <button onclick="copyCredentials('${tenantId}', '${password}')" class="btn btn-blue">📋 Save Credentials</button>
    `;

    e.target.reset();
    loadAdminData();
    showToast(`Tenant ${name} added successfully!`, 'success');
}

// ====================== HELPERS ======================
function generateTenantId(room, name) {
    const initials = name.substring(0, 2).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `FV-${room.toString().padStart(3, '0')}-${initials}${random}`;
}

function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    return pass;
}

function copyCredentials(id, pass) {
    navigator.clipboard.writeText(`Tenant ID: ${id}\nPassword: ${pass}`);
    showToast('Credentials copied!', 'success');
}

// ====================== LOAD DATA ======================
function loadAdminData() {
    updateStats();
    loadPaymentsTable();
    loadVacantRooms();
    loadTenantSelect();
    loadNotices();
    loadSecurityLogs();
}

function updateStats() {
    const active = tenants.filter(t => t.status !== 'cancelled' && t.status !== 'moved_out').length;
    const pendingPay = payments.filter(p => p.status === 'pending').length;
    const vacant = 200 - active;

    document.getElementById('totalTenants').innerText = active;
    document.getElementById('pendingPayments').innerText = pendingPay;
    document.getElementById('vacantRooms').innerText = vacant;
}

// ====================== PAYMENT RECORDS ======================
function loadPaymentsTable() {
    const container = document.getElementById('adminPayments');
    if (!container) return;

    let html = `<table style="width:100%; border-collapse:collapse;">
                <tr><th>Tenant</th><th>Room</th><th>Month</th><th>Amount</th><th>Status</th><th>Action</th></tr>`;

    payments.forEach((p, i) => {
        const tenant = tenants.find(t => t.id === p.tenantId);
        html += `
            <tr>
                <td>${tenant ? tenant.name : 'Unknown'}</td>
                <td>${p.room}</td>
                <td>${p.month}</td>
                <td>KES ${p.total}</td>
                <td><span class="${p.status}">${p.status}</span></td>
                <td>
                    ${p.status === 'pending' ? `<button onclick="markAsPaid(${i})" class="btn btn-success">Mark Paid</button>` : 'Paid'}
                </td>
            </tr>`;
    });
    container.innerHTML = html || '<p>No payments recorded yet.</p>';
}

function markAsPaid(index) {
    payments[index].status = 'paid';
    localStorage.setItem('payments', JSON.stringify(payments));
    loadPaymentsTable();
    updateStats();
    showToast('Payment marked as Paid', 'success');
}

// ====================== MOVE-OUT CHECKLIST ======================
function loadTenantSelect() {
    const select = document.getElementById('checklistTenantSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Tenant</option>';

    tenants.filter(t => t.status === 'pending' || t.status === 'active').forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name} - Room ${t.room}</option>`;
    });
}

function confirmMoveOut() {
    const tenantId = document.getElementById('checklistTenantSelect').value;
    if (!tenantId) return alert('Please select a tenant');

    const allChecked = Array.from(document.querySelectorAll('#checklistItems input[type="checkbox"]'))
                           .every(cb => cb.checked);

    if (!allChecked) return alert('All checklist items must be ticked!');

    const tenant = tenants.find(t => t.id == tenantId);
    if (tenant) {
        tenant.status = 'pending_move_out';
        localStorage.setItem('tenants', JSON.stringify(tenants));

        // ✅ NEW: Visible success box (like credentials)
        const successBox = document.createElement('div');
        successBox.style.cssText = 'background:#1e2937; padding:15px; border-radius:10px; margin:15px 0; color:#4ade80; border-left:5px solid #4ade80;';
        successBox.innerHTML = `
            <h4>✅ Move-Out Process Started</h4>
            <p><strong>Tenant:</strong> ${tenant.name}</p>
            <p><strong>Room:</strong> ${tenant.room}</p>
            <p><strong>Status:</strong> Pending Final Move-Out</p>
        `;
        document.getElementById('checklistItems').appendChild(successBox);

        loadAdminData();
    }
}
// ====================== SECURITY LOG ======================
function logCheckIn() {
    const name = document.getElementById('guardName').value.trim();
    if (!name) return showToast('Enter guard name first', 'danger');

    securityLogs.push({ type: 'Check In', name: name, time: new Date().toLocaleTimeString() });
    localStorage.setItem('securityLogs', JSON.stringify(securityLogs));
    loadSecurityLogs();
    showToast(`${name} checked IN`, 'success');
}

function logCheckOut() {
    const name = document.getElementById('guardName').value.trim();
    if (!name) return showToast('Enter guard name first', 'danger');

    securityLogs.push({ type: 'Check Out', name: name, time: new Date().toLocaleTimeString() });
    localStorage.setItem('securityLogs', JSON.stringify(securityLogs));
    loadSecurityLogs();
    showToast(`${name} checked OUT`, 'success');
}

function loadSecurityLogs() {
    const container = document.getElementById('securityLogs');
    if (!container) return;

    container.innerHTML = securityLogs.map(log => `
        <p><strong>${log.time}</strong> - ${log.name} 
        <span style="color:${log.type==='Check In'?'#22c55e':'#ef4444'}">(${log.type})</span></p>
    `).join('');
}

// ====================== NOTICES ======================
function postNotice() {
    const title = document.getElementById('noticeTitle').value.trim();
    const message = document.getElementById('noticeMessage').value.trim();
    if (!title || !message) return showToast('Title and message required', 'danger');

    notices.unshift({ id: Date.now(), title, message, date: new Date().toLocaleDateString() });
    localStorage.setItem('notices', JSON.stringify(notices));
    loadNotices();
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeMessage').value = '';
    showToast('Notice posted!', 'success');
}

function loadNotices() {
    const container = document.getElementById('adminNotices');
    if (!container) return;
    container.innerHTML = notices.map(n => `
        <div class="notice-item">
            <strong>${n.title}</strong> <small>${n.date}</small>
            <p>${n.message}</p>
        </div>
    `).join('');
}
// ====================== ADMIN SEARCH FUNCTION ======================
function handleAdminSearch() {
    const searchTerm = document.getElementById('adminGlobalSearch')?.value.toLowerCase().trim() || '';
    const container = document.getElementById('adminSearchResults');
    
    if (!container) return;
    
    // If search is empty, clear results
    if (searchTerm.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // Search in tenants by name, room, phone, tenantId
    const filteredTenants = tenants.filter(t => 
        t.name.toLowerCase().includes(searchTerm) ||
        t.room.toString().includes(searchTerm) ||
        (t.phone && t.phone.includes(searchTerm)) ||
        (t.tenantId && t.tenantId.toLowerCase().includes(searchTerm))
    );
    
    // Search in payments by tenant name or month
    const filteredPayments = payments.filter(p => 
        p.tenantName.toLowerCase().includes(searchTerm) ||
        p.month.toLowerCase().includes(searchTerm) ||
        p.room.toString().includes(searchTerm)
    );
    
    let html = `<h4>🔍 Search Results for: "<strong>${searchTerm}</strong>"</h4>`;
    
    // Display tenants found
    if (filteredTenants.length > 0) {
        html += '<p><strong>👥 Tenants Found:</strong></p><ul style="list-style: none; padding-left: 0;">';
        filteredTenants.forEach(t => {
            html += `<li style="margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(212,175,55,0.1); border-radius: 8px;">
                <strong>${t.name}</strong> - Room ${t.room} (Floor ${t.floor})<br>
                <small>Tenant ID: ${t.tenantId} | Phone: ${t.phone || 'N/A'} | Status: ${t.status}</small>
            </li>`;
        });
        html += '</ul>';
    } else {
        html += '<p><strong>👥 Tenants:</strong> ❌ No tenants found matching your search.</p>';
    }
    
    // Display payments found (optional - show first 5)
    if (filteredPayments.length > 0) {
        html += '<p><strong>💰 Payments Found:</strong></p><ul style="list-style: none; padding-left: 0;">';
        filteredPayments.slice(0, 5).forEach(p => {
            html += `<li style="margin-bottom: 0.5rem; padding: 0.3rem 0.5rem; background: rgba(59,130,246,0.1); border-radius: 5px;">
                ${p.tenantName} - Room ${p.room} - ${p.month} - <span style="color: ${p.status === 'paid' ? '#10b981' : '#f59e0b'}">${p.status}</span>
            </li>`;
        });
        if (filteredPayments.length > 5) {
            html += `<li><em>... and ${filteredPayments.length - 5} more payments</em></li>`;
        }
        html += '</ul>';
    }
    
    container.innerHTML = html;
}

// ====================== REFRESH & LOGOUT ======================
function refreshDashboard() {
    // Hard refresh the page - reloads everything fresh
    window.location.reload();
}

function adminLogout() {
    // Get the elements
    const loginSection = document.getElementById('adminLoginSection');
    const dashboard = document.getElementById('adminDashboard');
    const passwordInput = document.getElementById('adminPassword');
    
    // Hide dashboard, show login section
    if (loginSection) loginSection.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';
    
    // Clear password field
    if (passwordInput) passwordInput.value = '';
}

// ====================== UTILITIES ======================
function loadVacantRooms() {
    // Placeholder - you can expand later
    console.log('Vacant rooms updated');
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;color:white;background:${type==='success'?'#10b981':'#ef4444'};z-index:10000;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// Make functions global for HTML onclick
window.markAsPaid = markAsPaid;
window.confirmMoveOut = confirmMoveOut;
window.logCheckIn = logCheckIn;
window.logCheckOut = logCheckOut;
window.postNotice = postNotice;
window.copyCredentials = copyCredentials;
window.refreshDashboard = refreshDashboard;  
window.adminLogout = adminLogout;            