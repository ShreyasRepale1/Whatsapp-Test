const { Client, LocalAuth } = require('whatsapp-web.js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Adjust this to point to ../data/chats.xlsx (since your JS is in backend/)
const EXCEL_PATH = path.join(__dirname, '..', 'data', 'chats.xlsx');

// Follow-up trigger days
const FOLLOWUP_DAYS = [1, 3, 5];

// Your follow-up message
const FOLLOWUP_MESSAGE = "Hi 👋 Just following up to check in with you. Let me know if you have any questions! 😊";

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

client.on('qr', qr => {
    console.log('Scan this QR code to log in:');
    const qrcode = require('qrcode-terminal');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async() => {
    console.log('✅ WhatsApp Client is ready!');

    // Check Excel file exists
    if (!fs.existsSync(EXCEL_PATH)) {
        console.error('❌ chats.xlsx file not found!');
        process.exit(1);
    }

    // Load Excel data
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);
    console.log(`📄 Loaded ${data.length} rows from Excel.`);

    // Filter targets with Day Counter 1, 3, or 5
    const targets = data.filter(row =>
        FOLLOWUP_DAYS.includes(Number(row['Day Counter'])) &&
        row.Number
    );

    console.log(`🎯 Found ${targets.length} contacts for follow-up.`);

    for (const contact of targets) {
        const number = `${contact.Number}@c.us`;
        try {
            const chat = await client.getChatById(number);

            if (!chat) {
                console.log(`⚠️ Chat not found for ${contact.Number}`);
                continue;
            }

            await chat.sendMessage(FOLLOWUP_MESSAGE);
            console.log(`✅ Sent to ${contact.Name} (${contact.Number})`);

            // Delay between messages to avoid spam detection
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
            console.error(`❌ Error sending to ${contact.Number}:`, err.message);
        }
    }

    console.log('📤 Follow-up process completed.');
    process.exit(0);
});

client.initialize();