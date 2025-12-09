// backend/server.js
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Check for API Key
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
}

const gemini = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});

// Helper: Base64 to Part
function base64ToGenerativePart(base64String, mimeType) {
    return {
        inlineData: {
            data: base64String,
            mimeType,
        },
    };
}

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => {
    res.send("RealCheck Node.js API server is running.");
});

// Analysis Route
app.post('/analyze', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: "Missing imageBase64 in request body." });
        }

        // Parse Base64
        const [header, base64Data] = imageBase64.split(',');
        const mimeType = header.match(/:(.*?);/)[1];

        const imagePart = base64ToGenerativePart(base64Data, mimeType);
        
        // FIX: Wrap text in an object
        const textPart = { 
            text: "Analyze this image. Does it appear to be a genuine photograph or an AI-generated image? Return a JSON object with only two fields: 'is_ai' (boolean) and 'confidence' (number 0-100), and 'reason' (string)." 
        };

        const prompt = [imagePart, textPart];

        const response = await gemini.models.generateContent({
            model: "gemini-pro", // FIX: Use stable 1.5-flash model
            contents: [{ role: "user", parts: prompt }],
            config: {
                responseMimeType: "application/json"
            }
        });

        const result = JSON.parse(response.text()); // Note: .text() is a method in some SDK versions
        res.json(result);

    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ 
            error: "Internal Server Error", 
            details: error.message 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});