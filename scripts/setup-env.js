const fs = require('fs');
const path = require('path');

// Get environment variables from Vercel (these should be set in Vercel dashboard)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
};

// Ensure the environments directory exists
const envDir = path.join(__dirname, '../src/environments');
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Write the environment file
const envContent = `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};`;
fs.writeFileSync(path.join(envDir, 'environment.ts'), envContent);

console.log('Environment file generated successfully'); 