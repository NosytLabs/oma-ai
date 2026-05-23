export interface TinyFishFetchResult {
  url: string;
  status: number;
  content: string;
  title?: string;
  description?: string;
}

export interface TinyFishFetchResponse {
  results: TinyFishFetchResult[];
}

export async function fetchWebPages(urls: string[]): Promise<TinyFishFetchResponse> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error('TINYFISH_API_KEY not configured');
  }

  const resp = await fetch('https://api.fetch.tinyfish.ai', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls }),
  });

  if (!resp.ok) {
    throw new Error(`TinyFish Fetch API error: ${resp.status}`);
  }

  return resp.json();
}