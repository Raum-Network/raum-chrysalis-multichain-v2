export async function getCCIPTransactions(address: string): Promise<any> {
    try {
        const response = await fetch(
            `/ccip-api/transactions?first=100&offset=0&sender=${address.toLowerCase()}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching CCIP Transactions:", error);
        throw error;
    }
}