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
        
        if (data && typeof data.apr === 'number') {
            return Number(data.apr.toFixed(2));
        } else {
            console.warn('Unexpected APY data format:', data);
            return null;
        }
    } catch (error) {
        console.error("Error fetching Lido APY:", error);
        return null;
    }
}