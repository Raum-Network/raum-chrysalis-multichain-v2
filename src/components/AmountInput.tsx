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
  className?: string;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 10000000,
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

    const cleanValue = newValue.replace(/^0+/, '') || '0';
    const parts = cleanValue.split('.');
    if (parts[1] && parts[1].length > 6) {
      const limitedValue = `${parts[0]}.${parts[1].slice(0, 6)}`;
      setInputValue(limitedValue);
      const numValue = parseFloat(limitedValue);
      if (!Number.isNaN(numValue)) {
        onChange(Math.max(min, Math.min(max, numValue)));
      }
      return;
    }

    setInputValue(cleanValue);
    const numValue = parseFloat(cleanValue);
    if (!Number.isNaN(numValue)) {
      onChange(Math.max(min, Math.min(max, numValue)));
    }
  };

  return (
    <div className="w-full">
      {label && <label className="mb-2 block text-sm font-medium muted-copy">{label}</label>}
      <div
        className={`flex items-center overflow-hidden rounded-[24px] border px-1 transition-all duration-200 ${
          focused
            ? 'border-[rgba(var(--accent),0.3)] shadow-[0_0_0_4px_rgba(16,122,110,0.08)]'
            : 'border-black/5'
        } premium-card ${className || ''}`}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="rounded-[18px] p-3 transition-colors hover:bg-black/5 disabled:opacity-40"
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
          className="w-full bg-transparent px-3 py-4 text-center text-lg font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        {suffix && (
          <span className="rounded-[18px] bg-black/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] muted-copy">
            {suffix}
          </span>
        )}

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="ml-1 rounded-[18px] p-3 transition-colors hover:bg-black/5 disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

export default AmountInput;
