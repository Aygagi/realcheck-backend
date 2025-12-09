// backend/server.js
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000; // Use port 3000 locally, or the port provided by the host (like Render)

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allows large image base64 strings

// Check for API Key and initialize Gemini Client
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
    // Exit the process if the key is missing, as the core functionality won't work
    process.exit(1); 
}

const gemini = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});

// --- HELPER FUNCTION: Base64 to GoogleGenerativeAI.Part ---
function base64ToGenerativePart(base64String, mimeType) {
    return {
        inlineData: {
            data: base64String,
            mimeType,
        },
    };
}

// --- ROUTES ---

// Health Check Route (responds to the base URL)
app.get('/', (req, res) => {
    res.send("RealCheck Node.js API server is running.");
});

// Core Image Analysis Route
app.post('/analyze', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: "Missing imageBase64 in request body." });
        }

        // The image data is coming from the client as a data URL (e.g., "data:image/png;base64,...")
        const [header, base64Data] = imageBase64.split(',');
        const mimeType = header.match(/:(.*?);/)[1];

        const imagePart = base64ToGenerativePart(base64Data, mimeType);

        const prompt = [
            imagePart,
            "Analyze this image. Does it appear to be a genuine photograph or an AI-generated image (e.g., using Midjourney, DALL-E, Stable Diffusion, etc.)? Return a JSON object with only the following two fields: 'is_ai' (boolean), 'confidence' (number from 0 to 100), and 'reason' (string, max 50 words explaining why). Do not include any text outside the JSON object.",
        ];

        const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash", // Use the powerful vision model
            contents: [{ role: "user", parts: prompt }],
            config: {
                responseMimeType: "application/json"
            }
        });

        // The response text is already a JSON string, so we parse it and send it back.
        const result = JSON.parse(response.text);
        res.json(result);

    } catch (error) {
        console.error("Gemini API or Server Error:", error);
        // This 500 status is what you are currently seeing
        res.status(500).json({ error: "Failed to analyze image due to an internal server error." });
    }
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});