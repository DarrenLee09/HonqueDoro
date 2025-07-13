const fs = require('fs');
const path = require('path');

// Debug: Log available environment variables
console.log('Available environment variables:');
Object.keys(process.env).forEach(key => {
  if (key.includes('FIREBASE') || key.includes('VERCEL')) {
    console.log(`${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
  }
});

// Get environment variables from Vercel (these should be set in Vercel dashboard)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.NG_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.NG_APP_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NG_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NG_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.NG_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || process.env.NG_APP_FIREBASE_APP_ID || "",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.NG_APP_FIREBASE_MEASUREMENT_ID || ""
};

console.log('Firebase config:', JSON.stringify(firebaseConfig, null, 2));

// Ensure the environments directory exists
const envDir = path.join(__dirname, '../src/environments');
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Write the environment file
const envContent = `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};`;
fs.writeFileSync(path.join(envDir, 'environment.ts'), envContent);

console.log('Environment file generated successfully'); 