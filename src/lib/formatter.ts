export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  export const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  
  export const formatCurrency = (amount: number, currency: string): string => {
    // For crypto currencies, show up to 6 decimal places
    if (['BTC', 'ETH', 'SOL', 'USDT', 'USDC'].includes(currency)) {
      // Smartly format crypto amounts based on size
      if (amount < 0.000001) {
        return `${amount.toFixed(8)} ${currency}`;
      } else if (amount < 0.01) {
        return `${amount.toFixed(6)} ${currency}`;
      } else if (amount < 1) {
        return `${amount.toFixed(4)} ${currency}`;
      } else {
        return `${amount.toFixed(2)} ${currency}`;
      }
    }
    
    // For fiat currencies
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };