const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://jeevaherbs:P0hw8R2dPQYAkVHz@cluster0.bnf7x7t.mongodb.net/JH?appName=Cluster0')
  .then(async () => {
    const MemberModel = mongoose.model('member_tbl', new mongoose.Schema({}, { strict: false }), 'member_tbl');
    const TransactionModel = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }), 'transaction_tbl');
    
    const directs = await MemberModel.find({ sponsor_id: 'JH0109' }, { Member_id: 1 });
    const directIds = directs.map(d => d.Member_id);
    console.log('Direct IDs:', directIds);
    
    let level2Count = 0;
    let level2Active = 0;
    for (let d of directIds) {
      const p = await MemberModel.find({ sponsor_id: d });
      level2Count += p.length;
      level2Active += p.filter(x => x.status === 'active').length;
    }
    console.log('Level 2 Team count:', level2Count);
    console.log('Level 2 Team active:', level2Active);
    
    let allIndirects = [];
    async function getTeam(ids, level) {
        if(level > 10 || ids.length === 0) return;
        let p = await MemberModel.find({ sponsor_id: { $in: ids }});
        allIndirects.push(...p);
        await getTeam(p.map(x=>x.Member_id), level+1);
    }
    await getTeam(directIds, 2);
    console.log('Total indirect team:', allIndirects.length);
    console.log('Total indirect team active:', allIndirects.filter(x => x.status === 'active').length);
    console.log('Total team size:', directs.length + allIndirects.length);

    // Get commissions received by JH0109
    const txns = await TransactionModel.find({ member_id: 'JH0109' });
    const levelBenefits = txns.filter(t => t.transaction_type === 'Level Benefits' || (t.description && t.description.toLowerCase().includes('level')));
    const directBenefits = txns.filter(t => t.description && t.description.toLowerCase().includes('direct'));
    
    console.log('Level benefits transactions count:', levelBenefits.length);
    console.log('Total level benefits credited:', levelBenefits.reduce((acc, t) => acc + (parseFloat(t.ew_credit) || 0), 0));
    console.log('Total direct benefits credited:', directBenefits.reduce((acc, t) => acc + (parseFloat(t.ew_credit) || 0), 0));

    process.exit(0);
  });
