const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const pLimit = require('p-limit').default; // ✅ Add this for concurrency control

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'chats.xlsx');

if (!fs.existsSync(path.dirname(EXCEL_PATH))) {
    fs.mkdirSync(path.dirname(EXCEL_PATH), { recursive: true });
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

client.on('qr', qr => {
    console.log('Scan the QR Code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async() => {
    console.log('✅ Client is ready!');

    const chats = await client.getChats();
    const timeThreshold = moment().subtract(1, 'days');
    let contactsMap = {};

    // Load existing Excel if available
    let wb, ws, existingData = [];
    if (fs.existsSync(EXCEL_PATH)) {
        wb = XLSX.readFile(EXCEL_PATH);
        ws = wb.Sheets[wb.SheetNames[0]];
        existingData = XLSX.utils.sheet_to_json(ws);
        existingData.forEach(row => {
            contactsMap[row.Number] = row;
        });
    }

    const limit = pLimit(10); // ✅ Limit concurrent operations to 10

    const processChat = async(chat) => {
        if (chat.isGroup) return;

        try {
            const messages = await chat.fetchMessages({ limit: 5 });
            const recentMessages = messages.filter(m => moment(m.timestamp * 1000).isAfter(timeThreshold));
            if (recentMessages.length === 0) return;

            const lastMessage = messages[messages.length - 1];
            const contact = await chat.getContact();
            const number = contact.number;
            const name = contact.pushname || contact.name || 'Unknown';

            const userMessages = recentMessages.filter(m => !m.fromMe);
            if (userMessages.length === 0) return;

            const lastUserMsg = userMessages[userMessages.length - 1];
            const msgText = lastUserMsg.body || '[non-text message]';
            const interactionTime = moment(lastMessage.timestamp * 1000);
            const time = interactionTime.format('YYYY-MM-DD HH:mm:ss');
            const today = moment().startOf('day');

            if (!contactsMap[number]) {
                contactsMap[number] = {
                    Name: name,
                    Number: number,
                    'Last Message': msgText,
                    'Last Interaction Date': time,
                    'Day Counter': 0,
                    Status: 'New',
                    Replies: 'false',
                    Notes: '',
                    Source: 'WhatsApp'
                };
            } else {
                const existing = contactsMap[number];
                const daysSinceInteraction = today.diff(interactionTime.startOf('day'), 'days');
                existing['Day Counter'] = daysSinceInteraction;
                existing['Last Message'] = msgText;
                existing['Last Interaction Date'] = time;
                existing.Status = 'Active';
            }

            const existing = contactsMap[number];
            existing.Replies = lastMessage.fromMe ? 'true' : 'false';

        } catch (err) {
            console.error(`⚠️ Error processing chat:`, err.message);
        }
    };

    // ✅ Parallel processing with concurrency limit
    await Promise.all(chats.map(chat => limit(() => processChat(chat))));

    // ✅ Write final Excel
    const finalData = Object.values(contactsMap);
    const wsNew = XLSX.utils.json_to_sheet(finalData, {
        header: ['Name', 'Number', 'Last Message', 'Last Interaction Date', 'Day Counter', 'Status', 'Replies', 'Notes', 'Source']
    });
    const wbNew = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbNew, wsNew, 'Chats');
    XLSX.writeFile(wbNew, EXCEL_PATH);

    console.log(`✅ Data saved to ${EXCEL_PATH}`);
});

client.initialize();