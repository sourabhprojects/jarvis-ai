export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY is missing in Vercel"
      });
    }

    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Please provide a message"
      });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are JARVIS, a helpful, intelligent AI assistant. Answer accurately, naturally, and clearly. You can speak Hindi, Hinglish, and English. Never claim to have searched the internet unless search results are provided."
      },
      ...history
        .filter(
          item =>
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
        )
        .slice(-10),
      {
        role: "user",
        content: message
      }
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://jarvis-ai-rosy.vercel.app",
          "X-OpenRouter-Title": "JARVIS AI"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages,
          temperature: 0.7
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed"
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply || typeof reply !== "string") {
      return res.status(502).json({
        error: "OpenRouter returned an empty response"
      });
    }

    return res.status(200).json({
      reply: reply.trim()
    });
  } catch (error) {
    console.error("JARVIS chat error:", error);

    return res.status(500).json({
      error: "JARVIS server error. Please try again."
    });
  }
        }
