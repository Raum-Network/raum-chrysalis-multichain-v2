export async function getLidoAPY(): Promise<number | null> {
    try {
        const response = await fetch('/api/lidoAPY'); // Use the new API route
        const data = await response.json();
        console.log(data , "ss")
        if (data.data.apr) {
            console.log(`Lido APY Today: ${data.data.apr.toFixed(2)}%`);
            return data.data.apr.toFixed(2);
        } else {
            throw new Error("APY data not found");
        }
    } catch (error) {
        console.error("Error fetching Lido APY:", error);
        return null;
    }
}