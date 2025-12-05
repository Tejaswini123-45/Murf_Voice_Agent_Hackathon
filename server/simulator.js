const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'bank.db');

console.log('[SIMULATOR] Starting Live Payment Stream...');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[SIMULATOR ERROR] Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('[SIMULATOR] Connected to bank.db');
});

// Merchant pool for random transactions
const merchants = [
  { name: 'Amazon', category: 'Shopping', method: 'Card' },
  { name: 'Starbucks', category: 'Food', method: 'Card' },
  { name: 'Zomato', category: 'Food', method: 'UPI' },
  { name: 'Flipkart', category: 'Shopping', method: 'Card' },
  { name: 'Ola', category: 'Transport', method: 'Wallet' },
  { name: 'BookMyShow', category: 'Entertainment', method: 'Card' },
  { name: 'BigBasket', category: 'Groceries', method: 'UPI' },
  { name: 'Myntra', category: 'Shopping', method: 'Card' },
  { name: 'Dominos', category: 'Food', method: 'Card' },
  { name: 'Spotify', category: 'Entertainment', method: 'UPI' }
];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTransaction() {
  const merchant = merchants[getRandomInt(0, merchants.length - 1)];
  const amount = getRandomInt(100, 5000);
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19);

  return {
    date,
    beneficiary: merchant.name,
    amount,
    category: merchant.category,
    method: merchant.method
  };
}

function insertTransaction() {
  const txn = generateTransaction();

  db.run(
    `INSERT INTO transactions (date, beneficiary, amount, category, method)
     VALUES (?, ?, ?, ?, ?)`,
    [txn.date, txn.beneficiary, txn.amount, txn.category, txn.method],
    function(err) {
      if (err) {
        console.error('[SIMULATOR ERROR] Failed to insert transaction:', err.message);
      } else {
        console.log(`[SIMULATOR] 💳 New Transaction: ₹${txn.amount} to ${txn.beneficiary} (${txn.category})`);
      }
    }
  );
}

// Run every 10 seconds
console.log('[SIMULATOR] ⚡ Generating transactions every 10 seconds...');
setInterval(insertTransaction, 10000);

// Generate first transaction immediately
setTimeout(insertTransaction, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SIMULATOR] Shutting down...');
  db.close((err) => {
    if (err) {
      console.error('[SIMULATOR ERROR] Error closing database:', err.message);
    }
    process.exit(0);
  });
});
