/* global process */
import * as functions from 'firebase-functions'
import admin from 'firebase-admin'
import cors from 'cors'
import sgMail from '@sendgrid/mail'
import dotenv from 'dotenv'

dotenv.config()

admin.initializeApp()
const db = admin.firestore()
const corsHandler = cors({ origin: true })

// Feedback

export const getFeedbacks = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const snapshot = await db.collection('feedbacks').get()
      const feedbacks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      res.status(200).json(feedbacks)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message })
    }
  })
})

export const addFeedback = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
      const data = req.body
      if (!data.participantName || !data.programName)
        return res.status(400).json({ error: 'Name and Program required' })
      const docRef = await db.collection('feedbacks').add(data)
      res.status(200).json({ id: docRef.id, ...data })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message })
    }
  })
})

//  SendGrid Bulk Email

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export const sendBulkEmail = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

      const { recipients, subject, message } = req.body
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'Recipients array required' })
      }

      const msg = {
        to: recipients,
        from: '815325776@qq.com',
        subject: subject || 'Welcome to Youth Mental Health!',
        text: message || 'Welcome! Thank you for joining us.',
        html: `<p>${message || 'Welcome! Thank you for joining us.'}</p>`,
      }

      await sgMail.send(msg)
      console.log(`Sent to ${recipients.length} recipients`)
      return res.status(200).json({ success: true, sent: recipients.length })
    } catch (err) {
      console.error('SendGrid Error:', err)
      return res.status(500).json({ error: err.message })
    }
  })
})
