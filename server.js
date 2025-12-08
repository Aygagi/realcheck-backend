// RealCheck/backend/server.js

const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');

// --- 1. CONFIGURATION ---

// Critical: Use the port provided by the cloud environment (Render) or default to 3000
const PORT = process.env.PORT || 3000; 

// Replace with your actual Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE"; 
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const model = 'gemini-2.5-flash';

const app = express();

// Critical: Configure CORS to allow requests from your public Netlify frontend
// For now, we allow all origins ('*') for easy testing.
// In a real Cybersecurity scenario, you would restrict this to your Netlify domain.
app.use(cors({ origin: '*' }));

// Increase payload size limit to handle large base64 image strings
app.use(bodyParser.json({ limit: '50mb' }));


// --- 2. HELPER FUNCTION ---

function base64ToGenerativePart(base64Data, mimeType) {
  // Base64 data from the client includes the prefix (e.g., 'data:image/jpeg;base64,')
  const base64Content = base64Data.split(',')[1];
  
  if (!base64Content) {
    throw new Error("Invalid base64 format received.");
  }

  return {
    inlineData: {
      data: base64Content,
      mimeType,
    },
  };
}


// --- 3. API ROUTE ---

app.post('/analyze', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 data in request body.' });
  }

  try {
    // Extract mime type from base64 string (e.g., 'image/jpeg')
    const mimeMatch = imageBase64.match(/^data:(.+?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'; // Default to JPEG if detection fails

    const imagePart = base64ToGenerativePart(imageBase64, mimeType);

    const prompt = "Analyze this image and determine if it was created by an AI image generator or if it is a photo of a real-world scene. Provide a JSON response with the following keys:\n1. is_ai: (boolean, true if AI generated, false if real photo)\n2. confidence: (number 1-100, the confidence level)\n3. reason: (string, a brief explanation of the key visual indicators used for the determination, focusing on artifacts, texture, lighting, or common AI flaws).";

    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
    });
    
    // Attempt to parse the JSON output from the model
    let jsonResponse;
    try {
      // Use the safer JSON extraction method
      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Model response was not valid JSON.");
      }
    } catch (e) {
      console.error("Failed to parse model output:", e);
      // Fallback response if parsing fails
      return res.status(500).json({ 
        error: "Analysis completed but model output was unparsable.",
        model_output: response.text 
      });
    }

    // Send the structured JSON response back to the client
    res.json(jsonResponse);

  } catch (error) {
    console.error("Gemini API or Server Error:", error);
    res.status(500).json({ error: 'Failed to analyze image due to an internal server error.' });
  }
});


// --- 4. HEALTH CHECK / ROOT ROUTE ---

// Simple GET route for a health check (Render needs this)
app.get('/', (req, res) => {
    res.send('RealCheck Node.js API server is running.');
});


// --- 5. START SERVER ---

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (PORT == 3000) {
      console.log('Local Mode: Remember to start this server with your actual API key.');
  }
});