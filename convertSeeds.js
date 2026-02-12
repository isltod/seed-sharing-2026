const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const csvFilePath = path.join(__dirname, '2026씨앗나눔리스트.csv');
const jsonFilePath = path.join(__dirname, 'data', 'seeds.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

const results = [];

fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
        // Map CSV headers to JSON properties
        // CSV: 번호,과 (Family),품종명,개수(봉)
        // JSON: id, family, name, quantity
        results.push({
            id: parseInt(data['번호']),
            family: data['과 (Family)'],
            name: data['품종명'],
            quantity: parseInt(data['개수(봉)'])
        });
    })
    .on('end', () => {
        fs.writeFileSync(jsonFilePath, JSON.stringify(results, null, 2));
        console.log(`Successfully converted ${results.length} seeds to JSON.`);
    });
