const CounterModel = require('../models/Transaction/Counter');

/**
 * Formats a sequence number into the requested transaction ID format (e.g. A0001001).
 * Supports rolling over to 'B', 'C', etc. when reaching 10,000,000.
 */
function formatId(seq) {
  // Base A is 65 in ASCII.
  const letterIndex = Math.floor(seq / 10000000); 
  const letter = String.fromCharCode(65 + letterIndex);
  const numberPart = (seq % 10000000).toString().padStart(7, '0');
  return `${letter}${numberPart}`;
}

/**
 * Atomically generates the next single transaction ID.
 */
async function getNextTransactionId() {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: 'transactionId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  
  // We want the sequence to start from 1001, so A0001001.
  // By adding 1000 to the counter's base (which starts at 1), we get 1001.
  const actualSeq = 1000 + counter.seq;
  return formatId(actualSeq);
}

/**
 * Atomically generates an array of sequential transaction IDs.
 * Used for bulk operations like Single Leg income distribution.
 */
async function getNextTransactionIds(count) {
  if (count <= 0) return [];
  const counter = await CounterModel.findOneAndUpdate(
    { _id: 'transactionId' },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );
  
  const endSeq = counter.seq;
  const startSeq = endSeq - count + 1;
  
  const ids = [];
  for (let i = startSeq; i <= endSeq; i++) {
    ids.push(formatId(1000 + i));
  }
  return ids;
}

module.exports = {
  getNextTransactionId,
  getNextTransactionIds
};
