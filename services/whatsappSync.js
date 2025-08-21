// services/whatsappSync.js
const XLSX = require('xlsx');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const pLimit = require('p-limit').default;
const manager = require('./whatsappManager');

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'chats.xlsx');

async function syncChatsFor(id, days = null) {
    console.log(`🔄 Starting WhatsApp sync for ${id}...`);

    const client = manager.getClientInstance(id);
    if (!client) throw new Error(`Client ${id} not found or not connected`);

    // Default to 2 days if no input
    const daysBack = days && Number.isInteger(days) ? days : 2;
    const timeThreshold = moment().subtract(daysBack, 'days');
    console.log(`📅 Sync threshold: last ${daysBack} days`);

    const chats = await client.getChats();
    let contactsMap = {};

    // Load existing Excel data if present
    if (fs.existsSync(EXCEL_PATH)) {
        const wb = XLSX.readFile(EXCEL_PATH);
        const ws = wb.Sheets[wb.SheetNames[0]];
        XLSX.utils.sheet_to_json(ws).forEach(row => {
            contactsMap[row.Number] = row;
        });
    }

    const limit = pLimit(10);
    const today = moment().startOf('day');

    const processChat = async(chat) => {
        if (chat.isGroup) return;

        const messages = await chat.fetchMessages({ limit: 5 });
        const recentMessages = messages.filter(m => moment(m.timestamp * 1000).isAfter(timeThreshold));
        if (recentMessages.length === 0) return;

        const lastMessage = messages[messages.length - 1];
        const contact = await chat.getContact();
        const number = contact.number;
        const name = contact.pushname || contact.name || 'Unknown';

        const userMessages = recentMessages.filter(m => !m.fromMe);
        if (userMessages.length === 0) return;

        const msgText = userMessages[userMessages.length - 1].body || '[non-text message]';
        const interactionTime = moment(lastMessage.timestamp * 1000);
        const time = interactionTime.format('YYYY-MM-DD HH:mm:ss');
        const daysSinceInteraction = today.diff(interactionTime.startOf('day'), 'days');

        if (!contactsMap[number]) {
            // New contact
            contactsMap[number] = {
                Name: name,
                Number: number,
                'Last Message': msgText,
                'Last Interaction Date': time,
                'Day Counter': daysSinceInteraction, // ✅ now calculated
                Status: 'New',
                Replies: 'false',
                Notes: '',
                Source: 'WhatsApp'
            };
        } else {
            // Existing contact
            const existing = contactsMap[number];
            existing['Day Counter'] = daysSinceInteraction;
            existing['Last Message'] = msgText;
            existing['Last Interaction Date'] = time;
            existing.Status = 'Active';
            existing.Replies = lastMessage.fromMe ? 'true' : 'false';
        }
    };

    await Promise.all(chats.map(chat => limit(() => processChat(chat))));

    const finalData = Object.values(contactsMap);
    const wsNew = XLSX.utils.json_to_sheet(finalData);
    const wbNew = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbNew, wsNew, 'Chats');
    XLSX.writeFile(wbNew, EXCEL_PATH);

    console.log(`✅ WhatsApp sync completed for ${id}. ${finalData.length} records saved.`);
    return { message: 'Sync completed', total: finalData.length };
}

module.exports = syncChatsFor;
