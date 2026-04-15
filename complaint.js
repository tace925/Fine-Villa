// complaint.js - Complaint Submission Logic

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('complaintForm')?.addEventListener('submit', handleComplaintSubmit);
});

function handleComplaintSubmit(e) {
    e.preventDefault();
    
    const complaint = {
        id: Date.now(),
        tenantName: document.getElementById('complainantName').value,
        room: document.getElementById('complainantRoom').value,
        phone: document.getElementById('complainantPhone').value,
        subject: document.getElementById('complaintSubject').value,
        message: document.getElementById('complaintMessage').value,
        date: new Date().toISOString(),
        status: 'pending'
    };
    
    const complaints = JSON.parse(localStorage.getItem('complaints'));
    complaints.push(complaint);
    localStorage.setItem('complaints', JSON.stringify(complaints));
    
    showToast('Your complaint has been submitted. Admin will review it shortly.', 'success');
    
    document.getElementById('complaintForm').reset();
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}