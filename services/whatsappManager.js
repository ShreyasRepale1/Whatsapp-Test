const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer'); // ✅ added

const connectionsFile = path.join(__dirname, '../data/connections.json');
const sessionsDir = path.join(process.cwd(), '.wwebjs_auth');

let clients = {}; // { id: { instance, status, lastActivity, qr, qrShown } }

// Ensure data folder exists
if (!fs.existsSync(path.dirname(connectionsFile))) {
    fs.mkdirSync(path.dirname(connectionsFile), { recursive: true });
}

// Save connections to file
function saveConnectionsToFile() {
    fs.writeFileSync(connectionsFile, JSON.stringify(Object.keys(clients), null, 2));
}

// Load connections from file
function loadConnectionsFromFile() {
    if (fs.existsSync(connectionsFile)) {
        try {
            const ids = JSON.parse(fs.readFileSync(connectionsFile));
            ids.forEach(id => createClient(id, false)); // Restore without resaving immediately
        } catch (err) {
            console.error('Error reading connections file:', err);
        }
    }
}

// Create a new WhatsApp client
function createClient(id, save = true, retry = true, headlessMode = "new") {
    if (clients[id]) {
        console.log(`Client ${id} already exists.`);
        return clients[id];
    }

    console.log(`Starting WhatsApp client for ${id}... (headless: ${headlessMode})`);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: id }),
        puppeteer: {
            headless: headlessMode,
            executablePath: puppeteer.executablePath(), // ✅ force correct Chromium
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-gpu'
            ]
        }
    });

    clients[id] = { instance: client, status: 'INITIALIZING', lastActivity: null, qr: null, qrShown: false };

    client.on('qr', async qr => {
        clients[id].status = 'QR';
        clients[id].qr = await qrcode.toDataURL(qr);

        if (!clients[id].qrShown) {
            console.log(`📲 QR Code generated for ${id}`);
            clients[id].qrShown = true;
        }

        saveConnectionsToFile();
    });

    client.on('ready', () => {
        clients[id].status = 'CONNECTED';
        clients[id].qr = null;
        clients[id].lastActivity = new Date();
        console.log(`✅ Client ${id} connected.`);
        saveConnectionsToFile();
    });

    client.on('disconnected', reason => {
        clients[id].status = 'DISCONNECTED';
        console.warn(`⚠️ Client ${id} disconnected: ${reason}`);
        saveConnectionsToFile();
    });

    client.on('auth_failure', msg => {
        console.error(`❌ Auth failure for ${id}: ${msg}`);
    });

    client.on('error', err => {
        console.error(`Error for client ${id}:`, err.message || err);

        // Self-heal if Puppeteer crashes
        if (retry && err.message && err.message.includes('Target closed')) {
            console.warn(`Puppeteer crashed for ${id}, retrying with fallback headless mode...`);
            deleteClient(id, false); // Remove but don't save yet

            // Retry: if was "new", fallback to false
            const nextHeadless = headlessMode === "new" ? false : "new";
            createClient(id, save, false, nextHeadless);
        }
    });

    try {
        client.initialize();
    } catch (err) {
        console.error(`Failed to initialize client ${id}:`, err.message || err);
        if (retry) {
            console.warn(`Retrying ${id} after session reset...`);
            deleteClient(id, false);
            createClient(id, save, false, headlessMode);
        }
    }

    if (save) saveConnectionsToFile();
    return clients[id];
}

// Delete a client and optionally remove from saved list
function deleteClient(id, updateFile = true) {
    if (!clients[id]) return false;

    try {
        clients[id].instance.destroy();
    } catch (err) {
        console.error(`Error destroying client ${id}:`, err);
    }

    delete clients[id];

    // Remove session folder
    const sessionPath = path.join(sessionsDir, `session-${id}`);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    if (updateFile) saveConnectionsToFile();
    return true;
}

// Get all clients
function getClients() {
    return Object.keys(clients).map(id => ({
        id,
        status: clients[id].status,
        lastActivity: clients[id].lastActivity,
        qr: clients[id].qr
    }));
}

// Get single client status
function getClientStatus(id) {
    if (!clients[id]) return null;
    return {
        id,
        status: clients[id].status,
        lastActivity: clients[id].lastActivity,
        qr: clients[id].qr
    };
}

// Get a specific client instance
function getClientInstance(id) {
    return clients[id] ? clients[id].instance : null;
}

// Load existing connections on startup
loadConnectionsFromFile();

module.exports = {
    createClient,
    deleteClient,
    getClients,
    getClientStatus,
    getClientInstance
};