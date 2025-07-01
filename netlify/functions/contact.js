// netlify/functions/contact.js
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);

  // Validate/sanitize input here
  const { name, email, message } = data;

  // Set up your email transport (use your SMTP credentials)
  const transporter = nodemailer.createTransport({
    host: "smtp.yourprovider.com",
    port: 587,
    auth: {
      user: "youruser",
      pass: "yourpass"
    }
  });

  const mailOptions = {
    from: email,
    to: 'your@email.com',
    subject: `New message from ${name}`,
    text: message
  };

  try {
    await transporter.sendMail(mailOptions);
    return { statusCode: 200, body: 'success' };
  } catch (error) {
    return { statusCode: 500, body: 'error' };
  }
};
