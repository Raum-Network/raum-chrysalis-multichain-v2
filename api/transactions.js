const STORAGE_PREFIX = 'chrysalis:tx';
const MAX_LIMIT = 200;

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

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  return {};
};

const validateTransaction = (transaction) => {
  if (!transaction || typeof transaction !== 'object') return 'Invalid payload';
  if (!transaction.id) return 'Missing transaction id';
  if (!transaction.walletAddress) return 'Missing walletAddress';
  if (!transaction.protocol) return 'Missing protocol';
  if (!transaction.sourceTxHash) return 'Missing sourceTxHash';
  return null;
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const storage = getStorageConfig();

  if (req.method === 'GET') {
    const address = normalizeAddress(req.query.address);
    const requestedLimit = Number(req.query.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
      : 100;

    if (!address) {
      return json(res, 400, { error: 'Missing address query param' });
    }

    if (!storage) {
      return json(res, 200, {
        transactions: [],
        storage: 'disabled',
      });
    }

    try {
      const indexKey = getIndexKey(address);
      const ids = await callUpstash(storage, ['ZREVRANGE', indexKey, '0', String(limit - 1)]);

      if (!Array.isArray(ids) || ids.length === 0) {
        return json(res, 200, {
          transactions: [],
          storage: 'upstash',
        });
      }

      const itemKeys = ids.map((id) => getItemKey(address, id));
      const values = await callUpstash(storage, ['MGET', ...itemKeys]);

      const transactions = (Array.isArray(values) ? values : [])
        .map((rawValue) => {
          if (typeof rawValue !== 'string') return null;
          try {
            return JSON.parse(rawValue);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

      return json(res, 200, {
        transactions,
        storage: 'upstash',
      });
    } catch (error) {
      console.error('Failed to fetch transactions from Upstash:', error);
      return json(res, 500, {
        error: 'Failed to fetch transactions',
        detail: error instanceof Error ? error.message : 'Unknown fetch error',
      });
    }
  }

  const payload = parseBody(req);
  const validationError = validateTransaction(payload);

  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const transaction = {
    ...payload,
    walletAddress: normalizeAddress(payload.walletAddress),
    createdAt: Number(payload.createdAt || Date.now()),
    updatedAt: Number(payload.updatedAt || Date.now()),
  };

  if (!storage) {
    return json(res, 200, {
      ok: true,
      transaction,
      storage: 'disabled',
    });
  }

  try {
    const indexKey = getIndexKey(transaction.walletAddress);
    const itemKey = getItemKey(transaction.walletAddress, transaction.id);

    await Promise.all([
      callUpstash(storage, ['SET', itemKey, JSON.stringify(transaction)]),
      callUpstash(storage, ['ZADD', indexKey, String(transaction.updatedAt), transaction.id]),
    ]);

    return json(res, 200, {
      ok: true,
      transaction,
      storage: 'upstash',
    });
  } catch (error) {
    console.error('Failed to persist transaction to Upstash:', error);
    return json(res, 500, {
      error: 'Failed to persist transaction',
      detail: error instanceof Error ? error.message : 'Unknown persist error',
    });
  }
}
