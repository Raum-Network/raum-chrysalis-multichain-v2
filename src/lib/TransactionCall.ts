export async function getCCIPTransactions(address:any): Promise<any | null> {
    try {
        const response = await fetch(`/api/ccip-transactions?address=${address}`); // Use the new API route
        const data = await response.json();
       
        if (data) {
          
            return data;
        } else {
            throw new Error("CCIP data not found");
        }
    } catch (error) {
        console.error("Error fetching CCIP Transactions:", error);
        return null;
    }
}