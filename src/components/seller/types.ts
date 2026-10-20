export type SellerTab = 'overview' | 'products' | 'orders' | 'earnings' | 'questions' | 'settings';

export interface SellerProfile {
  id: number;
  storeName: string;
  slug: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  isVerified: boolean;
  description: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  businessAddress: string | null;
  taxId: string | null;
  rating: number;
  reviewCount: number;
  commissionOverridePercent: number | null;
  rejectionReason: string | null;
  suspensionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  payout: {
    accountHolder: string | null;
    bankName: string | null;
    ifsc: string | null;
    accountMasked: string | null;
    upiId: string | null;
    isConfigured: boolean;
  };
}
