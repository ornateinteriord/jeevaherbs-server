const crypto = require("crypto");

let otpStore = {}

const generateOTP = (length = 6) => {
    const otp = crypto.randomInt(100000, 999999).toString(); 
    return otp;
  };


  const storeOTP = (email, otp) => {
    otpStore[email] = otp;
    setTimeout(() => {
      delete otpStore[email]; 
    }, 3 * 60 * 1000);
  };


  const verifyOTP = (email, otp) => {
    if (otpStore[email] && otpStore[email] === otp) {
      delete otpStore[email]; 
      return true;
    }
    return false;
  };

  module.exports = { generateOTP, storeOTP, verifyOTP };