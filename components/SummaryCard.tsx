import React from 'react';

interface SummaryCardProps {
    title: string;
    value: string;
    subValue?: string;
    color?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
    isActive?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, subValue, color, isActive }) => {
    const colorClasses = {
        green: 'bg-green-100 border-green-200 text-green-800',
        yellow: 'bg-yellow-100 border-yellow-200 text-yellow-800',
        red: 'bg-red-100 border-red-200 text-red-800',
        blue: 'bg-blue-100 border-blue-200 text-blue-800',
        purple: 'bg-purple-100 border-purple-200 text-purple-800',
        default: 'bg-slate-100 border-slate-200 text-slate-800'
    };
    
    const selectedColor = color ? colorClasses[color] : colorClasses.default;
    const activeClasses = isActive ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent';

    return (
        <div className={`p-3 h-full rounded-lg shadow-sm border ${selectedColor} ${activeClasses} flex flex-col justify-between transition-all`}>
            <div>
                <p className="text-xs text-slate-500 font-medium truncate">{title}</p>
                <p className="text-xl font-bold mt-1">
                    {value}
                </p>
            </div>
            {subValue && <p className="text-sm font-semibold text-slate-700 mt-1">{subValue}</p>}
        </div>
    );
};

export default SummaryCard;