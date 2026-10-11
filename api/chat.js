export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Please use POST to chat with JARVIS."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "JARVIS API key is not configured."
    });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are JARVIS, a personal AI assistant created by Sourabh Mehra. Never claim to be ChatGPT or Gemini. Help users honestly and clearly. Reply in the user's language, including Hindi and Hinglish."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: message.slice(0, 10000) }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: "JARVIS could not get an AI response.",
        details: data.error?.message || "Check API settings and quota."
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: "The AI returned an empty response."
      });
    }

    return res.status(200).json({
      reply: answer
    });

  } catch (error) {
    return res.status(500).json({
      error: "JARVIS encountered a server error."
    });
  }
}
