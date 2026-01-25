const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendOtpEmail(to, otp) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await transporter.sendMail({
    from,
    to,
    subject: "Your PawCart Login OTP",
    text: `Your OTP is: ${otp}\n\nThis code expires in ${process.env.OTP_EXPIRE_MIN || 10} minutes.\nIf you did not request this, ignore this email.`,
  });
}

module.exports = { sendOtpEmail };
