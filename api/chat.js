export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const tavilyKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY is missing in Vercel"
      });
    }

    const { message, history = [] } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please provide a message"
      });
    }

    let searchContext = "";
    let sources = [];

    // Search the web when the question needs current information.
    const needsSearch =
      /\b(search|latest|today|current|news|weather|price|recent|2026|who is|what happened)\b/i.test(message) ||
      /आज|ताज़ा|ताजा|अभी|लेटेस्ट|समाचार|खबर|ख़बर|मौसम|कीमत|कौन है|क्या हुआ|इंटरनेट पर खोज/i.test(message);

    if (needsSearch && tavilyKey) {
      try {
        const searchResponse = await fetch(
          "https://api.tavily.com/search",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query: message,
              topic: "general",
              search_depth: "basic",
              max_results: 5,
              include_answer: true
            })
          }
        );

        const searchData = await searchResponse.json();

        if (searchResponse.ok) {
          sources = (searchData.results || []).map(item => ({
            title: item.title,
            url: item.url
          }));

          searchContext = [
            searchData.answer || "",
            ...(searchData.results || []).map(
              item => `Title: ${item.title}\nURL: ${item.url}\nContent: ${item.content}`
            )
          ].filter(Boolean).join("\n\n");
        } else {
          console.error("Tavily error:", searchData);
        }
      } catch (searchError) {
        console.error("Tavily request failed:", searchError);
      }
    }

    const messages = [
      {
        role: "system",
        content:
          "You are JARVIS, a helpful AI assistant. Reply naturally in the user's language, including Hindi or Hinglish. If web search results are provided, use them to answer current questions and do not invent facts. Mention uncertainty when needed. Never claim you searched the web if no search results were provided."
      },
      ...history
        .filter(item =>
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
        .slice(-10),
      {
        role: "user",
        content: searchContext
          ? `Question: ${message}\n\nWeb search results:\n${searchContext}\n\nAnswer the question using these results. Include useful source URLs in your answer.`
          : message
      }
    ];

    const aiResponse = await fetch(
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

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("OpenRouter error:", aiData);
      return res.status(aiResponse.status).json({
        error: aiData?.error?.message || "OpenRouter request failed"
      });
    }

    const reply = aiData?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "OpenRouter returned an empty response"
      });
    }

    return res.status(200).json({
      reply: reply.trim(),
      sources,
      searched: sources.length > 0
    });
  } catch (error) {
    console.error("JARVIS chat error:", error);
    return res.status(500).json({
      error: "JARVIS server error. Please try again."
    });
  }
      }
