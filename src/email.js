const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
  host: process.env.AUTH_SMTP_HOST,
  port: parseInt(process.env.AUTH_SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.AUTH_SMTP_USER,
    pass: process.env.AUTH_SMTP_PASS
  }
})

async function sendEmail (email, subject, textMessage, htmlMessage) {
  let info = await transporter.sendMail({
    from: process.env.EMAIL_SENDER,
    to: email,
    subject: subject,
    text: textMessage,
    html: htmlMessage,
  });

  console.log("~~ email sent: %s", info.messageId);
}

module.exports = sendEmail
