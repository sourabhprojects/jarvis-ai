export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "TAVILY_API_KEY is missing in Vercel Environment Variables"
      });
    }

    const { query } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Please provide a search query"
      });
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        topic: "general",
        search_depth: "basic",
        max_results: 5,
        include_answer: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Tavily API error:", data);

      return res.status(response.status).json({
        error: data?.detail || data?.message || "Tavily search failed"
      });
    }

    return res.status(200).json({
      answer: data.answer || "",
      results: (data.results || []).map(item => ({
        title: item.title,
        url: item.url,
        content: item.content
      }))
    });
  } catch (error) {
    console.error("Tavily search error:", error);

    return res.status(500).json({
      error: "Internet search failed. Please try again."
    });
  }
          }
