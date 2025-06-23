export interface SepoliaLog {
  BLOCK_NUMBER: number;
  TIME_STAMP: string;
  TRANSACTION_HASH: string;
  EVENT_INDEX: number;
  NAME: string | null;
  CONTRACT_ADDRESS: string;
  TOPIC_0: string;
  TOPIC_1: string | null;
  TOPIC_2: string | null;
  TOPIC_3: string | null;
  STATUS: number;
  DATA_: string | null;
  RAW_DATA: string;
  ANONYMOUS: string | null;
}

const API_URL = "https://proxy.api.makeinfinite.dev/v1/sql";
const API_KEY = import.meta.env.VITE_API_KEY

export async function fetchSepoliaLogs(fromBlock: number): Promise<SepoliaLog[]> {
  const sqlText = `
    SELECT * FROM SEPOLIA.LOGS
    WHERE contract_address = LOWER('0x7865fAfC2db2093669d92c0F33AeEF291086BEFD')
      AND block_number > ${fromBlock - 30000}
      AND block_number <= ${fromBlock}
    ORDER BY block_number DESC
    LIMIT 100;
  `;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "apikey": API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sqlText
    })
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Sepolia logs");
  }

  const data = await response.json();
  return data as SepoliaLog[];
}