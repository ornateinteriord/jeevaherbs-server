const MemberModel = require("../../../models/Users/Member");

/**
 * Get multi-level sponsorship data for a member
 * Returns data for up to 10 levels of sponsorship
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with sponsorship data for up to 10 levels
 */
const getMultiLevelSponsorship = async (req, res) => {
  try {
    // Get member ID from authenticated user token
    const { memberId } = req.user;
    
    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required" });
    }

    // Array to store level-wise data
    const levelData = [];
    const MAX_LEVELS = 10;

    // Process each level
    let currentLevelMemberIds = [memberId];
    
    for (let level = 1; level <= MAX_LEVELS; level++) {
      if (currentLevelMemberIds.length === 0) break;
      
      // Find all members sponsored by current level members
      const nextLevelMembers = await MemberModel.find({ 
        Sponsor_code: { $in: currentLevelMemberIds } 
      });
      
      if (nextLevelMembers.length === 0) break;
      
      // Count active and pending members
      const activeCount = nextLevelMembers.filter(member => member.status === "active").length;
      const pendingCount = nextLevelMembers.length - activeCount;
      
      // Add level data to result
      levelData.push({
        level,
        total: nextLevelMembers.length,
        active: activeCount,
        pending: pendingCount,
      });
      
      // Set up next level member IDs
      currentLevelMemberIds = nextLevelMembers.map(member => member.Member_id);
    }
    
    return res.status(200).json({
      success: true,
      data: levelData
    });
    
  } catch (error) {
    console.error("Error in getMultiLevelSponsorship:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

module.exports = { getMultiLevelSponsorship };