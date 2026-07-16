const MemberModel = require("../../../models/Users/Member");

// Submit KYC details
exports.submitKYC = async (req, res) => {
  try {
    const { ref_no, bankAccount, ifsc, pan, address, bankName } = req.body;

    // Find the member by ref_no
    const member = await MemberModel.findOne({ Member_id: ref_no });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Update member with KYC details
    member.account_number = bankAccount;
    member.ifsc_code = ifsc;
    member.Pan_no = pan;
    member.bank_name = bankName;
    member.address = address;
    member.kycStatus = "PROCESSING";

    // Save the updated member
    await member.save();

    res.json({ message: "KYC submitted successfully" });
  } catch (error) {
    console.error("Error submitting KYC:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Approve KYC
exports.approveKYC = async (req, res) => {
  try {
    const { ref_no } = req.body;

    // Find the member by ref_no
    const member = await MemberModel.findOne({ Member_id: ref_no });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Update KYC status to APPROVED
    member.kycStatus = "APPROVED";
    await member.save();

    res.json({ message: "KYC approved successfully" });
  } catch (error) {
    console.error("Error approving KYC:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get KYC submissions (only PROCESSING)
exports.getKycSubmissions = async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;

    // Always fetch only PROCESSING KYCs
    const filter = { kycStatus: "PROCESSING" };

    // 🔍 Search filter
    if (q) {
      filter.$or = [
        { Member_id: q },
        { Name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { mobileno: { $regex: q, $options: "i" } }
      ];
    }

    const skip = (Math.max(parseInt(page, 10), 1) - 1) * parseInt(limit, 10);

    const submissions = await MemberModel.find(filter)
      .select("Member_id Name mobileno email account_number ifsc_code bank_name Pan_no kycStatus address createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await MemberModel.countDocuments(filter);

    res.json({
      total,
      count: submissions.length,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      data: submissions
    });
  } catch (error) {
    console.error("Error fetching KYC submissions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};