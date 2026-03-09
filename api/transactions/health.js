const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const getStorageConfig = () => {
  const url = process.env.KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_URL
    || process.env.REDIS_URL;
  const token = process.env.KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
};

const callUpstash = async (storage, command) => {
  const response = await fetch(storage.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${storage.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result;
};

export default async function handler(_req, res) {
  const storage = getStorageConfig();

  if (!storage) {
    return json(res, 200, {
      ok: false,
      storage: 'disabled',
      configured: false,
      error: 'Missing KV_REST_API_URL or KV_REST_API_TOKEN.',
    });
  }

  try {
    const ping = await callUpstash(storage, ['PING']);

    return json(res, 200, {
      ok: true,
      storage: 'upstash',
      configured: true,
      ping,
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      storage: 'upstash',
      configured: true,
      error: error instanceof Error ? error.message : 'Unknown Upstash error',
    });
  }
}
