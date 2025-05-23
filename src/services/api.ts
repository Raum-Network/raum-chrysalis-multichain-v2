export const getCCIPStatus = async (messageId: string) => {
  try {
    const response = await fetch(
      `/ccip-api/h/atlas/message/${messageId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching CCIP status:', error);
    throw new Error('Failed to fetch CCIP status');
  }
};

export const getLidoAPY = async () => {
  try {
    const response = await fetch(
      'https://eth-api-holesky.testnet.fi/v1/protocol/steth/apr/last',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching Lido APY:', error);
    throw new Error('Failed to fetch Lido APY');
  }
};

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
      `/ccip-api/h/atlas/transactions?first=100&offset=0&sender=${address.toLowerCase()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching CCIP Transactions:', error);
    throw new Error('Failed to fetch CCIP Transactions');
  }
};