const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const path = require('path');

router.get('/', (req, res) => {
    const workbook = xlsx.readFile(path.join(__dirname, '../data/chats.xlsx'));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const totalLeads = data.length;

    const sources = {};
    const statusCount = {};
    let repliesDone = 0;
    let repliesPending = 0;

    data.forEach(row => {
        const source = row.Source || 'Unknown';
        sources[source] = (sources[source] || 0) + 1;

        const status = row.Status || 'Unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;

        if (String(row.Replies).toLowerCase() === 'true') {
            repliesDone++;
        } else {
            repliesPending++;
        }
    });

    res.render('dashboard', {
        data,
        totalLeads,
        sources,
        repliesDone,
        repliesPending,
        statusCount,
        activeCount: statusCount['Active'] || 0
    });
});

module.exports = router;