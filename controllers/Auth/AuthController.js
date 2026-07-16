const AdminModel = require("../../models/Admin/Admin");
const MemberModel = require("../../models/Users/Member");
const jwt = require("jsonwebtoken");
const {
  sendMail,
} = require("../../utils/EmailService");
const { generateOTP, storeOTP, verifyOTP } = require("../../utils/OtpService");
const { generateMSCSEmail } = require("../../utils/generateMSCSEmail");

const recoverySubject = "VGK-Club - Password Recovery";
const resetPasswordSubject =  "VGK-Club - OTP Verification";

const generateUniqueMemberId = async () => {
  const lastMember = await MemberModel.findOne({ Member_id: /^VG\d+$/ })
    .sort({ _id: -1 });

  let nextIdNum = 1;
  if (lastMember && lastMember.Member_id) {
    const lastIdStr = lastMember.Member_id.replace('VG', '');
    nextIdNum = (parseInt(lastIdStr, 10) || 0) + 1;
  }
  
  let memberId = `VG${String(nextIdNum).padStart(5, '0')}`;
  while (await MemberModel.exists({ Member_id: memberId })) {
    nextIdNum++;
    memberId = `VG${String(nextIdNum).padStart(5, '0')}`;
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
    const newOtp = generateOTP();
    const resetPasswordDescription = `Dear Member,\n\nYour OTP for password reset is: ${newOtp}\n\nPlease use this OTP to proceed with resetting your password.\n\nPlease keep don't share with anyone.\n\nBest regards,\nVGK-Club Team`;
    storeOTP(email, newOtp);
    await sendMail(email, resetPasswordSubject , resetPasswordDescription);
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
      message: `${
        userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()
      } login successful`,
      
    });
   
  } catch (error) {
    console.error("Login Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error });
  }
};

module.exports = {
  signup,
  getSponsorDetails,
  recoverPassword,
  resetPassword,
  login,
};
