
import React from 'react';

interface InputProps {
  label: string;
  value: number | string;
  onChange: (val: any) => void;
  type?: string;
  prefix?: string;
  step?: string;
}

export const InputField: React.FC<InputProps> = ({ label, value, onChange, type = "number", prefix, step }) => {
  const isCurrency = prefix === "R$";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCurrency) {
      // Remove non-digits to handle ATM-style input
      const rawValue = e.target.value.replace(/\D/g, '');
      const numberValue = Number(rawValue) / 100;
      onChange(numberValue);
    } else {
      onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value);
    }
  };

  // Format value for display if it's currency
  const displayValue = isCurrency && typeof value === 'number'
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
            {prefix}
          </span>
        )}
        <input
          type={isCurrency ? "text" : type}
          value={displayValue}
          step={step}
          onChange={handleChange}
          className={`w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${prefix ? 'pl-10' : ''}`}
        />
      </div>
    </div>
  );
};
