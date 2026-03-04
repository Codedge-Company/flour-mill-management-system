// core/utils/expenditure-icon.util.ts

/**
 * Returns an SVG path string (viewBox 0 0 24 24) and a colour
 * for a given expenditure description using fuzzy keyword matching.
 */

export interface ExpIcon {
    paths: string[];   // one or more <path d="..."> values
    color: string;
    label: string;     // matched category name
}

// ── Levenshtein distance (handles typos) ─────────────────────────
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

// ── Category definitions ──────────────────────────────────────────
interface Category {
    label: string;
    color: string;
    keywords: string[];
    paths: string[];
}

const CATEGORIES: Category[] = [
    {
        label: 'Food & Dining',
        color: '#ef4444',
        keywords: ['food', 'dining', 'restaurant', 'meal', 'lunch', 'dinner', 'breakfast',
            'eat', 'snack', 'cafe', 'coffee', 'tea', 'drink', 'beverages', 'drinks',
            'canteen', 'hotel', 'bakery', 'pizza', 'rice', 'bread', 'grocery', 'groceries'],
        paths: [
            'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2',
            'M7 2v20',
            'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
        ],
    },
    {
        label: 'Transport',
        color: '#f97316',
        keywords: ['transport', 'transportation', 'bus', 'train', 'travel', 'fuel', 'petrol',
            'diesel', 'vehicle', 'car', 'cab', 'taxi', 'uber', 'tuk', 'bike', 'cycle',
            'commute', 'fare', 'ticket', 'toll', 'parking', 'auto', 'ride', 'trip'],
        paths: [
            'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3',
            'M9 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
            'M17 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
            'M13 7h8l2 4-2 1',
            'M7 12H2',
        ],
    },
    {
        label: 'Housing & Rent',
        color: '#3b82f6',
        keywords: ['rent', 'house', 'housing', 'home', 'apartment', 'flat', 'building',
            'property', 'lease', 'mortgage', 'maintenance', 'repair', 'water',
            'electricity', 'electric', 'bill', 'utility', 'utilities'],
        paths: [
            'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
            'M9 22V12h6v10',
        ],
    },
    {
        label: 'Health & Medical',
        color: '#ec4899',
        keywords: ['health', 'medical', 'medicine', 'doctor', 'hospital', 'clinic', 'pharmacy',
            'drug', 'tablet', 'injection', 'dental', 'dentist', 'surgery', 'checkup',
            'lab', 'test', 'xray', 'scan', 'ambulance', 'nurse', 'treatment', 'therapy'],
        paths: [
            'M22 12h-4l-3 9L9 3l-3 9H2',
        ],
    },
    {
        label: 'Entertainment',
        color: '#8b5cf6',
        keywords: ['entertainment', 'movie', 'cinema', 'film', 'game', 'games', 'sport', 'sports',
            'gym', 'fitness', 'club', 'party', 'event', 'concert', 'show', 'fun',
            'recreation', 'leisure', 'hobby', 'subscription', 'netflix', 'youtube'],
        paths: [
            'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
            'M10 8l6 4-6 4V8z',
        ],
    },
    {
        label: 'Shopping',
        color: '#f59e0b',
        keywords: ['shopping', 'shop', 'clothes', 'clothing', 'dress', 'shoes', 'bag', 'fashion',
            'market', 'purchase', 'buy', 'buying', 'store', 'mall', 'supermarket',
            'fabric', 'material', 'stationery', 'tools', 'equipment', 'supplies'],
        paths: [
            'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z',
            'M3 6h18',
            'M16 10a4 4 0 0 1-8 0',
        ],
    },
    {
        label: 'Communication',
        color: '#06b6d4',
        keywords: ['phone', 'mobile', 'internet', 'wifi', 'broadband', 'data', 'sim', 'call',
            'communication', 'network', 'telephone', 'recharge', 'top up', 'topup',
            'subscription', 'plan', 'postpaid', 'prepaid'],
        paths: [
            'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z',
        ],
    },
    {
        label: 'Education',
        color: '#10b981',
        keywords: ['education', 'school', 'college', 'university', 'tuition', 'course',
            'training', 'book', 'books', 'exam', 'fee', 'study', 'studies', 'class',
            'learning', 'workshop', 'seminar', 'degree', 'certification'],
        paths: [
            'M22 10v6M2 10l10-5 10 5-10 5z',
            'M6 12v5c3 3 9 3 12 0v-5',
        ],
    },
    {
        label: 'Salary & Staff',
        color: '#84cc16',
        keywords: ['salary', 'wage', 'wages', 'staff', 'employee', 'workers', 'labour', 'labor',
            'payroll', 'payment', 'bonus', 'allowance', 'overtime', 'hr'],
        paths: [
            'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
            'M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
            'M23 21v-2a4 4 0 0 0-3-3.87',
            'M16 3.13a4 4 0 0 1 0 7.75',
        ],
    },
    {
        label: 'Maintenance',
        color: '#64748b',
        keywords: ['maintenance', 'repair', 'fix', 'service', 'cleaning', 'clean', 'pest',
            'plumber', 'plumbing', 'electric wiring', 'carpenter', 'painting',
            'renovation', 'construction', 'material', 'spare', 'parts'],
        paths: [
            'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
        ],
    },
    {
        label: 'Finance & Banking',
        color: '#0ea5e9',
        keywords: ['bank', 'banking', 'loan', 'interest', 'insurance', 'investment', 'tax',
            'fine', 'penalty', 'fee', 'charge', 'payment', 'transfer', 'emi',
            'installment', 'credit', 'debit', 'finance'],
        paths: [
            'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
        ],
    },
    {
        label: 'Miscellaneous',
        color: '#a855f7',
        keywords: ['misc', 'miscellaneous', 'other', 'general', 'various', 'extra', 'additional'],
        paths: [
            'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        ],
    },
];

// ── Default icon (generic expense) ────────────────────────────────
const DEFAULT_ICON: ExpIcon = {
    paths: ['M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
    color: '#6b7280',
    label: 'Expense',
};

// ── Main matching function ─────────────────────────────────────────
export function getExpenditureIcon(description: string): ExpIcon {
    if (!description?.trim()) return DEFAULT_ICON;

    const desc = description.toLowerCase().trim();
    const words = desc.split(/[\s,._\-/]+/).filter(w => w.length > 1);

    let bestCategory: Category | null = null;
    let bestScore = Infinity;

    for (const cat of CATEGORIES) {
        for (const keyword of cat.keywords) {
            // 1. Exact substring match → highest priority
            if (desc.includes(keyword) || keyword.includes(desc)) {
                return { paths: cat.paths, color: cat.color, label: cat.label };
            }

            // 2. Word-level exact match
            for (const word of words) {
                if (word === keyword) {
                    return { paths: cat.paths, color: cat.color, label: cat.label };
                }
            }

            // 3. Fuzzy match — allow 1 typo per 4 chars (scaled tolerance)
            for (const word of words) {
                if (word.length < 3) continue;
                const maxDist = Math.floor(word.length / 4) + 1;   // e.g. 4-char word → 2 tolerance
                const dist = levenshtein(word, keyword);
                if (dist <= maxDist && dist < bestScore) {
                    bestScore = dist;
                    bestCategory = cat;
                }
            }
        }
    }

    if (bestCategory) {
        return { paths: bestCategory.paths, color: bestCategory.color, label: bestCategory.label };
    }

    return DEFAULT_ICON;
}