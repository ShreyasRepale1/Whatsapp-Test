// services/whatsappClient.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
let qrCodeData = null;
let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', async qr => {
    qrCodeData = await qrcode.toDataURL(qr);
    isReady = false;
    console.log('📲 QR Code generated for WhatsApp connection.');
});

client.on('ready', () => {
    isReady = true;
    qrCodeData = null;
    console.log('✅ WhatsApp Client is ready!');
});

client.initialize();

module.exports = {
    client,
    getStatus: () => ({ isReady, qrCodeData })
};