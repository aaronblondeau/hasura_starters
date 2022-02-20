const Mailjet = require('node-mailjet')

async function sendEmail (email, subject, textMessage, htmlMessage) {
  if (process.env.SEND_EMAILS !== 'yes') {
    console.log('~~ Would send email but SEND_EMAILS != yes', email, textMessage)
    return false
  }

  const sender = Mailjet.connect(process.env.MAILJET_KEY, process.env.MAILJET_SECRET)

  const result = await sender.post('send', { version: 'v3.1' })
    .request({
      Messages: [
        {
          From: {
            Email: process.env.EMAIL_FROM || 'hello@example.com',
            Name: process.env.APP_NAME || 'hasura_starters'
          },
          To: [
            {
              Email: email // ,
              // 'Name': 'Aaron'
            }
          ],
          Subject: subject,
          TextPart: textMessage,
          HTMLPart: htmlMessage // ,
          // 'CustomID': 'AppGettingStartedTest'
        }
      ]
    })
  return result
}

module.exports = sendEmail
