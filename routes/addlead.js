const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelPath = path.join(__dirname, '../data/chats.xlsx');

function getFormattedDateTime() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1); // Months are 0-indexed
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// GET: Show form
router.get('/', (req, res) => {
    res.render('addlead');
});

// POST: Save form data
router.post('/', (req, res) => {
    const { name, number, message, status, replies, notes, source } = req.body;

    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const newRow = {
        Name: name,
        Number: number,
        "Last Message": message,
        "Last Interaction Date": getFormattedDateTime(),
        "Day Counter": 0,
        Status: status,
        Replies: replies,
        Notes: notes,
        Source: source
    };

    data.push(newRow);
    const newSheet = xlsx.utils.json_to_sheet(data);
    workbook.Sheets[workbook.SheetNames[0]] = newSheet;
    xlsx.writeFile(workbook, excelPath);

    res.redirect('/dashboard');
});

module.exports = router;