'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useToast } from '@/src/context/ToastContext';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { authFetch } from '@/src/lib/api';
import {
  MapPin,
  CheckCircle2,
  CreditCard,
  Building2,
  Banknote,
  Plus,
  ArrowRight,
  ShieldCheck,
  Package,
  X,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@/src/lib/date';

interface Address {
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

interface PlacedOrderData {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  estimatedDeliveryDate: string;
  itemCount: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { cart, refreshCart } = useCart();
  const { success, error } = useToast();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING' | 'COD'>('UPI');
  const [upiId, setUpiId] = useState('user@okaxis');

  // Address modal form
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('Bengaluru');
  const [newState, setNewState] = useState('Karnataka');
  const [newPincode, setNewPincode] = useState('560038');
  const [newType, setNewType] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [isDefaultAddr, setIsDefaultAddr] = useState(true);

  // Stepper state: 1 = Address, 2 = Review & Payment
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderData | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch('/api/addresses');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAddresses(json.data);
        const def = json.data.find((a: Address) => a.isDefault);
        if (def) {
          setSelectedAddressId(def.id);
        } else if (json.data.length > 0) {
          setSelectedAddressId(json.data[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ignore = false;
    const load = async () => {
      try {
        const res = await authFetch('/api/addresses');
        const json = await res.json();
        if (!ignore && json.success && Array.isArray(json.data)) {
          setAddresses(json.data);
          const def = json.data.find((a: Address) => a.isDefault);
          if (def) {
            setSelectedAddressId(def.id);
          } else if (json.data.length > 0) {
            setSelectedAddressId(json.data[0].id);
          }
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newFullName,
          phone: newPhone,
          street: newStreet,
          city: newCity,
          state: newState,
          pincode: newPincode,
          country: 'India',
          type: newType,
          isDefault: isDefaultAddr,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to save address');

      success('New delivery address saved!');
      setIsAddressModalOpen(false);
      await fetchAddresses();
      if (json.data?.id) setSelectedAddressId(json.data.id);
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error saving address');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      error('Please select a delivery address');
      setStep(1);
      return;
    }

    setIsProcessingOrder(true);
    try {
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to place order');

      setPlacedOrder(json.data);
      await refreshCart();
      success('Order placed successfully! 🚀');
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not complete order');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 pb-20">
        <div className="bg-white rounded-3xl p-10 text-center border border-neutral-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-16 h-16 bg-[#FFD21F]/20 text-neutral-950 rounded-2xl flex items-center justify-center mx-auto font-black text-2xl">
            M
          </div>
          <h2 className="text-xl font-black text-neutral-950">Sign In to Complete Checkout</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Please log in or create an account to access saved addresses and secure 1-click checkout.
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

  // If order was placed successfully:
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-12 border border-neutral-200 shadow-xl text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Order Confirmed
            </span>
            <h1 className="text-3xl font-black text-neutral-950 mt-3 tracking-tight">
              Thank You for Your Order!
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              An invoice & tracking confirmation has been sent to <strong>{user?.email}</strong>.
            </p>
          </div>

          {/* Summary Box */}
          <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200 text-left space-y-3 text-xs">
            <div className="flex justify-between pb-2 border-b border-neutral-200 font-bold">
              <span className="text-neutral-500">Order Reference</span>
              <span className="text-neutral-950 font-mono text-sm">{placedOrder.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Total Paid</span>
              <span className="text-neutral-950 font-black text-sm">{formatINR(placedOrder.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Payment Mode</span>
              <span className="text-neutral-950 font-bold">{placedOrder.paymentMethod}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-neutral-200">
              <span className="text-neutral-500 font-bold">Estimated Delivery</span>
              <span className="text-emerald-700 font-extrabold">{placedOrder.estimatedDeliveryDate}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/account?tab=orders"
              className="w-full sm:w-auto px-8 py-3.5 bg-neutral-950 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              <span>Track Order Details</span>
            </Link>
            <Link
              href="/products"
              className="w-full sm:w-auto px-8 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs rounded-xl transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Checkout Header */}
      <div className="bg-white border-b border-neutral-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-950 text-[#FFD21F] font-black text-lg flex items-center justify-center">
                M
              </div>
              <span className="text-xl font-black text-neutral-950">Market<span className="text-[#FFD21F] bg-neutral-950 px-1 rounded-sm ml-0.5">X</span></span>
            </Link>
            <span className="text-neutral-300">|</span>
            <h1 className="text-lg font-extrabold text-neutral-900">Secure Express Checkout</h1>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Steps (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Delivery Address */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-950 text-[#FFD21F] font-black text-xs flex items-center justify-center">
                    1
                  </div>
                  <h2 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                    Delivery Address
                  </h2>
                </div>
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Address
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <MapPin className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500">No saved addresses found. Please add a shipping address.</p>
                  <button
                    onClick={() => setIsAddressModalOpen(true)}
                    className="px-5 py-2 bg-[#FFD21F] text-neutral-950 font-bold text-xs rounded-xl"
                  >
                    Add Address Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        selectedAddressId === addr.id
                          ? 'border-neutral-950 bg-neutral-50/70 shadow-sm'
                          : 'border-neutral-200 hover:border-neutral-400 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-neutral-950">{addr.fullName}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-neutral-200 text-neutral-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
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

                      <div className="pt-3 mt-3 border-t border-neutral-100 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500">
                          {selectedAddressId === addr.id ? '✓ Deliver Here' : 'Select'}
                        </span>
                        <input
                          type="radio"
                          name="selectedAddress"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="text-neutral-950 focus:ring-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Payment Method */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                <div className="w-8 h-8 rounded-full bg-neutral-950 text-[#FFD21F] font-black text-xs flex items-center justify-center">
                  2
                </div>
                <h2 className="text-base font-black text-neutral-950 uppercase tracking-wider">
                  Payment Method
                </h2>
              </div>

              <div className="space-y-3 pt-6">
                {/* UPI Option */}
                <div
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'UPI' ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#FFD21F]/20 text-neutral-950 flex items-center justify-center font-black text-xs">
                        UPI
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-950">UPI (Google Pay, PhonePe, Paytm, BHIM)</h4>
                        <p className="text-[11px] text-neutral-500">Instant 0-fee payment via any UPI app</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'UPI'}
                      onChange={() => setPaymentMethod('UPI')}
                      className="text-neutral-950"
                    />
                  </div>

                  {paymentMethod === 'UPI' && (
                    <div className="mt-4 pt-3 border-t border-neutral-200">
                      <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                        Enter UPI ID / VPA
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="e.g. 9876543210@upi"
                          className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-xl bg-white focus:outline-none"
                        />
                        <button
                          type="button"
                          className="px-4 py-2 bg-neutral-900 text-[#FFD21F] font-bold text-xs rounded-xl"
                        >
                          Verify VPA
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Option */}
                <div
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'CARD' ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-950">Credit / Debit Card</h4>
                        <p className="text-[11px] text-neutral-500">Visa, MasterCard, RuPay, Maestro</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'CARD'}
                      onChange={() => setPaymentMethod('CARD')}
                      className="text-neutral-950"
                    />
                  </div>
                </div>

                {/* Net Banking */}
                <div
                  onClick={() => setPaymentMethod('NETBANKING')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'NETBANKING' ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-950">Net Banking</h4>
                        <p className="text-[11px] text-neutral-500">All major Indian banks supported</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'NETBANKING'}
                      onChange={() => setPaymentMethod('NETBANKING')}
                      className="text-neutral-950"
                    />
                  </div>
                </div>

                {/* Cash on Delivery */}
                <div
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'COD' ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center">
                        <Banknote className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-950">Cash on Delivery (COD)</h4>
                        <p className="text-[11px] text-neutral-500">Pay cash or scan QR upon physical arrival</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="text-neutral-950"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Place Order Button (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider pb-3 border-b border-neutral-100">
                Order Summary
              </h3>

              {/* Items Preview */}
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-xs">
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
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900 truncate">{item.productName}</p>
                      <p className="text-neutral-500 text-[11px]">
                        Qty: {item.quantity} × {formatINR(item.unitPrice)}
                      </p>
                    </div>
                    <span className="font-bold text-neutral-950">{formatINR(item.itemTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs pt-3 border-t border-neutral-100">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-neutral-900">{formatINR(cart.subtotal)}</span>
                </div>
                {cart.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount Savings</span>
                    <span>- {formatINR(cart.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Express Delivery</span>
                  <span>{cart.deliveryFee === 0 ? <strong className="text-emerald-700">FREE</strong> : formatINR(cart.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-neutral-950 pt-3 border-t border-neutral-200">
                  <span>Total Amount</span>
                  <span>{formatINR(cart.grandTotal)}</span>
                </div>
              </div>

              {selectedAddress && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px]">
                  <p className="font-bold text-neutral-800">Delivering to:</p>
                  <p className="text-neutral-600 truncate">{selectedAddress.fullName}, {selectedAddress.city} ({selectedAddress.pincode})</p>
                </div>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={isProcessingOrder || !selectedAddressId || cart.items.length === 0}
                className="w-full py-4 px-6 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessingOrder ? (
                  <span className="inline-block animate-spin w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Place Order & Pay {formatINR(cart.grandTotal)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-neutral-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-950">Add New Delivery Address</h3>
              <button onClick={() => setIsAddressModalOpen(false)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Street / House / Suite</label>
                <input
                  type="text"
                  value={newStreet}
                  onChange={(e) => setNewStreet(e.target.value)}
                  placeholder="Flat 402, Green Palm Residency, Indiranagar"
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Pincode</label>
                  <input
                    type="text"
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'HOME' | 'WORK' | 'OTHER')}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl bg-white"
                  >
                    <option value="HOME">Home</option>
                    <option value="WORK">Work</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2 text-xs font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={isDefaultAddr}
                  onChange={(e) => setIsDefaultAddr(e.target.checked)}
                  className="rounded text-neutral-950"
                />
                <span>Set as default shipping address</span>
              </label>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-xs rounded-xl shadow transition-colors"
              >
                Save & Use This Address
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
