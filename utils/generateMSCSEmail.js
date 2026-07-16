const generateMSCSEmail = (memberId, password, name = 'Member') => {
  const welcomeSubject = 'VGK-Club - Account Registration Successful';
  
  const welcomeMessage = `
    <div style="font-family: Arial, sans-serif; padding: 10px; line-height: 1.6; margin-bottom: 100px; max-width: 700px; margin: 0 auto;">
  
      <!-- Content -->
      <div style="padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin-bottom: 20px;">
          Dear <strong style="color: #7e22ce;">${name}</strong>,
        </p>

        <p style="color: #374151; margin-bottom: 20px;">
          Your account registration with <strong>Manipal Society</strong> has been successfully completed.
        </p>

        <!-- Credentials Box -->
        <div style="background: #f8f7ff; border-left: 4px solid #7e22ce; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <h3 style="color: #581c87; margin-top: 0; margin-bottom: 15px;">Your Login Credentials:</h3>
          <p style="margin: 8px 0;"><strong style="color: #7e22ce;">Username:</strong> ${memberId}</p>
          <p style="margin: 8px 0;"><strong style="color: #7e22ce;">Password:</strong> ${password}</p>
        </div>

        <p style="color: #374151; margin-bottom: 25px;">
          Please keep your login credentials secure and do not share them with anyone.
        </p>

        <!-- Footer -->
        <div style="border-top: 2px solid #f3f4f6; padding-top: 25px; margin-top: 25px;">
          <p style="color: #6b7280; margin-bottom: 5px;">Best regards,</p>
          <p style="color: #7e22ce; font-weight: bold; margin: 0;">Manipal Society Team</p>
        </div>
      </div>
    </div>
  `;
  
  return { welcomeMessage, welcomeSubject };
};
module.exports = { generateMSCSEmail };