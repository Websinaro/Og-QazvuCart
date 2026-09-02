'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { authFetch } from '@/src/lib/api';
import {
  User,
  Package,
  Heart,
  MapPin,
  Sparkles,
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  Star,
  X,
  Lock,
  ArrowRight,
  ShoppingBag,
  Shield,
  LayoutDashboard,
} from 'lucide-react';
import { formatINR } from '@/src/lib/date';

interface OrderItem {
  id: number;
  productId: number;
  variantId?: number | null;
  productName: string;
  productImage: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
}

interface OrderRecord {
  id: number;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  estimatedDeliveryDate: string;
  createdAt: string;
  items: OrderItem[];
  shippingAddress?: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  timeline?: {
    step: string;
    title: string;
    date: string;
    completed: boolean;
    current: boolean;
  }[];
}

interface AddressRecord {
  id: number;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  type: 'HOME' | 'WORK' | 'OTHER';
}

interface PendingReviewItem {
  productId: number;
  productName: string;
  productSlug: string;
  productImage: string;
  brand: string;
  orderNumber: string;
  orderDate: string;
}

interface UserReviewRecord {
  id: number;
  productId: number;
  productName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
}

function AccountDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'orders';

  const { user, stats, isAuthenticated, isLoading: isAuthLoading, updateProfile, changePassword } = useAuth();
  const { items: wishlistItems, moveToCart, toggleWishlist } = useWishlist();
  const { success, error } = useToast();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addrFullName, setAddrFullName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('Bengaluru');
  const [addrState, setAddrState] = useState('Karnataka');
  const [addrPincode, setAddrPincode] = useState('560038');
  const [addrType, setAddrType] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [addrIsDefault, setAddrIsDefault] = useState(true);

  // Reviews State
  const [pendingReviews, setPendingReviews] = useState<PendingReviewItem[]>([]);
  const [userReviews, setUserReviews] = useState<UserReviewRecord[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewProduct, setSelectedReviewProduct] = useState<PendingReviewItem | null>(null);
  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');

  // Settings State
  const [profileName, setProfileName] = useState(user?.username || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsOrdersLoading(true);
    try {
      const url = orderStatusFilter === 'ALL' ? '/api/orders' : `/api/orders?status=${orderStatusFilter}`;
      const res = await authFetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOrders(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIsOrdersLoading(false);
    }
  }, [isAuthenticated, orderStatusFilter]);

  // Fetch Addresses
  const fetchAddresses = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch('/api/addresses');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAddresses(json.data);
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  // Fetch Reviews
  const fetchReviews = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [pendRes, userRes] = await Promise.all([
        authFetch('/api/reviews/pending').then((r) => r.json()),
        authFetch('/api/reviews/user').then((r) => r.json()),
      ]);
      if (pendRes.success && Array.isArray(pendRes.data)) setPendingReviews(pendRes.data);
      if (userRes.success && Array.isArray(userRes.data)) setUserReviews(userRes.data);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ignore = false;
    const load = async () => {
      setIsOrdersLoading(true);
      try {
        const url = orderStatusFilter === 'ALL' ? '/api/orders' : `/api/orders?status=${orderStatusFilter}`;
        const [ordersRes, addrRes, pendRes, userRevRes] = await Promise.all([
          authFetch(url).then((r) => r.json()),
          authFetch('/api/addresses').then((r) => r.json()),
          authFetch('/api/reviews/pending').then((r) => r.json()),
          authFetch('/api/reviews/user').then((r) => r.json()),
        ]);
        if (!ignore) {
          if (ordersRes.success && Array.isArray(ordersRes.data)) setOrders(ordersRes.data);
          if (addrRes.success && Array.isArray(addrRes.data)) setAddresses(addrRes.data);
          if (pendRes.success && Array.isArray(pendRes.data)) setPendingReviews(pendRes.data);
          if (userRevRes.success && Array.isArray(userRevRes.data)) setUserReviews(userRevRes.data);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) setIsOrdersLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, orderStatusFilter]);

  const handleTabChange = (tabKey: string) => {
    router.push(`/account?tab=${tabKey}`);
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      const res = await authFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to cancel order');
      success('Order cancelled successfully');
      fetchOrders();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error cancelling order');
    }
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: addrFullName,
          phone: addrPhone,
          street: addrStreet,
          city: addrCity,
          state: addrState,
          pincode: addrPincode,
          country: 'India',
          type: addrType,
          isDefault: addrIsDefault,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to save address');
      success('Address saved successfully');
      setIsAddressModalOpen(false);
      fetchAddresses();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not save address');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      const res = await authFetch(`/api/addresses/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to delete');
      success('Address deleted');
      fetchAddresses();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not delete address');
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    try {
      const res = await authFetch(`/api/addresses/${id}/set-default`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to update default');
      success('Default delivery address updated');
      fetchAddresses();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error updating address');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewProduct) return;
    try {
      const res = await authFetch(`/api/products/${selectedReviewProduct.productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: revRating,
          title: revTitle,
          comment: revComment,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to submit review');
      success('Review posted successfully!');
      setIsReviewModalOpen(false);
      fetchReviews();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Failed to submit review');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        username: profileName,
        email: profileEmail,
        phone: profilePhone,
      });
      success('Profile details updated');
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not update profile');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      error('New passwords do not match');
      return;
    }
    try {
      await changePassword(currentPwd, newPwd, confirmPwd);
      success('Password changed successfully');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Failed to change password');
    }
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 pb-20">
        <div className="bg-white rounded-3xl p-10 text-center border border-neutral-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-16 h-16 bg-[#FFD21F]/20 text-neutral-950 rounded-2xl flex items-center justify-center mx-auto font-black text-2xl">
            M
          </div>
          <h2 className="text-xl font-black text-neutral-950">Sign In to Your Account</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Please log in to view your orders, track shipments, manage saved addresses, and manage reviews.
          </p>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full py-3.5 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-extrabold text-xs rounded-xl shadow-md transition-all"
          >
            Sign In / Register
          </button>
        </div>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Delivered</span>;
      case 'SHIPPED':
        return <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Shipped</span>;
      case 'PROCESSING':
      case 'CONFIRMED':
        return <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">{status}</span>;
      case 'CANCELLED':
        return <span className="bg-red-100 text-red-900 border border-red-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Cancelled</span>;
      default:
        return <span className="bg-neutral-200 text-neutral-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Account Hero Banner */}
      <div className="bg-white border-b border-neutral-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-950 text-[#FFD21F] font-black text-2xl flex items-center justify-center shadow-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-neutral-950 tracking-tight">{user?.username}</h1>
                  {user?.role === 'ADMIN' ? (
                    <span className="bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <Shield className="w-3 h-3 text-amber-700" /> Admin
                    </span>
                  ) : (
                    <span className="bg-[#FFD21F] text-neutral-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                      Verified Customer
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">
                  {user?.email} • {user?.phone || 'No phone set'}
                </p>
              </div>
            </div>

            {/* Metric Pills & Admin CTA */}
            <div className="flex items-center gap-3">
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 py-2 px-3.5 bg-neutral-950 hover:bg-neutral-800 text-[#FFD21F] border border-amber-400/40 rounded-2xl font-extrabold text-xs shadow-sm transition-all group"
                  title="Open Admin Management Panel"
                >
                  <Shield className="w-4 h-4 text-[#FFD21F] group-hover:rotate-12 transition-transform" />
                  <span>Admin Panel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2 text-center">
                <span className="text-xs font-bold text-neutral-400 uppercase">Orders</span>
                <p className="text-base font-black text-neutral-950">{stats?.orders || orders.length}</p>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2 text-center">
                <span className="text-xs font-bold text-neutral-400 uppercase">Wishlist</span>
                <p className="text-base font-black text-neutral-950">{wishlistItems.length}</p>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2 text-center">
                <span className="text-xs font-bold text-neutral-400 uppercase">Addresses</span>
                <p className="text-base font-black text-neutral-950">{addresses.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Tab Navigator (3 cols) */}
          <aside className="lg:col-span-3 space-y-2">
            <div className="bg-white rounded-2xl border border-neutral-200 p-2 shadow-xs space-y-1 text-xs font-bold">
              {/* Admin Panel Quick Link for Admin Role */}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-100/70 hover:bg-amber-200/80 text-amber-950 border border-amber-300 font-extrabold transition-colors shadow-xs mb-1"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-amber-800" />
                    <span>Admin Panel</span>
                  </div>
                  <span className="text-[10px] bg-amber-300/80 text-amber-950 px-1.5 py-0.5 rounded font-black uppercase">
                    Admin
                  </span>
                </Link>
              )}

              <button
                onClick={() => handleTabChange('orders')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors ${
                  activeTab === 'orders' ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4" />
                  <span>My Orders</span>
                </div>
                <span className="text-[11px] opacity-70">({orders.length})</span>
              </button>

              <button
                onClick={() => handleTabChange('wishlist')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors ${
                  activeTab === 'wishlist' ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4" />
                  <span>My Wishlist</span>
                </div>
                <span className="text-[11px] opacity-70">({wishlistItems.length})</span>
              </button>

              <button
                onClick={() => handleTabChange('addresses')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors ${
                  activeTab === 'addresses' ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4" />
                  <span>Saved Addresses</span>
                </div>
                <span className="text-[11px] opacity-70">({addresses.length})</span>
              </button>

              <button
                onClick={() => handleTabChange('reviews')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors ${
                  activeTab === 'reviews' ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Reviews & Ratings</span>
                </div>
                <span className="text-[11px] opacity-70">({pendingReviews.length})</span>
              </button>

              <button
                onClick={() => handleTabChange('settings')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors ${
                  activeTab === 'settings' ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4" />
                  <span>Account Settings</span>
                </div>
              </button>
            </div>
          </aside>

          {/* Right Tab Content Area (9 cols) */}
          <main className="lg:col-span-9">
            {/* Tab 1: Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {/* Filter bar */}
                <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
                  <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                    Order History
                  </h3>
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
                    {['ALL', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setOrderStatusFilter(st)}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          orderStatusFilter === st
                            ? 'bg-neutral-950 text-[#FFD21F]'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {isOrdersLoading ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-neutral-900 border-t-[#FFD21F] rounded-full animate-spin mx-auto" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-neutral-200 shadow-xs space-y-3">
                    <Package className="w-12 h-12 text-neutral-300 mx-auto" />
                    <h4 className="text-base font-bold text-neutral-950">No orders found</h4>
                    <p className="text-xs text-neutral-500">You haven&apos;t placed any orders matching this filter yet.</p>
                    <Link
                      href="/products"
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#FFD21F] text-neutral-950 font-bold text-xs rounded-xl shadow-xs"
                    >
                      Start Shopping Deals
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden divide-y divide-neutral-100"
                      >
                        {/* Order Header */}
                        <div className="p-5 bg-neutral-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-[10px] text-neutral-400 font-bold uppercase">Order No</span>
                              <p className="font-mono font-bold text-neutral-900">{order.orderNumber}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-400 font-bold uppercase">Placed On</span>
                              <p className="font-semibold text-neutral-800">{new Date(order.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-400 font-bold uppercase">Total Amount</span>
                              <p className="font-black text-neutral-950">{formatINR(order.totalAmount)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {getStatusBadge(order.status)}
                            {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                              >
                                Cancel Order
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items in this order */}
                        <div className="p-5 space-y-3">
                          {order.items?.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="relative w-14 h-14 rounded-xl bg-neutral-50 border border-neutral-200 shrink-0 overflow-hidden">
                                  <Image
                                    src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                                    alt={item.productName}
                                    fill
                                    sizes="56px"
                                    className="object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-neutral-900">{item.productName}</p>
                                  {item.variantName && (
                                    <p className="text-[11px] text-neutral-500">Option: {item.variantName}</p>
                                  )}
                                  <p className="text-[11px] text-neutral-500">
                                    Qty: {item.quantity} × {formatINR(item.unitPrice)}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-neutral-950">{formatINR(item.itemTotal)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Interactive Tracking Stepper */}
                        {order.timeline && order.timeline.length > 0 && (
                          <div className="p-5 bg-neutral-50/40">
                            <h5 className="text-[11px] font-black text-neutral-500 uppercase tracking-wider mb-3">
                              Live Delivery Tracking
                            </h5>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                              {order.timeline.map((stepItem, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
                                    stepItem.completed
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                                      : stepItem.current
                                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                                      : 'bg-white border-neutral-200 text-neutral-400'
                                  }`}
                                >
                                  {stepItem.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1" />
                                  ) : (
                                    <Clock className="w-4 h-4 mb-1" />
                                  )}
                                  <span className="text-[10px] leading-tight">{stepItem.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Wishlist */}
            {activeTab === 'wishlist' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                      My Saved Wishlist
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {wishlistItems.length} products saved for future purchase
                    </p>
                  </div>
                </div>

                {wishlistItems.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-neutral-200 shadow-xs space-y-3">
                    <Heart className="w-12 h-12 text-neutral-300 mx-auto" />
                    <h4 className="text-base font-bold text-neutral-950">Your Wishlist is Empty</h4>
                    <p className="text-xs text-neutral-500">Explore products and click the heart icon to save them here.</p>
                    <Link
                      href="/products"
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#FFD21F] text-neutral-950 font-bold text-xs rounded-xl shadow-xs"
                    >
                      Explore Products
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
                    {wishlistItems.map((item) => (
                      <div
                        key={item.productId}
                        className="bg-white rounded-2xl border border-neutral-200 p-3 sm:p-4 shadow-xs flex flex-col justify-between h-full"
                      >
                        <div>
                          <div className="relative aspect-square rounded-xl bg-neutral-50 overflow-hidden mb-3">
                            <Image
                              src={item.primaryImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                              alt={item.name}
                              fill
                              sizes="(max-width: 640px) 50vw, 25vw"
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              onClick={() => toggleWishlist(item.productId)}
                              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-red-600 shadow-xs hover:bg-white"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase truncate block">{item.brand}</span>
                          <h4 className="text-xs font-bold text-neutral-900 line-clamp-2 min-h-[2rem]">{item.name}</h4>
                          <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-sm font-black text-neutral-950">{formatINR(item.discountPrice)}</span>
                            {item.basePrice > item.discountPrice && (
                              <span className="text-[11px] text-neutral-400 line-through">{formatINR(item.basePrice)}</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => moveToCart(item.productId)}
                          className="w-full mt-3 sm:mt-4 py-2 sm:py-2.5 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Move to Cart</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Addresses */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                      Saved Shipping Addresses
                    </h3>
                    <p className="text-xs text-neutral-500">Manage delivery locations for express checkout</p>
                  </div>
                  <button
                    onClick={() => setIsAddressModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-950 text-[#FFD21F] font-bold text-xs rounded-xl shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Address
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-neutral-950">{addr.fullName}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-neutral-100 text-neutral-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              {addr.type}
                            </span>
                            {addr.isDefault && (
                              <span className="bg-[#FFD21F] text-neutral-950 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                                DEFAULT
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          {addr.street}, {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                        <p className="text-xs font-medium text-neutral-700 mt-2">
                          Phone: <strong>{addr.phone}</strong>
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between text-xs">
                        {!addr.isDefault ? (
                          <button
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            className="font-bold text-neutral-800 hover:text-black underline"
                          >
                            Set as Default
                          </button>
                        ) : (
                          <span className="font-bold text-emerald-700">✓ Default Address</span>
                        )}
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Reviews & Ratings */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Pending Reviews */}
                <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
                  <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                    Eligible Purchases to Review ({pendingReviews.length})
                  </h3>

                  {pendingReviews.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      You have reviewed all your delivered purchases! Keep shopping to share more feedback.
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {pendingReviews.map((item) => (
                        <div key={item.productId} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-200 shrink-0 overflow-hidden">
                              <Image
                                src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                                alt={item.productName}
                                fill
                                sizes="48px"
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-neutral-900">{item.productName}</h4>
                              <p className="text-[11px] text-neutral-400">Delivered under order {item.orderNumber}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedReviewProduct(item);
                              setIsReviewModalOpen(true);
                            }}
                            className="px-4 py-2 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-xs rounded-xl shadow-xs shrink-0"
                          >
                            Rate & Review
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submitted User Reviews */}
                <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
                  <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                    Your Past Reviews ({userReviews.length})
                  </h3>

                  {userReviews.length === 0 ? (
                    <p className="text-xs text-neutral-500">No past reviews submitted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {userReviews.map((rev) => (
                        <div key={rev.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-900">{rev.productName}</span>
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                                />
                              ))}
                            </div>
                          </div>
                          {rev.title && <h5 className="text-xs font-bold text-neutral-950">{rev.title}</h5>}
                          <p className="text-xs text-neutral-700">{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 5: Settings */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Profile Edit */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
                  <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                    Personal Information
                  </h3>
                  <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Username</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow-xs"
                    >
                      Save Profile Changes
                    </button>
                  </form>
                </div>

                {/* Password Change */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
                  <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                    Security & Password
                  </h3>
                  <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPwd}
                        onChange={(e) => setCurrentPwd(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">New Password</label>
                        <input
                          type="password"
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          required
                          className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Confirm New</label>
                        <input
                          type="password"
                          value={confirmPwd}
                          onChange={(e) => setConfirmPwd(e.target.value)}
                          required
                          className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow-xs"
                    >
                      Update Password
                    </button>
                  </form>
                </div>

                {/* Administrator Panel Portal Card */}
                {user?.role === 'ADMIN' && (
                  <div className="bg-gradient-to-r from-neutral-950 to-neutral-900 text-white p-6 sm:p-8 rounded-3xl border border-amber-400/30 shadow-lg space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFD21F] text-neutral-950 flex items-center justify-center font-black shadow-xs">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                          Administrator Management Console
                          <span className="bg-[#FFD21F] text-neutral-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                            Root Access
                          </span>
                        </h3>
                        <p className="text-xs text-neutral-400">
                          Manage product catalog, adjust live stock & prices, update order fulfillment statuses, and manage user roles.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <Link
                        href="/admin"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFD21F] hover:bg-[#ffc800] text-neutral-950 font-black text-xs rounded-xl transition-all shadow-sm"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Launch Admin Panel</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-950">Add Shipping Address</h3>
              <button onClick={() => setIsAddressModalOpen(false)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form onSubmit={handleCreateAddress} className="space-y-3 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={addrFullName}
                  onChange={(e) => setAddrFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Street Address</label>
                <input
                  type="text"
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  required
                  className="px-3 py-2 text-xs border rounded-xl"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  required
                  className="px-3 py-2 text-xs border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Pincode"
                  value={addrPincode}
                  onChange={(e) => setAddrPincode(e.target.value)}
                  required
                  className="px-3 py-2 text-xs border rounded-xl"
                />
                <select
                  value={addrType}
                  onChange={(e) => setAddrType(e.target.value as 'HOME' | 'WORK' | 'OTHER')}
                  className="px-3 py-2 text-xs border rounded-xl bg-white"
                >
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full mt-2 py-3 bg-[#FFD21F] text-neutral-950 font-bold text-xs rounded-xl shadow"
              >
                Save Delivery Address
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {isReviewModalOpen && selectedReviewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-950">Review {selectedReviewProduct.productName}</h3>
              <button onClick={() => setIsReviewModalOpen(false)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Rating</label>
                <div className="flex items-center gap-1.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRevRating(s)}
                      className="p-1"
                    >
                      <Star className={`w-6 h-6 ${s <= revRating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Headline</label>
                <input
                  type="text"
                  value={revTitle}
                  onChange={(e) => setRevTitle(e.target.value)}
                  placeholder="Great product & fast shipping!"
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Detailed Review</label>
                <textarea
                  value={revComment}
                  onChange={(e) => setRevComment(e.target.value)}
                  rows={3}
                  required
                  placeholder="Share details of your experience..."
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#FFD21F] text-neutral-950 font-bold text-xs rounded-xl shadow"
              >
                Submit Verified Buyer Review
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 p-12 text-center text-sm font-bold">Loading customer dashboard...</div>}>
      <AccountDashboardContent />
    </Suspense>
  );
}
