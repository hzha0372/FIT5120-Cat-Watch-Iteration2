// src/services/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  console.error('Missing Gemini API key. Please add VITE_GEMINI_API_KEY in .env')
}

const genAI = new GoogleGenerativeAI(apiKey)

const model = genAI.getGenerativeModel({
  model: 'models/gemini-2.5-flash',
})

export async function generateText(prompt) {
  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (err) {
    console.error('Gemini API error:', err)
    return 'Gemini API call failed. Please check your key and model.'
  }
}
