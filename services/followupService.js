const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const manager = require('./whatsappManager');

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'chats.xlsx');
const DEFAULT_FOLLOWUP_DAYS = [1, 3, 5];
const FOLLOWUP_MESSAGE = "Hi 👋 Just following up to check in with you. Let me know if you have any questions! 😊";

async function sendFollowupsFor(id, days = null) {
    const client = manager.getClientInstance(id);
    const status = manager.getClientStatus(id);
    if (!client || !status || status.status !== 'CONNECTED') {
        throw new Error('Client not connected');
    }

    if (!fs.existsSync(EXCEL_PATH)) throw new Error('chats.xlsx not found');

    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    const followupDays = days
        ? days.split(',').map(d => parseInt(d.trim(), 10)).filter(Boolean)
        : DEFAULT_FOLLOWUP_DAYS;

    const targets = data.filter(row => followupDays.includes(Number(row['Day Counter'])) && row.Number);
    console.log(`🎯 [${id}] Sending follow-ups to ${targets.length} contacts for days: ${followupDays.join(', ')}`);

    let sent = 0;
    for (const contact of targets) {
        try {
            const chat = await client.getChatById(`${contact.Number}@c.us`);
            if (!chat) continue;
            await chat.sendMessage(FOLLOWUP_MESSAGE);
            sent++;
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.warn(`Error sending to ${contact.Number}`, err && err.message);
        }
    }

    console.log(`✅ [${id}] Followups sent: ${sent}`);
    return { message: 'Follow-ups sent', total: sent };
}

module.exports = sendFollowupsFor;
