const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'bank.db');

console.log('[SETUP] Initializing VoiceBank Database...');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[SETUP ERROR] Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('[SETUP] Connected to bank.db');
});

// Create transactions table
db.serialize(() => {
  // Drop existing table if it exists
  db.run('DROP TABLE IF EXISTS transactions', (err) => {
    if (err) {
      console.error('[SETUP ERROR] Failed to drop table:', err.message);
    }
  });

  // Create new table
  db.run(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      beneficiary TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL,
      method TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('[SETUP ERROR] Failed to create table:', err.message);
      process.exit(1);
    }
    console.log('[SETUP] Table "transactions" created successfully');
  });

  // Seed initial data
  const seedData = [
    ['2024-12-01 10:30:00', 'Rahul Kumar', 5000, 'Transfer', 'UPI'],
    ['2024-12-01 14:20:00', 'Swiggy', 450, 'Food', 'Card'],
    ['2024-12-02 09:15:00', 'Uber', 280, 'Transport', 'Wallet'],
    ['2024-12-02 18:45:00', 'Amazon', 1200, 'Shopping', 'Card'],
    ['2024-12-03 12:00:00', 'Netflix', 799, 'Entertainment', 'Card']
  ];

  const insertStmt = db.prepare(`
    INSERT INTO transactions (date, beneficiary, amount, category, method)
    VALUES (?, ?, ?, ?, ?)
  `);

  seedData.forEach((row, index) => {
    insertStmt.run(row, (err) => {
      if (err) {
        console.error(`[SETUP ERROR] Failed to insert row ${index + 1}:`, err.message);
      } else {
        console.log(`[SETUP] Inserted: ₹${row[2]} to ${row[1]}`);
      }
    });
  });

  insertStmt.finalize((err) => {
    if (err) {
      console.error('[SETUP ERROR] Failed to finalize statement:', err.message);
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('[SETUP ERROR] Failed to close database:', err.message);
    process.exit(1);
  }
  console.log('[SETUP] ✅ Database setup complete! Run "npm start" to launch the server.');
});
