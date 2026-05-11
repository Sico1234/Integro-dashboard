import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays, parseISO, format as dateFnsFormat, startOfDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a date to UTC midnight to avoid timezone shifts.
 * This ensures the calendar day remains the same regardless of the user's timezone.
 */
export function normalizeDate(date: Date | string | number | null): Date | null {
  if (!date) return null;
  
  // 1. Handle YYYY-MM-DD strings (from <input type="date">)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  // 2. Handle Excel serial numbers
  if (typeof date === 'number' && date < 100000) {
    // Excel serials are days since 1900-01-01
    // 25569 is the offset for Unix epoch (1970-01-01)
    // We use Math.round to avoid floating point precision issues
    const d = new Date(Math.round((date - 25569) * 86400 * 1000));
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // 3. Handle Date objects or timestamps
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return null;

  // For Date objects (usually from UI pickers or generic parsing), 
  // we use the local components to construct a UTC date. 
  // This preserves the "calendar day" the user intended.
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Formats a date to dd-mm-yyyy string using UTC components to avoid timezone shifts.
 */
export function formatDate(date: any): string {
  if (!date) return '-';
  let d: Date;
  
  if (typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else {
    return '-';
  }
  
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  
  return `${day}-${month}-${year}`;
}

export function calculateAgeing(receivedDate: any): number | null {
  if (!receivedDate) return null;
  let received: Date;
  
  if (typeof receivedDate.toDate === 'function') {
    received = receivedDate.toDate();
  } else if (receivedDate instanceof Date) {
    received = receivedDate;
  } else if (typeof receivedDate === 'string') {
    received = parseISO(receivedDate);
  } else {
    return null;
  }
  
  // Compare UTC midnights
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const receivedUTC = Date.UTC(received.getUTCFullYear(), received.getUTCMonth(), received.getUTCDate());
  
  const diffMs = todayUTC - receivedUTC;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function getAgeingColor(ageing: number | null, dispatchStatus?: string): string {
  if (ageing === null) return "";
  if (dispatchStatus === 'Closed') return "bg-slate-200 text-slate-800 border-slate-300";
  if (dispatchStatus === 'Hold') return "bg-purple-100 text-purple-800 border-purple-200";
  if (ageing <= 3) return "bg-green-100 text-green-800 border-green-200";
  if (ageing >= 4 && ageing <= 7) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (ageing > 7 && dispatchStatus === 'Dispatched') return "bg-black text-white border-black";
  return "bg-red-100 text-red-800 border-red-200";
}

export function generateUniqueId(counter: number): string {
  const index = counter - 1;
  const letterIndex = Math.floor(index / 1000);
  const number = (index % 1000) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `${letter}${number}`;
}
