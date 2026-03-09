export const getCCIPStatus = async (messageId: string) => {
  try {
    const response = await fetch(
      `/ccip-api/message/${messageId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching CCIP status:', error);
    throw new Error('Failed to fetch CCIP status');
  }
};

export async function getLidoAPY(): Promise<number | null> {
  try {
    const response = await fetch(
      'https://eth-api-hoodi.testnet.fi/v1/protocol/steth/apr/last',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data && typeof data.data.apr === 'number') {
      return Number(data.data.apr.toFixed(2));
    } else {
      console.warn('Unexpected APY data format:', data);
      return null;
    }
  } catch (error) {
    console.error("Error fetching Lido APY:", error);
    return null;
  }
}

type CCTPV2Message = {
  status?: string;
  attestation?: string;
  message?: string;
};

export type CCTPAttestationQuery = {
  messageHash: string;
  sourceDomainId?: number;
  transactionHash?: string;
  useMessagesV2?: boolean;
};

export const getCCTPAttestation = async (query: string | CCTPAttestationQuery) => {
  const request = typeof query === 'string' ? { messageHash: query } : query;
  const useMessagesV2 = Boolean(request.useMessagesV2 && request.sourceDomainId && request.transactionHash);

  try {
    const response = await fetch(
      useMessagesV2
        ? `/circle-api/v2/messages/${request.sourceDomainId}?transactionHash=${request.transactionHash}`
        : `/circle-api/attestations/${request.messageHash}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    if (!response.ok) {
      const error = new Error(`CCTP attestation request failed with status ${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }


    if (useMessagesV2) {
      const data = await response.json() as { messages?: CCTPV2Message[] };
      const message = data.messages?.[0];
      return {
        status: message?.status || 'pending_confirmations',
        attestation: message?.attestation || '',
        message: message?.message || '',
      };
    }

    return await response.json() as { status?: string; attestation?: string };
  } catch (error) {
    console.error('Error fetching CCTP attestation:', error);
    throw error;
  }
};

export const getCCIPTransactions = async (address: string) => {
  try {
    const response = await fetch(
      `https://ccip.chain.link/api/h/atlas/transactions?first=100&offset=0&sender=${address.toLowerCase()}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching CCIP Transactions:', error);
    throw new Error('Failed to fetch CCIP Transactions');
  }
};
