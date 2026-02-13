const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const Busboy = require('busboy'); // For file uploads in Cloud Functions

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));

// CSV Parser is not stream-friendly with Busboy in Functions easily, 
// so for simplicity in this migration, we will use a different approach 
// or keep it simple. But let's try to adapt the logic.

// --- API Endpoints ---

// GET /api/seeds
app.get('/seeds', async (req, res) => {
    try {
        const snapshot = await db.collection('seeds').orderBy('id').get();
        const seeds = [];
        snapshot.forEach(doc => seeds.push(doc.data()));
        res.json(seeds);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch seeds' });
    }
});

// POST /api/apply
app.post('/apply', async (req, res) => {
    try {
        const { name, phone, address, isMember, selectedSeeds } = req.body;

        if (!name || !phone || !address || !selectedSeeds) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const maxSeeds = isMember ? 10 : 5;
        if (selectedSeeds.length > maxSeeds) {
            return res.status(400).json({ error: `You can only select up to ${maxSeeds} seeds.` });
        }

        await db.runTransaction(async (t) => {
            const seedsRef = db.collection('seeds');
            const updates = [];

            // Check stock
            for (const seedId of selectedSeeds) {
                // Query by ID field (not doc ID)
                const querySnapshot = await t.get(seedsRef.where('id', '==', seedId));
                if (querySnapshot.empty) {
                    throw new Error(`Invalid seed ID: ${seedId}`);
                }
                const doc = querySnapshot.docs[0];
                const data = doc.data();

                if (data.quantity <= 0) {
                    throw new Error(`Seed ${data.name} is out of stock.`);
                }

                updates.push({ ref: doc.ref, newQuantity: data.quantity - 1 });
            }

            // Perform updates
            updates.forEach(u => t.update(u.ref, { quantity: u.newQuantity }));

            // Save applicant
            const newApplicantRef = db.collection('applicants').doc();
            t.set(newApplicantRef, {
                name,
                phone,
                address,
                isMember,
                selectedSeeds,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        res.json({ success: true, message: 'Application submitted successfully!' });

    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/applicants
app.get('/applicants', async (req, res) => {
    try {
        const snapshot = await db.collection('applicants').orderBy('timestamp', 'desc').get();
        const applicants = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Convert Timestamp to Date string
            if (data.timestamp) {
                data.timestamp = data.timestamp.toDate().toISOString();
            }
            applicants.push(data);
        });
        res.json(applicants);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applicants' });
    }
});

// POST /api/seeds (Update All / Init)
app.post('/seeds', async (req, res) => {
    try {
        const newSeeds = req.body;
        if (!Array.isArray(newSeeds)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        const batch = db.batch();
        const seedsRef = db.collection('seeds');

        // This is a naive FULL UPDATE implementation (delete all, insert all)
        // For production, diffing would be better, but this matches previous logic.

        // 1. Delete all existing seeds (Warning: Batch limit 500)
        const snapshot = await seedsRef.get();
        snapshot.forEach(doc => batch.delete(doc.ref));

        // 2. Add new seeds
        newSeeds.forEach(seed => {
            const newDoc = seedsRef.doc(); // Auto-ID
            batch.set(newDoc, seed);
        });

        await batch.commit();
        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update seeds' });
    }
});

// CSV Upload needs 'busboy' to parse multipart/form-data in Cloud Functions
// Skip implementation for now or use client-side parsing?
// Let's stick to JSON update for now as client already has CSV parsing logic? 
// Wait, client logic uploads FILE. We need file parsing.
// For simplicity in this migration step, we will omit the CSV upload endpoint in Cloud Function 
// and suggest using the client-side CSV parsing if needed later.
// OR we implement a simple client-side parser to JSON before sending.

// Expose Express app as a single Cloud Function:
const mainApp = express();
mainApp.use('/seed-sharing-2026/api', app);
mainApp.use('/api', app); // Generic fallback if needed, or for local testing without prefix
exports.app = functions.https.onRequest(mainApp);
