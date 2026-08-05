const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const TransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'transaction_tbl' });
const MemberModel = require('./models/Users/Member');

async function checkSingleLeg() {
  await mongoose.connect(process.env.MONGO_URI);
  const Transaction = mongoose.model('Transaction', TransactionSchema);
  
  const todayStart = new Date('2026-08-05T00:00:00.000Z');
  const todayEnd = new Date('2026-08-05T23:59:59.999Z');
  
  const txs = await Transaction.find({
    member_id: 'JH0075',
    transaction_type: 'Reward'
  }).sort({ createdAt: -1 });
  
  let totalCompletedToday = 0;
  let totalQueued = 0;
  
  console.log('--- All Reward Transactions for JH0075 ---');
  txs.forEach(t => {
    console.log(`Date: ${t.createdAt}, Status: ${t.status}, ProcessDate: ${t.process_date}, Desc: ${t.description}`);
    if (t.status === 'Completed' && t.createdAt >= todayStart && t.createdAt <= todayEnd) {
        totalCompletedToday += parseFloat(t.ew_credit) || 0;
    }
    if (t.status === 'Queued') {
        totalQueued += parseFloat(t.ew_credit) || 0;
    }
  });
  
  console.log('-------------------------------------------');
  console.log('Total Completed Today:', totalCompletedToday);
  console.log('Total Queued (For Future):', totalQueued);
  
  const member = await MemberModel.findOne({ Member_id: 'JH0075' });
  const maxPoolIdMember = await MemberModel.findOne().sort('-global_pool_id').exec();
  
  if (member) {
      console.log(`JH0075 Global Pool ID: ${member.global_pool_id}`);
      console.log(`Current Max Global Pool ID: ${maxPoolIdMember.global_pool_id}`);
      console.log(`Users joined after JH0075: ${maxPoolIdMember.global_pool_id - member.global_pool_id}`);
  }
  
  mongoose.connection.close();
}

checkSingleLeg().catch(console.error);
