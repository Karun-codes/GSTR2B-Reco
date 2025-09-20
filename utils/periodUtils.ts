import { Period } from '../types';

export const getMonthName = (monthNumber: number): string => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return monthNames[monthNumber - 1];
};

export const formatPeriod = (period: Period): string => {
    const month = period.month.toString().padStart(2, '0');
    return `${period.year}-${month}`; // YYYY-MM format
};

export const getNextPeriod = (period: Period): Period => {
    if (period.month === 12) {
        return { month: 1, year: period.year + 1 };
    }
    return { month: period.month + 1, year: period.year };
};
