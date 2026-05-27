export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { idea } = req.body;
  if (!idea) {
    return res.status(400).json({ error: 'No idea provided' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.ANTHROPIC_API_KEY
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a social media expert for Mr Papa Catering in Canberra. Based on: "${idea}" - Generate 3 SHORT ideas with title, caption (max 100 chars), best time, and 5-7 hashtags. Return ONLY as JSON array: [{"title":"...","caption":"...","time":"...","tags":"..."}]`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const ideas = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    
    return res.status(200).json({ ideas });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to generate ideas' });
  }
}