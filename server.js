const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const SEEDS_FILE = path.join(DATA_DIR, 'seeds.json');
const APPLICANTS_FILE = path.join(DATA_DIR, 'applicants.json');

// Ensure applicants file exists
if (!fs.existsSync(APPLICANTS_FILE)) {
    fs.writeFileSync(APPLICANTS_FILE, '[]');
}

// Utility functions to read/write JSON
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

// API Router
const apiRouter = express.Router();

// API: Get Seed List
apiRouter.get('/seeds', (req, res) => {
    try {
        const seeds = readJson(SEEDS_FILE);
        res.json(seeds);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load seeds' });
    }
});

// API: Submit Application
apiRouter.post('/apply', (req, res) => {
    try {
        const { name, phone, address, isMember, selectedSeeds } = req.body;

        // Basic Validation
        if (!name || !phone || !address || !selectedSeeds) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const maxSeeds = isMember ? 10 : 5;
        if (selectedSeeds.length > maxSeeds) {
            return res.status(400).json({ error: `You can only select up to ${maxSeeds} seeds.` });
        }

        const seeds = readJson(SEEDS_FILE);

        // Check stock and decrement
        for (const seedId of selectedSeeds) {
            const seedIndex = seeds.findIndex(s => s.id === seedId);
            if (seedIndex === -1) {
                return res.status(400).json({ error: `Invalid seed ID: ${seedId}` });
            }
            if (seeds[seedIndex].quantity <= 0) {
                return res.status(400).json({ error: `Seed ${seeds[seedIndex].name} is out of stock.` });
            }
        }

        // Apply decrement
        selectedSeeds.forEach(seedId => {
            const seed = seeds.find(s => s.id === seedId);
            seed.quantity -= 1;
        });
        writeJson(SEEDS_FILE, seeds);

        // Save Applicant
        const applicants = readJson(APPLICANTS_FILE);
        applicants.push({
            id: Date.now(),
            name,
            phone,
            address,
            isMember,
            selectedSeeds,
            timestamp: new Date().toISOString()
        });
        writeJson(APPLICANTS_FILE, applicants);

        res.json({ success: true, message: 'Application submitted successfully!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process application' });
    }
});

// API: Get Applicants (Admin)
apiRouter.get('/applicants', (req, res) => {
    try {
        const applicants = readJson(APPLICANTS_FILE);
        res.json(applicants);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load applicants' });
    }
});

// API: Delete All Applicants (Admin)
apiRouter.delete('/applicants', (req, res) => {
    try {
        writeJson(APPLICANTS_FILE, []);
        res.json({ success: true, message: 'All applicants deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete applicants' });
    }
});

// API: Update Seed Stock (Admin)
apiRouter.post('/seeds', (req, res) => {
    try {
        const newSeeds = req.body;
        if (!Array.isArray(newSeeds)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        writeJson(SEEDS_FILE, newSeeds);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update seeds' });
    }
});

const upload = multer({ dest: 'uploads/' });

// API: Initialize Seeds from CSV (Admin)
apiRouter.post('/seeds/init', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            // Map CSV to Seed Object
            // Assumes headers: 번호, 과 (Family), 품종명, 개수(봉)
            results.push({
                id: parseInt(data['번호'] || data['id']),
                family: data['과 (Family)'] || data['family'],
                name: data['품종명'] || data['name'],
                quantity: parseInt(data['개수(봉)'] || data['quantity'])
            });
        })
        .on('end', () => {
            // Filter valid data
            const validSeeds = results.filter(s => s.id && s.name);

            writeJson(SEEDS_FILE, validSeeds);

            // Clean up uploaded file
            fs.unlinkSync(req.file.path);

            res.json({ success: true, count: validSeeds.length });
        })
        .on('error', (err) => {
            console.error(err);
            res.status(500).json({ error: 'Failed to parse CSV' });
        });
});

// Mount the API Router
app.use('/seed-sharing-2026/api', apiRouter);
// app.use('/api', apiRouter); // Optional fallback

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access the app at http://localhost:${PORT}/seed-sharing-2026/`);
});
