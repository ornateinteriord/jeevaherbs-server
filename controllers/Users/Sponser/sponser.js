const MemberModel = require("../../../models/Users/Member");

const getSponsers = async (req, res) => {
    try {
      const { memberId } = req.params

      if(!memberId){
        return res.status(400).json({ success: false, message: "Member ID is required" });
      }
      const parentUser = await MemberModel.findOne(
        { Member_id: memberId }
    );

    if (!parentUser) {
        return res.status(404).json({ success: false, message: "Parent user not found" });
    }
  
      const sponsoredUsers = await MemberModel.aggregate([
        { $match: { Sponsor_code: memberId } }, 
        {
            $project: {
                _id: 0,  
                Member_id: 1,
                Name: 1,
                status: 1,
                Date_of_joining: 1,
                profile_image:1,
                mobileno:1,
                Sponsor_code:1,
                Sponsor_name:1
            }
        }
    ]);
  
      res.json({success :true,  parentUser,sponsoredUsers });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  };


 const checkSponsorReward = async (req, res) => {
  try {
    const { memberId } = req.params;

    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required" });
    }

    // 🔍 Find member by Member_id
    const member = await MemberModel.findOne({ Member_id: memberId });

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // ✅ Check member’s own package
    const hasRequiredPackage =
      member.spackage === "standard" && member.package_value === 2600;

    // ✅ Count how many members this person has sponsored
    const sponsoredCount = await MemberModel.countDocuments({ Sponsor_code: memberId });

    // ✅ Eligibility: correct package + at least 2 sponsored members
    const isEligibleForReward = hasRequiredPackage && sponsoredCount >= 2;

    let message = "";
    if (!hasRequiredPackage) {
      message = `❌ ${member.Name} does not have the required package (standerd - ₹2600).`;
    } else if (sponsoredCount < 2) {
      message = `⚠️ ${member.Name} has the correct package but needs ${2 - sponsoredCount} more sponsored member(s) to qualify.`;
    } else {
      message = `🎉 Congratulations ${member.Name}! You have the correct package and ${sponsoredCount} sponsored members — you are eligible for the reward!`;
    }

    res.json({
      success: true,
      memberId: member.Member_id,
      memberName: member.Name,
      spackage: member.spackage,
      package_value: member.package_value,
      sponsoredCount,
      isEligibleForReward,
      message,
    });
  } catch (error) {
    console.error("Error in checkSponsorReward:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};


  module.exports = { getSponsers ,checkSponsorReward };

