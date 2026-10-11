export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Please use POST to chat with JARVIS."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
    });
  }

  try {
    // Read the incoming message
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          error: "Invalid JSON request body."
        });
      }
    }

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    if (message.length > 10000) {
      return res.status(400).json({
        error: "Message is too long. Please use fewer than 10000 characters."
      });
    }

    // Call Gemini API
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are JARVIS, a personal AI assistant created by Sourabh Mehra. " +
                  "Never falsely claim to be another AI. " +
                  "Be helpful, accurate, friendly, and clear. " +
                  "Reply in the user's language, including Hindi and Hinglish when appropriate."
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    // Read Gemini response safely
    const rawResponse = await geminiResponse.text();

    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch {
      console.error(
        "Gemini returned a non-JSON response. HTTP status:",
        geminiResponse.status
      );

      return res.status(502).json({
        error: "Gemini returned an unexpected response.",
        status: geminiResponse.status
      });
    }

    // Return the actual Gemini error for diagnosis
    if (!geminiResponse.ok) {
      const googleError =
        data?.error?.message || "Unknown Gemini API error.";

      console.error(
        "Gemini API error:",
        geminiResponse.status,
        googleError
      );

      return res.status(502).json({
        error: "Gemini API request failed.",
        status: geminiResponse.status,
        details: googleError
      });
    }

    // Extract AI answer
    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      console.error(
        "Gemini returned no text.",
        JSON.stringify(data?.promptFeedback || {})
      );

      return res.status(502).json({
        error: "Gemini did not return a text answer.",
        reason:
          data?.promptFeedback?.blockReason ||
          data?.candidates?.[0]?.finishReason ||
          "No answer was returned."
      });
    }

    // Successful response
    return res.status(200).json({
      reply: answer
    });

  } catch (error) {
    console.error("JARVIS server error:", error);

    return res.status(500).json({
      error: "JARVIS encountered a server error.",
      details: error?.message || "Unknown server error."
    });
  }
}
