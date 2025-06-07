import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  className?:any;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  label,
  suffix,
  className
}) => {
  const [focused, setFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(parseFloat(newValue.toFixed(2)));
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(parseFloat(newValue.toFixed(2)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (newValue === '') {
      onChange(0);
      return;
    }
    
    // Remove leading zeros
    const cleanValue = newValue.replace(/^0+/, '') || '0';
    
    // Limit to 6 decimal places
    const parts = cleanValue.split('.');
    if (parts[1] && parts[1].length > 6) {
      const limitedValue = `${parts[0]}.${parts[1].slice(0, 6)}`;
      setInputValue(limitedValue);
      const numValue = parseFloat(limitedValue);
      if (!isNaN(numValue)) {
        onChange(Math.max(min, Math.min(max, numValue)));
      }
      return;
    }
    
    setInputValue(cleanValue);
    const numValue = parseFloat(cleanValue);
    if (!isNaN(numValue)) {
      onChange(Math.max(min, Math.min(max, numValue)));
    }
  };

  return (
    <div className="w-full">
      {label && <label className="block text-sm opacity-70 mb-1">{label}</label>}
      <div 
        className={`
          flex items-center border rounded-md overflow-hidden
          ${focused ? 'border-amber-500' : 'border-amber-700/50'}
          bg-amber-900/20 backdrop-blur-sm
        `}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="p-2 hover:bg-amber-700/30 disabled:opacity-50"
        >
          <Minus size={16} />
        </button>
        
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent px-2 py-1 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        
        {suffix && (
          <span className="px-2 text-sm opacity-70">{suffix}</span>
        )}
        
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="p-2 hover:bg-amber-700/30 disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

export default AmountInput;