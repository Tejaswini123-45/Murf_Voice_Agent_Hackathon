const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { format, subDays, startOfMonth, endOfMonth } = require('date-fns');

const DB_PATH = path.join(__dirname, 'bank.db');

// Get database connection
function getDb() {
  return new sqlite3.Database(DB_PATH);
}

// Spending Analytics
async function getSpendingAnalytics(timeframe = '30days') {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as average,
        MIN(amount) as min,
        MAX(amount) as max
      FROM transactions
      WHERE date >= datetime('now', '-30 days')
      GROUP BY category
      ORDER BY total DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        db.close();
        resolve(rows);
      }
    });
  });
}

// Spending Trends (Daily)
async function getSpendingTrends(days = 30) {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        DATE(date) as day,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE date >= datetime('now', '-${days} days')
      GROUP BY DATE(date)
      ORDER BY day ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        db.close();
        resolve(rows);
      }
    });
  });
}

// Anomaly Detection
async function detectAnomalies() {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    // Simple anomaly detection - transactions above 3000
    const simpleQuery = `
      SELECT * FROM transactions 
      WHERE amount > 3000 
      ORDER BY date DESC 
      LIMIT 10
    `;
    
    db.all(simpleQuery, [], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        db.close();
        resolve(rows);
      }
    });
  });
}

// Top Merchants
async function getTopMerchants(limit = 10) {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        beneficiary,
        COUNT(*) as transaction_count,
        SUM(amount) as total_spent,
        AVG(amount) as avg_amount,
        MAX(date) as last_transaction
      FROM transactions
      GROUP BY beneficiary
      ORDER BY total_spent DESC
      LIMIT ?
    `;
    
    db.all(query, [limit], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        db.close();
        resolve(rows);
      }
    });
  });
}

// Budget Analysis
async function getBudgetAnalysis(category, budgetLimit) {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        SUM(amount) as spent,
        COUNT(*) as transactions
      FROM transactions
      WHERE category = ?
      AND date >= datetime('now', 'start of month')
    `;
    
    db.get(query, [category], (err, row) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        db.close();
        const spent = row.spent || 0;
        const remaining = budgetLimit - spent;
        const percentage = (spent / budgetLimit) * 100;
        
        resolve({
          category,
          budget: budgetLimit,
          spent,
          remaining,
          percentage: percentage.toFixed(1),
          transactions: row.transactions,
          status: percentage > 90 ? 'critical' : percentage > 70 ? 'warning' : 'good'
        });
      }
    });
  });
}

// Comparative Analysis
async function getComparativeAnalysis(category) {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        'This Month' as period,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE category = ?
      AND date >= datetime('now', 'start of month')
      
      UNION ALL
      
      SELECT 
        'Last Month' as period,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE category = ?
      AND date >= datetime('now', 'start of month', '-1 month')
      AND date < datetime('now', 'start of month')
    `;
    
    db.all(query, [category, category], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        db.close();
        const thisMonth = rows[0] || { total: 0, count: 0 };
        const lastMonth = rows[1] || { total: 0, count: 0 };
        const change = thisMonth.total - lastMonth.total;
        const percentChange = lastMonth.total > 0 
          ? ((change / lastMonth.total) * 100).toFixed(1)
          : 0;
        
        resolve({
          category,
          thisMonth,
          lastMonth,
          change,
          percentChange,
          trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
        });
      }
    });
  });
}

// Insights Generator
async function generateInsights() {
  try {
    const [analytics, trends, anomalies, topMerchants] = await Promise.all([
      getSpendingAnalytics(),
      getSpendingTrends(7),
      detectAnomalies(),
      getTopMerchants(5)
    ]);
    
    const insights = [];
    
    // Top spending category
    if (analytics.length > 0) {
      const top = analytics[0];
      insights.push({
        type: 'spending',
        priority: 'high',
        message: `Your highest spending is in ${top.category} with ₹${top.total} across ${top.count} transactions.`
      });
    }
    
    // Anomalies
    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        priority: 'medium',
        message: `Detected ${anomalies.length} unusual transactions that are higher than your typical spending.`
      });
    }
    
    // Trends
    if (trends.length >= 2) {
      const recent = trends.slice(-3).reduce((sum, day) => sum + day.total, 0);
      const previous = trends.slice(-6, -3).reduce((sum, day) => sum + day.total, 0);
      if (recent > previous * 1.2) {
        insights.push({
          type: 'trend',
          priority: 'medium',
          message: `Your spending has increased by ${(((recent - previous) / previous) * 100).toFixed(0)}% in the last 3 days.`
        });
      }
    }
    
    return {
      insights,
      analytics,
      trends,
      anomalies,
      topMerchants
    };
  } catch (err) {
    console.error('Error generating insights:', err);
    return { insights: [], analytics: [], trends: [], anomalies: [], topMerchants: [] };
  }
}

module.exports = {
  getSpendingAnalytics,
  getSpendingTrends,
  detectAnomalies,
  getTopMerchants,
  getBudgetAnalysis,
  getComparativeAnalysis,
  generateInsights
};
