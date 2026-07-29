const AdminModel = require("../../models/Admin/Admin");
const MemberModel = require("../../models/Users/Member");
const jwt = require("jsonwebtoken");
const {
  sendMail,
} = require("../../utils/EmailService");
const { generateOTP, storeOTP, verifyOTP } = require("../../utils/OtpService");
const { generateMSCSEmail } = require("../../utils/generateMSCSEmail");

const recoverySubject = "VGK-Club - Password Recovery";
const resetPasswordSubject = "VGK-Club - OTP Verification";

const generateUniqueMemberId = async () => {
  const lastMember = await MemberModel.findOne({ Member_id: /^JH\d+$/ })
    .sort({ _id: -1 });

  let nextIdNum = 1;
  if (lastMember && lastMember.Member_id) {
    const lastIdStr = lastMember.Member_id.replace('JH', '');
    nextIdNum = (parseInt(lastIdStr, 10) || 0) + 1;
  }

  let memberId = `JH${String(nextIdNum).padStart(4, '0')}`;
  while (await MemberModel.exists({ Member_id: memberId })) {
    nextIdNum++;
    memberId = `JH${String(nextIdNum).padStart(4, '0')}`;
  }
  return memberId;
};

const signup = async (req, res) => {
  try {
    const { email, password, Name, ...otherDetails } = req.body;
    // const existingUser = await MemberModel.findOne({ email });
    // if (existingUser) {
    //   return res.status(400).json({ success: false, message: "Email already in use" });
    // }

    const memberId = await generateUniqueMemberId();

    const newMember = new MemberModel({
      Member_id: memberId,
      email,
      password,
      Name,

      ...otherDetails,
    });
    await newMember.save();

    try {

      const { welcomeMessage, welcomeSubject } = generateMSCSEmail(memberId, password, Name);

      const textContent = `Dear ${Name}, Your account registration with VGK-Club has been completed. Member ID: ${memberId}, Password: ${password}. Your account is under verification process.`;


      await sendMail(email, welcomeSubject, welcomeMessage, textContent);

    } catch (emailError) {

    }

    res.status(201).json({
      success: true,
      message: "Signup successful. Credentials sent to email.",
      user: {
        Member_id: newMember.Member_id,
        email: newMember.email,
        Name: newMember.Name
      },
    });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getSponsorDetails = async (req, res) => {
  try {
    const { ref } = req.params;
    const sponsor = await MemberModel.findOne({ Member_id: ref });
    if (!sponsor) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid Sponsor Code" });
    }
    res.json({
      success: true,
      Member_id: sponsor.Member_id,
      name: sponsor.Name,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const recoverPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await MemberModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not registered" });
    }
    const recoveryDescription = `Dear Member,\n\nYou requested a password recovery. Here is your password:\n ${user.password}\n\nPlease keep this information secure.\n\nBest regards,\nVGK-Club Team`;

    await sendMail(user.email, recoverySubject, recoveryDescription);
    res.json({ success: true, message: "Password sent to your email" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    const user = await MemberModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not registered" });
    }

    if (otp && !password) {
      if (!verifyOTP(email, otp)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid OTP or expired" });
      }
      return res.json({ success: true, message: "OTP verified. Now set a new password." });
    }
    if (password) {

      user.password = password;
      await user.save();

      return res.json({
        success: true,
        message: "Password reset successfully",
      });
    }
    const resetPasswordDescription = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border-radius: 12px; background-color: #f4f7f6; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #2c8786 0%, #1a5c5c 100%); padding: 30px 20px; text-align: center;">
          <img src="${process.env.FRONTEND_URL}/images/jeevaherbs_logo.png" alt="Jeeva Herbs Logo" style="max-height: 80px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);" />
          <h2 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 1px;">Jeeva Herbs</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 40px 30px;">
          <h3 style="color: #2c8786; margin-top: 0; font-size: 22px; border-bottom: 2px solid #e0ebeb; padding-bottom: 10px;">Password Reset Request</h3>
          
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-top: 20px;">
            Dear Member,
          </p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            We received a request to reset the password for your Jeeva Herbs account. Please use the secure One-Time Password (OTP) below to proceed:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <div style="display: inline-block; padding: 15px 30px; font-size: 32px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; letter-spacing: 8px; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3);">
              ${newOtp}
            </div>
            <p style="color: #737373; font-size: 13px; margin-top: 10px;">This code is valid to complete your reset request.</p>
          </div>
          
          <div style="background-color: #fff8e1; border-left: 4px solid #f5b041; padding: 15px; margin-top: 30px; border-radius: 0 4px 4px 0;">
            <p style="color: #5d4037; font-size: 14px; line-height: 1.5; margin: 0;">
              <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email or contact our support team immediately. Never share your OTP with anyone.
            </p>
          </div>
        </div>
        
        <div style="background-color: #eef2f1; text-align: center; padding: 20px; border-top: 1px solid #dcdcdc;">
          <p style="color: #777777; font-size: 13px; margin: 0;">
            &copy; ${new Date().getFullYear()} Jeeva Herbs. All rights reserved.
          </p>
          <p style="color: #999999; font-size: 12px; margin-top: 8px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </div>
    `;
    storeOTP(email, newOtp);
    await sendMail(email, resetPasswordSubject, resetPasswordDescription);
    return res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await MemberModel.findOne({ Member_id: username });
    const admin = await AdminModel.findOne({ username });
    const foundUser = user || admin;
    if (!foundUser) {
      return res
        .status(404)
        .json({ success: false, message: "User or Admin not found" });
    }

    const userRole = user instanceof MemberModel ? "USER" : "ADMIN";

    const isPasswordValid =
      password === (foundUser.PASSWORD || foundUser.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect username or password" });
    }

    const token = jwt.sign(
      {
        id: foundUser._id,
        role: userRole,
        memberId: foundUser?.Member_id ?? null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.status(200).json({

      success: true,
      role: userRole,
      user: foundUser,
      token,
      message: `${userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()
        } login successful`,

    });

  } catch (error) {
    console.error("Login Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error });
  }
};

const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    // Security check: Only delete the member if their status is "Pending"
    // This prevents malicious users from deleting active accounts.
    const deletedUser = await MemberModel.findOneAndDelete({ 
      Member_id: id,
      status: "Pending" // Assuming "Pending" is the default status
    });
    
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: "User not found or cannot be deleted (may already be active)" });
    }
    return res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete Member Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  signup,
  getSponsorDetails,
  recoverPassword,
  resetPassword,
  login,
  deleteMember,
};
