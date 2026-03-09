const STORAGE_PREFIX = 'chrysalis:tx';

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const normalizeAddress = (address) => String(address || '').toLowerCase();

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

const getIndexKey = (address) => `${STORAGE_PREFIX}:index:${address}`;
const getItemKey = (address, id) => `${STORAGE_PREFIX}:item:${address}:${id}`;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const walletAddress = normalizeAddress(req.query.address || req.body?.address);
  if (!walletAddress) {
    return json(res, 400, { error: 'Missing address query param' });
  }

  const storage = getStorageConfig();
  if (!storage) {
    return json(res, 503, {
      error: 'Transaction storage is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.',
    });
  }

  const now = Date.now();
  const transaction = {
    id: `debug:${walletAddress}:${now}`,
    walletAddress,
    protocol: 'CCTP',
    messageId: `debug-message-${now}`,
    sourceTxHash: `debug-source-${now}`,
    sourceNetworkName: 'Debug Source',
    destNetworkName: 'Debug Destination',
    sender: walletAddress,
    receiver: walletAddress,
    amount: '1',
    assetSymbol: 'USDC',
    sourceDecimals: 6,
    destDecimals: 6,
    status: 'IN_PROGRESS',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const indexKey = getIndexKey(walletAddress);
    const itemKey = getItemKey(walletAddress, transaction.id);

    await Promise.all([
      callUpstash(storage, ['SET', itemKey, JSON.stringify(transaction)]),
      callUpstash(storage, ['ZADD', indexKey, String(transaction.updatedAt), transaction.id]),
    ]);

    return json(res, 200, {
      ok: true,
      storage: 'upstash',
      transaction,
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      storage: 'upstash',
      error: 'Failed to write debug transaction',
      detail: error instanceof Error ? error.message : 'Unknown write error',
    });
  }
}
