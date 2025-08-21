const express = require('express');
const router = express.Router();
const manager = require('../services/whatsappManager');
const syncChatsFor = require('../services/whatsappSync');
const sendFollowupsFor = require('../services/followupService');
const crypto = require('crypto');

router.get('/', (req, res) => res.render('whatsapp'));

router.get('/list', (req, res) => {
    try {
        const list = manager.getClients();
        res.json({ list });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/create', (req, res) => {
    try {
        const id = (req.body && req.body.id) || crypto.randomBytes(4).toString('hex');
        manager.createClient(id);
        const clientData = manager.getClientStatus(id);
        res.json({
            id,
            status: clientData ? clientData.status : null,
            qr: clientData ? clientData.qr : null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/status/:id', (req, res) => {
    const clientData = manager.getClientStatus(req.params.id);
    if (!clientData) return res.status(404).json({ error: 'Not found' });

    res.json({
        status: clientData.status,
        qrDataUrl: clientData.qr || null,
        lastActivity: clientData.lastActivity
    });
});

router.post('/sync/:id', async (req, res) => {
    const id = req.params.id;
    const days = req.query.days ? parseInt(req.query.days, 10) : null;
    try {
        const result = await syncChatsFor(id, days);
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: e.message || 'Sync error' });
    }
});

router.post('/followup/:id', async (req, res) => {
    const id = req.params.id;
    const days = req.query.days || null;
    try {
        const result = await sendFollowupsFor(id, days);
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: e.message || 'Followup error' });
    }
});

router.delete('/:id', (req, res) => {
    const id = req.params.id;
    try {
        const ok = manager.deleteClient(id);
        if (!ok) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message || 'Delete error' });
    }
});

module.exports = router;
