// Intelligent Response Generator with Context and Insights

function generateIntelligentResponse(queryType, dbResults, transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  if (dbResults.length === 0) {
    return "I couldn't find any transactions matching your query. Try asking about a different category or time period.";
  }

  // Handle specific queries
  if (lowerTranscript.includes('all') && lowerTranscript.includes('transaction')) {
    return generateAllTransactionsResponse(dbResults);
  } else if (lowerTranscript.includes('above') || lowerTranscript.includes('over')) {
    return generateAboveAmountResponse(dbResults, transcript);
  } else if (lowerTranscript.includes('upi')) {
    return generateUPIResponse(dbResults);
  }

  switch (queryType) {
    case 'top_expenses':
      return generateTopExpensesResponse(dbResults);
    case 'category':
      return generateCategoryResponse(dbResults);
    case 'food':
      return generateFoodResponse(dbResults);
    case 'most':
      return generateHighestResponse(dbResults);
    case 'recent':
      return generateRecentResponse(dbResults);
    case 'total':
      return generateTotalResponse(dbResults);
    default:
      return generateDefaultResponse(dbResults);
  }
}

function generateAllTransactionsResponse(dbResults) {
  const total = dbResults.reduce((sum, txn) => sum + txn.amount, 0);
  const count = dbResults.length;
  
  // Category analysis
  const categories = {};
  dbResults.forEach(txn => {
    categories[txn.category] = (categories[txn.category] || 0) + txn.amount;
  });
  
  const topCategory = Object.keys(categories).reduce((a, b) => 
    categories[a] > categories[b] ? a : b
  );
  
  let response = `Hey! So I checked your transactions and found ${count} of them, totaling ${total} rupees. `;
  response += `Looks like you're spending the most on ${topCategory}, about ${categories[topCategory]} rupees. `;
  
  // Friendly warning if overspending
  if (categories[topCategory] > total * 0.4) {
    response += `Heads up though - ${topCategory} is taking up ${Math.round((categories[topCategory]/total)*100)}% of your budget! Maybe we should look at cutting back a bit there?`;
  } else {
    response += `Good news is your spending looks pretty balanced across different categories!`;
  }
  
  return response;
}

function generateAboveAmountResponse(dbResults, transcript) {
  const amount = transcript.match(/\d+/)?.[0] || 1000;
  const total = dbResults.reduce((sum, txn) => sum + txn.amount, 0);
  const count = dbResults.length;
  
  let response = `Alright, so I found ${count} transactions over ${amount} rupees, and they add up to ${total} rupees total. `;
  
  if (count > 10) {
    response += `Whoa, that's quite a few big purchases! Maybe take a closer look at these and see where you can save some money?`;
  } else if (total > 20000) {
    response += `These bigger expenses really add up, don't they? Worth thinking about which ones were really necessary.`;
  } else {
    response += `Not bad! Your big purchases seem pretty reasonable.`;
  }
  
  return response;
}

function generateUPIResponse(dbResults) {
  const total = dbResults.reduce((sum, txn) => sum + txn.amount, 0);
  const count = dbResults.length;
  const avgAmount = Math.round(total / count);
  
  let response = `So you've made ${count} UPI payments, and they total up to ${total} rupees. `;
  response += `On average, each UPI payment is around ${avgAmount} rupees. `;
  
  // Friendly UPI analysis
  if (count > 20) {
    response += `You're really loving that UPI, huh? That's actually great because it makes tracking your spending super easy!`;
  } else if (avgAmount > 1000) {
    response += `Your UPI payments are on the higher side. Just make sure you're keeping an eye on each one!`;
  } else {
    response += `Your UPI game is looking solid! Keep it up!`;
  }
  
  return response;
}

function generateTopExpensesResponse(dbResults) {
  const total = dbResults.reduce((sum, item) => sum + item.total, 0);
  const top3 = dbResults.slice(0, 3);
  const topMerchant = top3[0];
  const percentage = ((topMerchant.total / total) * 100).toFixed(0);
  
  let response = `Okay, so your biggest expense is ${topMerchant.beneficiary} at ${topMerchant.total} rupees - that's like ${percentage}% of everything you've spent! `;
  
  if (top3.length > 1) {
    response += `After that, it's ${top3[1].beneficiary} at ${top3[1].total} rupees`;
    if (top3.length > 2) {
      response += `, and then ${top3[2].beneficiary} at ${top3[2].total} rupees`;
    }
    response += `. `;
  }
  
  // Friendly advice
  if (topMerchant.total > 5000) {
    response += `That's a pretty big chunk! Maybe set a monthly limit for ${topMerchant.beneficiary} so you can keep track better?`;
  } else {
    response += `Looking good! Your spending is nicely spread out across different places.`;
  }
  
  return response;
}

function generateCategoryResponse(dbResults) {
  const total = dbResults.reduce((sum, item) => sum + item.total, 0);
  const topCategory = dbResults[0];
  const percentage = ((topCategory.total / total) * 100).toFixed(0);
  
  let response = `Alright, so you've spent ${total} rupees across ${dbResults.length} different categories. `;
  response += `${topCategory.category} is where most of your money's going - ${topCategory.total} rupees, which is about ${percentage}% of everything. `;
  
  if (dbResults.length > 1) {
    const top3 = dbResults.slice(0, 3).map(item => 
      `${item.category} at ${item.total} rupees`
    ).join(', ');
    response += `Your top three are: ${top3}. `;
  }
  
  // Friendly warnings and advice
  if (topCategory.category === 'Food') {
    if (topCategory.total > 15000) {
      response += `Whoa, ${topCategory.total} rupees on food is pretty steep! I'd say aim for around 10000. Try cooking at home more - you could save like 40-50%!`;
    } else if (topCategory.total > 10000) {
      response += `Your food spending's a bit high. Here's a tip: meal prep on Sundays! You could easily save 3000-4000 rupees a month.`;
    } else {
      response += `Nice! Your food budget is looking really good!`;
    }
  } else if (topCategory.category === 'Shopping') {
    if (topCategory.total > 20000) {
      response += `Okay, real talk - ${Math.round(topCategory.total/1000)}k on shopping is way too much! Time to cut back on those impulse buys, friend.`;
    } else if (topCategory.total > 15000) {
      response += `Shopping's eating up a lot of your budget. Try this: wait 24 hours before buying anything non-essential. Trust me, it helps!`;
    } else {
      response += `Your shopping's under control! Good job!`;
    }
  } else if (topCategory.category === 'Entertainment') {
    if (topCategory.total > 8000) {
      response += `Entertainment's getting expensive! Maybe try some free stuff? Parks, free concerts, movie nights at home - still fun, way cheaper!`;
    } else if (topCategory.total > 5000) {
      response += `Entertainment spending's a bit much. Look for budget-friendly options - there's tons of fun stuff that doesn't cost a fortune!`;
    } else {
      response += `You're having fun without breaking the bank - love it!`;
    }
  } else if (topCategory.category === 'Transport') {
    if (topCategory.total > 10000) {
      response += `Transport's costing you a lot! Ever thought about carpooling or taking the bus? Could save you like 40%!`;
    } else {
      response += `Transport costs look totally manageable!`;
    }
  } else {
    if (percentage > 50) {
      response += `Heads up - ${topCategory.category} is taking up ${percentage}% of your spending! That's way too much in one place. Let's spread it out a bit!`;
    } else {
      response += `Your spending's nicely balanced - that's what we like to see!`;
    }
  }
  
  return response;
}

function generateFoodResponse(dbResults) {
  const total = dbResults.reduce((sum, txn) => sum + txn.amount, 0);
  const count = dbResults.length;
  const avgPerTransaction = Math.round(total / count);
  const recent = dbResults[0];
  
  let response = `So you've spent ${total} rupees on food across ${count} orders or meals this month. `;
  response += `That works out to about ${avgPerTransaction} rupees per meal. `;
  response += `Your last food expense was ${recent.amount} rupees at ${recent.beneficiary}. `;
  
  // Time-based context
  const today = new Date();
  const dayOfMonth = today.getDate();
  const dailyAvg = Math.round(total / dayOfMonth);
  response += `You're spending around ${dailyAvg} rupees a day on food. `;
  
  // Friendly insights and recommendations
  if (avgPerTransaction > 500) {
    response += `Dude, 500+ rupees per meal is pretty steep! Try cooking at home more - you could literally save 60% of this!`;
  } else if (total > 15000) {
    response += `Your food budget's getting up there! Here's an idea: meal prep on weekends. It's a game changer and could save you tons!`;
  } else if (total < 5000) {
    response += `Wow, you're crushing it with your food budget! Way to go!`;
  } else {
    response += `Your food spending looks pretty solid! Nothing to worry about here.`;
  }
  
  return response;
}

function generateHighestResponse(dbResults) {
  const top = dbResults[0];
  
  let response = `Your highest spending category is ${top.category} at ${top.total} rupees this month. `;
  
  // Add time context
  const today = new Date();
  const daysInMonth = today.getDate();
  const dailyAvg = Math.round(top.total / daysInMonth);
  response += `That's about ${dailyAvg} rupees per day so far. `;
  
  // Add projection
  const projectedMonthly = Math.round((top.total / daysInMonth) * 30);
  if (projectedMonthly > top.total * 1.2) {
    response += `At this rate, you'll spend around ${projectedMonthly} rupees on ${top.category} by month end. `;
  }
  
  // Add smart recommendation
  if (top.total > 20000) {
    response += `This is significantly high. I recommend setting a monthly budget limit of ${Math.round(top.total * 0.8)} rupees to help you save more.`;
  } else if (top.total > 10000) {
    response += `Consider tracking daily expenses in this category to identify areas where you can cut back.`;
  } else {
    response += `Your spending in this category is well-controlled!`;
  }
  
  return response;
}

function generateRecentResponse(dbResults) {
  const total = dbResults.reduce((sum, txn) => sum + txn.amount, 0);
  const avgAmount = Math.round(total / dbResults.length);
  const latest = dbResults[0];
  
  let response = `Okay, so your last ${dbResults.length} transactions add up to ${total} rupees. `;
  response += `The most recent one was ${latest.amount} rupees to ${latest.beneficiary} for ${latest.category}. `;
  
  // Analyze spending pattern
  const highValueTxns = dbResults.filter(txn => txn.amount > avgAmount * 1.5);
  if (highValueTxns.length > 0) {
    response += `I spotted ${highValueTxns.length} bigger purchases recently - they total ${highValueTxns.reduce((s, t) => s + t.amount, 0)} rupees. `;
  }
  
  // Check for unusual activity
  if (latest.amount > 3000) {
    response += `That last one's pretty big! Just checking - everything okay? `;
  }
  
  // Category analysis
  const categories = {};
  dbResults.forEach(txn => {
    categories[txn.category] = (categories[txn.category] || 0) + 1;
  });
  const topCategory = Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b);
  
  response += `Looks like you've been spending mostly on ${topCategory} lately.`;
  
  return response;
}

function generateTotalResponse(dbResults) {
  const result = dbResults[0];
  const avgPerTransaction = Math.round(result.total / result.count);
  
  let response = `Alright, so your total spending is ${result.total} rupees across ${result.count} transactions this month. `;
  response += `That's about ${avgPerTransaction} rupees per transaction on average. `;
  
  // Add time-based context
  const today = new Date();
  const dayOfMonth = today.getDate();
  const dailyAvg = Math.round(result.total / dayOfMonth);
  response += `You're spending around ${dailyAvg} rupees a day. `;
  
  // Add projection and friendly advice
  const projectedMonthly = Math.round((result.total / dayOfMonth) * 30);
  response += `If you keep this up, you'll hit about ${projectedMonthly} rupees by month end. `;
  
  // Friendly recommendations
  if (projectedMonthly > 50000) {
    const savingsTarget = Math.round(projectedMonthly * 0.2);
    response += `That's getting pretty high! Let's try to cut back by ${savingsTarget} rupees. Focus on the stuff you don't really need, you know?`;
  } else if (projectedMonthly > 30000) {
    response += `Not bad! Ever heard of the 50-30-20 rule? 50% for needs, 30% for wants, 20% for savings. Give it a shot!`;
  } else {
    response += `Dude, you're doing awesome! Your spending is totally under control!`;
  }
  
  return response;
}

function generateDefaultResponse(dbResults) {
  const total = dbResults.reduce((sum, txn) => sum + (txn.amount || txn.total || 0), 0);
  const count = dbResults.length;
  const avgAmount = Math.round(total / count);
  const first = dbResults[0];
  
  let response = `I found ${count} transactions totaling ${total} rupees. `;
  response += `The average transaction amount is ${avgAmount} rupees. `;
  
  if (first.beneficiary) {
    response += `Your most recent transaction was ${first.amount} rupees to ${first.beneficiary}. `;
  }
  
  // Add helpful context
  const today = new Date();
  const dayOfMonth = today.getDate();
  const dailyAvg = Math.round(total / dayOfMonth);
  
  response += `You're averaging ${dailyAvg} rupees per day this month. `;
  
  if (count > 15) {
    response += `You've been quite active with your spending recently! Consider consolidating purchases to reduce transaction fees.`;
  } else if (total > 20000) {
    response += `Your spending is on the higher side. Review your expenses and identify areas to cut back.`;
  } else {
    response += `Your spending pattern looks healthy!`;
  }
  
  return response;
}

module.exports = {
  generateIntelligentResponse
};
