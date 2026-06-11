export interface PaginationInfo {
  page: number; limit: number; total: number; totalPages: number;
}

export interface UserGameEntry {
  id: string; gameType: string; currency: 'INR' | 'USD';
  totalPot: string; isWinner: boolean; netChange: string;
  startedAt: Date; completedAt: Date; durationSeconds: number;
}

export interface UserBankTransaction {
  transactionId: string; userId: string;
  type: 'deposit' | 'withdraw';
  amount: string; currency: string;
  status: 'pending' | 'completed' | 'failed';
  imageUrl: string | null; remark: string | null;
  completedAt: Date | null; createdAt: Date;
  bankAccount: {
    bankId: string; accountNumber: string; bankName: string;
    ifscCode: string; accountHolderName: string;
    isDefault: boolean; status: 'active' | 'blocked' | 'inactive';
  } | null;
}

export interface DashboardData {
  users: { total: number; active: number; newToday: number; newThisWeek: number; newThisMonth: number };
  bankTransactions: { pendingDeposits: number; pendingWithdrawals: number; completedToday: number };
  games: { totalArchived: number; activeDesksNow: number; totalActiveDesks: number };
  recentUsers: { userId: string; username: string; email: string; status: string; createdAt: Date }[];
  leaderboard: { userId: string; username: string; totalWinnings: string }[];
}
