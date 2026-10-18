/**
 * EcoTrack AI Waste Recognition Controller
 * Real, genuine model integration with Google Gemini Vision API.
 * Never fabricates or randomizes predictions. If unconfigured or unavailable,
 * explicitly communicates that AI is unavailable and provides seamless manual fallback.
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');

// Allowed categories for classification validation
const VALID_CATEGORIES = ['Plastic', 'Paper', 'Metal', 'Glass', 'Organic Waste'];

async function identifyWaste(req, res) {
  try {
    const userId = req.session.userId;

    if (!req.file) {
      return errorResponse(res, 'Please provide an image of the waste item to identify.');
    }

    const imagePath = '/uploads/waste/' + req.file.filename;
    const fullDiskPath = req.file.path;

    const apiKey = process.env.GEMINI_API_KEY;

    // Check if genuine AI API key is configured
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
      return res.status(200).json({
        success: false,
        available: false,
        message: 'Waste recognition is currently unavailable. Please select the waste category manually.',
        data: {
          imagePath
        }
      });
    }

    // Call genuine Gemini Vision API if key is configured
    try {
      const imageBytes = fs.readFileSync(fullDiskPath);
      const base64Data = imageBytes.toString('base64');
      const mimeType = req.file.mimetype;

      const promptText = `You are an expert waste classification system. Analyze this image carefully and classify the primary waste item into exactly ONE of the following 5 categories:
- Plastic
- Paper
- Metal
- Glass
- Organic Waste

Respond ONLY with a JSON object in this exact format (no markdown code blocks, just raw JSON):
{
  "category": "One of: Plastic, Paper, Metal, Glass, Organic Waste",
  "confidence": 85,
  "explanation": "Brief 1-sentence reason for this classification.",
  "disposalRecommendation": "Specific recommendation on how to clean or dispose of this item."
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!apiResponse.ok) {
        console.warn('Gemini API call returned non-200 status:', apiResponse.status);
        return res.status(200).json({
          success: false,
          available: false,
          message: 'Waste recognition is currently unavailable. Please select the waste category manually.',
          data: { imagePath }
        });
      }

      const jsonResult = await apiResponse.json();
      const rawText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return res.status(200).json({
          success: false,
          available: false,
          message: 'Waste recognition is currently unavailable. Please select the waste category manually.',
          data: { imagePath }
        });
      }

      let parsed;
      try {
        // Strip any stray markdown if present
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.warn('Failed to parse AI response JSON:', rawText);
        return res.status(200).json({
          success: false,
          available: false,
          message: 'Waste recognition is currently unavailable. Please select the waste category manually.',
          data: { imagePath }
        });
      }

      // Validate category returned by AI
      let predictedCategory = parsed.category?.trim();
      const matchedCategory = VALID_CATEGORIES.find(c => c.toLowerCase() === predictedCategory?.toLowerCase());

      if (!matchedCategory) {
        return res.status(200).json({
          success: false,
          available: false,
          message: 'Waste recognition could not determine a standard category with high certainty. Please select manually.',
          data: { imagePath }
        });
      }

      const confidenceScore = typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 10), 100) : null;

      // Save genuine prediction to recognition_results table
      const [insertResult] = await pool.execute(
        `INSERT INTO recognition_results 
          (user_id, predicted_category, confidence_score, image_path) 
         VALUES (?, ?, ?, ?)`,
        [userId, matchedCategory, confidenceScore, imagePath]
      );

      // Fetch matching category ID from database for direct prefilling in report form
      const [catRows] = await pool.execute(
        'SELECT id, disposal_method FROM waste_categories WHERE name = ?',
        [matchedCategory]
      );

      return successResponse(res, 'Waste item successfully identified!', {
        recognitionId: insertResult.insertId,
        available: true,
        category: matchedCategory,
        categoryId: catRows.length > 0 ? catRows[0].id : null,
        confidence: confidenceScore,
        explanation: parsed.explanation || '',
        disposalMethod: catRows.length > 0 ? catRows[0].disposal_method : parsed.disposalRecommendation,
        imagePath
      });
    } catch (aiErr) {
      console.error('AI Recognition Error:', aiErr.message);
      return res.status(200).json({
        success: false,
        available: false,
        message: 'Waste recognition is currently unavailable. Please select the waste category manually.',
        data: { imagePath }
      });
    }
  } catch (error) {
    console.error('identifyWaste handler error:', error.message);
    return errorResponse(res, 'An error occurred during recognition.', 500);
  }
}

module.exports = {
  identifyWaste
};
