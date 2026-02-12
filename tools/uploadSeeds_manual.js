const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (Using Application Default Credentials or Service Account)
// Ideally, run with `GOOGLE_APPLICATION_CREDENTIALS` env var or `firebase admin` context
// For this script, we'll assume the user runs it in an environment with credentials.
// OR we can rely on `firebase-admin` picking up default credentials if logged in via `gcloud`
// But simpler: We will just write a script that can be run with `firebase-admin` commands if setup. 
// Actually, running locally with `firebase-admin` requires a service account key file.

// Alternative: Use a simple Cloud Function to seed data? No, limits.
// Alternative 2: Use a script that prompts user for key path?

// Let's try to assume we can use `firebase-admin` with project ID if logged in via CLI? NO.
// Best way for user: Download service account key. 
// BUT, I can't ask user to do that easily.

// Workaround: We will create a TEMPORARY endpoint in the Cloud Function to receive the initial JSON payload and populate Firestore.
// This avoids auth complexity for the one-time migration.

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seedsFile = path.join(__dirname, 'data', 'seeds.json');
const seeds = JSON.parse(fs.readFileSync(seedsFile, 'utf8'));

async function uploadSeeds() {
    const batch = db.batch();
    const seedsRef = db.collection('seeds');

    console.log(`Uploading ${seeds.length} seeds...`);

    seeds.forEach(seed => {
        const docRef = seedsRef.doc(); // Auto ID
        batch.set(docRef, seed);
    });

    await batch.commit();
    console.log('Done!');
}

uploadSeeds().catch(console.error);
