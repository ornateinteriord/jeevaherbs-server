const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const MemberModel = require('./models/Users/Member');
  const startPoolId = Math.max(1, 128 - 100);
  const eligibleMembers = await MemberModel.find({
    global_pool_id: { $gte: startPoolId, $lt: 128 }
  }).exec();
  console.log('Eligible for 128:', eligibleMembers.length);
  
  const eligible129 = await MemberModel.find({
    global_pool_id: { $gte: Math.max(1, 129 - 100), $lt: 129 }
  }).exec();
  console.log('Eligible for 129:', eligible129.length);
  
  mongoose.connection.close();
}
check().catch(console.error);
