document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addConnectionBtn');
    const connectionsArea = document.getElementById('connectionsArea');
    const noConnections = document.getElementById('noConnections');
    const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
    const qrImage = document.getElementById('qrImage');
    const qrStatusText = document.getElementById('qrStatusText');

    // New modals
    const syncModal = new bootstrap.Modal(document.getElementById('syncModal'));
    const followModal = new bootstrap.Modal(document.getElementById('followModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));

    // Toast container
    const toastContainer = document.getElementById('toastContainer');

    let currentActionId = null;

    function showToast(message, type = 'success') {
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-bg-${type} border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        toastContainer.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    async function fetchList() {
        const res = await fetch('/whatsapp/list');
        const data = await res.json();
        renderList(data.list || []);
    }

    function renderList(list) {
        connectionsArea.innerHTML = '';
        if (!list.length) {
            connectionsArea.appendChild(noConnections);
            noConnections.style.display = 'block';
            return;
        }
        noConnections.style.display = 'none';
        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card mb-3';
            card.innerHTML = `
                <div class="card-body d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="card-title mb-1">${item.id}</h5>
                        <p class="mb-0">Status: <span class="${item.status === 'CONNECTED' ? 'text-success' : 'text-danger'}">${item.status}</span></p>
                        <small class="text-muted">Last: ${item.lastActivity ? new Date(item.lastActivity).toLocaleString() : '-'}</small>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-primary fw-bold px-4 py-2 syncBtn" data-id="${item.id}">Sync</button>
                        <button class="btn btn-sm btn-success fw-bold px-4 py-2 followBtn" data-id="${item.id}">Follow-ups</button>
                        <button class="btn btn-sm btn-danger fw-bold px-4 py-2 delBtn" data-id="${item.id}">Delete</button>
                    </div>
                </div>
            `;
            connectionsArea.appendChild(card);
        });

        document.querySelectorAll('.syncBtn').forEach(b => b.onclick = () => { currentActionId = b.dataset.id; document.getElementById('syncDays').value = "2"; syncModal.show(); });
        document.querySelectorAll('.followBtn').forEach(b => b.onclick = () => { currentActionId = b.dataset.id; document.getElementById('followDays').value = "1,3,5"; followModal.show(); });
        document.querySelectorAll('.delBtn').forEach(b => b.onclick = () => { currentActionId = b.dataset.id; deleteModal.show(); });
    }

    addBtn.addEventListener('click', async () => {
        const res = await fetch('/whatsapp/create', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (!data || !data.id) return showToast('Create failed', 'danger');
        qrImage.style.display = 'none';
        qrImage.src = '';
        qrStatusText.innerText = 'Waiting for QR...';
        qrModal.show();
        pollQrAndStatus(data.id);
    });

    let qrPollInterval = null;

    function pollQrAndStatus(id) {
        if (qrPollInterval) clearInterval(qrPollInterval);
        async function poll() {
            try {
                const res = await fetch(`/whatsapp/status/${id}`);
                const st = await res.json(); // full response

                if (st.qrDataUrl) {
                    qrImage.src = st.qrDataUrl;
                    qrImage.style.display = 'block';
                    qrStatusText.innerText = 'Scan QR with WhatsApp on phone';
                } else if (st.status === 'CONNECTED') {
                    qrModal.hide();
                    clearInterval(qrPollInterval);
                    await fetchList();
                } else {
                    qrStatusText.innerText = `Status: ${st.status || '...'}`;
                }
            } catch (e) {
                console.warn('poll error', e);
            }
        }
        poll();
        qrPollInterval = setInterval(poll, 3000);
    }

    // Sync confirm
    document.getElementById('syncConfirm').addEventListener('click', async () => {
        const days = document.getElementById('syncDays').value || "2";
        syncModal.hide();
        const res = await fetch(`/whatsapp/sync/${currentActionId}?days=${encodeURIComponent(days)}`, { method: 'POST' });
        const json = await res.json();
        showToast(json.message || 'Sync done', res.ok ? 'success' : 'danger');
    });

    // Follow-up confirm
    document.getElementById('followConfirm').addEventListener('click', async () => {
        const days = document.getElementById('followDays').value || "1,3,5";
        followModal.hide();
        const res = await fetch(`/whatsapp/followup/${currentActionId}?days=${encodeURIComponent(days)}`, { method: 'POST' });
        const json = await res.json();
        showToast(json.message || 'Followups done', res.ok ? 'success' : 'danger');
    });

    // Delete confirm
    document.getElementById('deleteConfirm').addEventListener('click', async () => {
        deleteModal.hide();
        const res = await fetch(`/whatsapp/${currentActionId}`, { method: 'DELETE' });
        const json = await res.json();
        showToast(json.message || 'Deleted', res.ok ? 'success' : 'danger');
        fetchList();
    });

    setInterval(fetchList, 5000);
    fetchList();
});
