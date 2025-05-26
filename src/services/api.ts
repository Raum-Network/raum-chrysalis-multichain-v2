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
          'https://eth-api-holesky.testnet.fi/v1/protocol/steth/apr/last',
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

export const getCCTPAttestation = async (messageHash: string) => {
  try {
    const response = await fetch(
      `/circle-api/attestations/${messageHash}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching CCTP attestation:', error);
    throw new Error('Failed to fetch CCTP attestation');
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