'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { authFetch } from '@/src/lib/api';
import { formatINR } from '@/src/lib/date';
import { uploadImageToCloudinary, CloudinaryConfigError } from '@/src/lib/cloudinary';
import {
  Shield,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  DollarSign,
  Tag,
  ExternalLink,
  ChevronRight,
  Filter,
  Truck,
  Clock,
  Edit2,
  X,
  Sparkles,
  ImagePlus,
  Loader2,
} from 'lucide-react';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  activeSellers: number;
  pendingOrdersCount: number;
  deliveredOrdersCount: number;
  lowStockProductsCount: number;
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  salesByCategory: Array<{
    categoryName: string;
    productCount: number;
  }>;
}

interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  brand: string;
  categoryName: string;
  sellerStoreName: string;
  basePrice: number;
  discountPrice: number;
  stock: number;
  status: string;
  isFeatured: boolean;
  isDeal: boolean;
  rating: number;
  reviewCount: number;
  primaryImage: string;
  createdAt: string;
}

interface AdminOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  estimatedDeliveryDate: string;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    productImage: string;
    quantity: number;
    unitPrice: number;
    itemTotal: number;
  }>;
}

interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
  imageUrl: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  isVerified: boolean;
  avatarUrl: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'users' | 'categories'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Products
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesStatus, setCategoriesStatus] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCategoryId, setNewProdCategoryId] = useState<number | ''>('');
  // Numeric fields are kept as raw strings while the user is editing so
  // backspacing/clearing/typing works normally (Number(e.target.value) on
  // every keystroke breaks that). They're parsed and validated only on
  // submit — see handleCreateProduct.
  const [newProdBasePrice, setNewProdBasePrice] = useState('2999');
  const [newProdDiscountPrice, setNewProdDiscountPrice] = useState('1999');
  const [newProdStock, setNewProdStock] = useState('50');
  const [newProdDescription, setNewProdDescription] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdImageUploading, setNewProdImageUploading] = useState(false);
  const [newProdImageUploadProgress, setNewProdImageUploadProgress] = useState(0);
  const [newProdIsDeal, setNewProdIsDeal] = useState(false);
  const [newProdIsFeatured, setNewProdIsFeatured] = useState(false);

  // Inline editing product
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('0');
  const [editStock, setEditStock] = useState('0');

  // Orders
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Category management (full admin CRUD — separate from the `categories`
  // dropdown-options list above, which only contains active categories).
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [adminCategoriesStatus, setAdminCategoriesStatus] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Grid3x3');
  const [catImageUrl, setCatImageUrl] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catDisplayOrder, setCatDisplayOrder] = useState('0');

  const loadAdminCategories = useCallback(async () => {
    setAdminCategoriesStatus('loading');
    try {
      const res = await authFetch('/api/admin/categories');
      const json = await res.json();
      if (json.success) {
        setAdminCategories(json.data);
        setAdminCategoriesStatus(json.data.length === 0 ? 'empty' : 'ready');
      } else {
        setAdminCategoriesStatus('error');
      }
    } catch {
      setAdminCategoriesStatus('error');
    }
  // authFetch is a stable helper from context, not a per-render value;
  // matches the existing convention used elsewhere in this file (see
  // loadDashboardData below, which similarly omits it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetCategoryForm = () => {
    setCatName('');
    setCatIcon('Grid3x3');
    setCatImageUrl('');
    setCatDescription('');
    setCatDisplayOrder('0');
    setEditingCategoryId(null);
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) {
      error('Category name is required');
      return;
    }
    const displayOrder = Number(catDisplayOrder);
    if (catDisplayOrder.trim() !== '' && (Number.isNaN(displayOrder) || !Number.isInteger(displayOrder))) {
      error('Display order must be a whole number');
      return;
    }
    try {
      const res = await authFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: catName,
          icon: catIcon || 'Grid3x3',
          imageUrl: catImageUrl,
          description: catDescription,
          displayOrder: Number.isNaN(displayOrder) ? 0 : displayOrder,
        }),
      });
      const json = await res.json();
      if (json.success) {
        success('Category created');
        setIsAddCategoryOpen(false);
        resetCategoryForm();
        loadAdminCategories();
        loadDashboardData();
      } else {
        error(json.error?.message || 'Failed to create category');
      }
    } catch {
      error('Failed to create category');
    }
  };

  const handleUpdateCategory = async (categoryId: number, patch: Record<string, unknown>) => {
    try {
      const res = await authFetch(`/api/admin/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (json.success) {
        success('Category updated');
        setEditingCategoryId(null);
        loadAdminCategories();
        loadDashboardData();
      } else {
        error(json.error?.message || 'Failed to update category');
      }
    } catch {
      error('Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: number, name: string) => {
    if (!window.confirm(`Delete or archive "${name}"? If products use this category it will be archived (hidden) instead of deleted.`)) {
      return;
    }
    try {
      const res = await authFetch(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        success(json.data.deleted ? 'Category deleted' : 'Category archived (still used by existing products)');
        loadAdminCategories();
        loadDashboardData();
      } else {
        error(json.error?.message || 'Failed to delete category');
      }
    } catch {
      error('Failed to delete category');
    }
  };

  useEffect(() => {
    if (activeTab === 'categories' && isAuthenticated && user?.role === 'ADMIN') {
      // Same intended pattern as the loadDashboardData effect above: fetching
      // on tab-switch and setting state asynchronously inside
      // loadAdminCategories' own try/catch, not a synchronous render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAdminCategories();
    }
  }, [activeTab, isAuthenticated, user?.role, loadAdminCategories]);


  // Load Data
  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'ADMIN') return;
    setIsLoading(true);
    try {
      const [analyticsRes, productsRes, ordersRes, usersRes, categoriesRes] = await Promise.all([
        authFetch('/api/admin/analytics').then((r) => r.json()),
        authFetch('/api/admin/products').then((r) => r.json()),
        authFetch('/api/admin/orders').then((r) => r.json()),
        authFetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
      ]);

      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (productsRes.success) setProducts(productsRes.data);
      if (ordersRes.success) setOrders(ordersRes.data);
      if (usersRes.success) setUsers(usersRes.data);
      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
        setCategoriesStatus(categoriesRes.data.length === 0 ? 'empty' : 'ready');
        setNewProdCategoryId((prev) => (prev === '' && categoriesRes.data[0] ? categoriesRes.data[0].id : prev));
      } else {
        // The category request reached the server but it reported failure
        // (e.g. DB error) — this is NOT the same as "no categories exist".
        setCategoriesStatus('error');
      }
    } catch {
      error('Failed to load admin data');
      setCategoriesStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.role, error]);

  const retryLoadCategories = useCallback(async () => {
    setCategoriesStatus('loading');
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success) {
        setCategories(json.data);
        setCategoriesStatus(json.data.length === 0 ? 'empty' : 'ready');
        setNewProdCategoryId((prev) => (prev === '' && json.data[0] ? json.data[0].id : prev));
      } else {
        setCategoriesStatus('error');
      }
    } catch {
      setCategoriesStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && user?.role === 'ADMIN') {
      // Fetching on mount and setting state asynchronously (inside
      // loadDashboardData's own try/finally) is the intended pattern here;
      // this isn't a synchronous setState-in-render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDashboardData();
    }
  }, [isAuthLoading, isAuthenticated, user?.role, loadDashboardData]);

  const handleProductImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    setNewProdImageUploading(true);
    setNewProdImageUploadProgress(0);
    try {
      const result = await uploadImageToCloudinary(file, {
        folder: 'qazvucart/products',
        onProgress: setNewProdImageUploadProgress,
      });
      setNewProdImage(result.url);
      success('Image uploaded');
    } catch (err) {
      const message =
        err instanceof CloudinaryConfigError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Image upload failed';
      error(message);
    } finally {
      setNewProdImageUploading(false);
      setNewProdImageUploadProgress(0);
    }
  };

  // Product Actions
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProdCategoryId === '') {
      error('Please select a category');
      return;
    }

    const basePrice = Number(newProdBasePrice);
    const discountPrice = Number(newProdDiscountPrice);
    const stock = Number(newProdStock);

    if (newProdBasePrice.trim() === '' || Number.isNaN(basePrice) || basePrice <= 0) {
      error('Original price must be a number greater than 0');
      return;
    }
    if (newProdDiscountPrice.trim() === '' || Number.isNaN(discountPrice) || discountPrice <= 0) {
      error('Deal price must be a number greater than 0');
      return;
    }
    if (discountPrice > basePrice) {
      error('Deal price cannot be higher than the original price');
      return;
    }
    if (newProdStock.trim() === '' || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      error('Stock must be a whole number, 0 or greater');
      return;
    }

    try {
      const res = await authFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProdName,
          brand: newProdBrand,
          categoryId: Number(newProdCategoryId),
          basePrice,
          discountPrice,
          stock,
          description: newProdDescription,
          imageUrl: newProdImage || undefined,
          isDeal: newProdIsDeal,
          isFeatured: newProdIsFeatured,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to create product');

      success('New product published to marketplace catalog!');
      setIsAddProductOpen(false);
      // Reset
      setNewProdName('');
      setNewProdBrand('');
      setNewProdDescription('');
      setNewProdImage('');
      loadDashboardData();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error creating product');
    }
  };

  const handleSaveProductEdit = async (productId: number) => {
    const parsedPrice = Number(editPrice);
    const parsedStock = Number(editStock);
    if (editPrice.trim() === '' || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      error('Price must be a number greater than 0');
      return;
    }
    if (editStock.trim() === '' || Number.isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
      error('Stock must be a whole number, 0 or greater');
      return;
    }
    try {
      const res = await authFetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountPrice: parsedPrice,
          stock: parsedStock,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to update');
      success('Product inventory updated');
      setEditingProductId(null);
      loadDashboardData();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error updating product');
    }
  };

  const handleToggleProductStatus = async (product: AdminProduct) => {
    const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await authFetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to toggle status');
      success(`Product marked as ${newStatus}`);
      loadDashboardData();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error updating product status');
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to update order');
      success(`Order updated to ${newStatus}`);
      loadDashboardData();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error updating order');
    }
  };

  // User Actions
  const handleChangeUserRole = async (userId: number, role: 'CUSTOMER' | 'SELLER' | 'ADMIN') => {
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to update role');
      success(`User role changed to ${role}`);
      loadDashboardData();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Error changing role');
    }
  };

  // Access Denied State
  if (!isAuthLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 bg-neutral-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-neutral-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-950">Administrative Access Required</h1>
            <p className="text-sm text-neutral-600 mt-2">
              You must be signed in with an Administrator account (<code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-900 font-mono text-xs">admin@qazvucart.com</code>) to access the Developer & Operations Management Console.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Link
              href="/account"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-950 text-[#FFD21F] font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Return to My Profile
            </Link>
            <Link
              href="/"
              className="w-full block py-2.5 px-4 text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors"
            >
              Go to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const term = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term) || p.categoryName.toLowerCase().includes(term);
  });

  const filteredOrders = orders.filter((o) => {
    const matchStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
    if (!matchStatus) return false;
    if (!orderSearch.trim()) return true;
    const term = orderSearch.toLowerCase();
    return o.orderNumber.toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term) || o.customerEmail.toLowerCase().includes(term);
  });

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const term = userSearch.toLowerCase();
    return u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.phone.includes(term) || u.role.toLowerCase().includes(term);
  });

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 pb-20">
      {/* Top Header Bar */}
      <header className="bg-neutral-950 text-white border-b border-neutral-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition-colors text-xs flex items-center gap-1.5 font-semibold"
              title="Return to Profile"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <div className="h-6 w-px bg-neutral-800 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFD21F] text-neutral-950 flex items-center justify-center font-black shadow-xs">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight text-white">QazvuCart Admin Panel</h1>
                  <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Live System
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Signed in as <strong className="text-neutral-200">{user?.email}</strong> (Administrator)
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors text-xs flex items-center gap-1 font-semibold"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsAddProductOpen(true)}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-[#FFD21F] hover:bg-[#ffc800] text-neutral-950 font-extrabold rounded-xl transition-all shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>

            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl transition-colors text-xs"
            >
              <span>Storefront</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </Link>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-neutral-800/80 pt-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#FFD21F] text-[#FFD21F]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Overview & Metrics
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'products'
                ? 'border-[#FFD21F] text-[#FFD21F]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <Package className="w-4 h-4" /> Products Catalog ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'border-[#FFD21F] text-[#FFD21F]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Categories ({adminCategories.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-[#FFD21F] text-[#FFD21F]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Orders & Fulfillment ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-[#FFD21F] text-[#FFD21F]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <Users className="w-4 h-4" /> Users & Roles ({users.length})
          </button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Gross Sales</span>
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
                  {formatINR(analytics?.totalRevenue || 0)}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                  <TrendingUp className="w-3.5 h-3.5" /> All confirmed & delivered orders
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
                  {analytics?.totalOrders || 0}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-neutral-500">
                  <span className="text-amber-600 font-bold">{analytics?.pendingOrdersCount || 0} pending</span> •{' '}
                  <span className="text-emerald-600 font-bold">{analytics?.deliveredOrdersCount || 0} completed</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Live Catalog</span>
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
                  {analytics?.totalProducts || 0}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-neutral-500">
                  <span>Across all active categories</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Registered Users</span>
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
                  {analytics?.totalUsers || 0}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{analytics?.activeSellers || 1} verified merchant stores</span>
                </div>
              </div>
            </div>

            {/* Two Column Section: Category Distribution & Low Stock Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Breakdown (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-neutral-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-neutral-950 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-neutral-600" /> Catalog Distribution
                  </h2>
                  <span className="text-xs font-bold text-neutral-400">By Category</span>
                </div>
                <div className="space-y-3 pt-1">
                  {analytics?.salesByCategory?.map((cat) => (
                    <div key={cat.categoryName} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-neutral-700">
                        <span>{cat.categoryName}</span>
                        <span className="text-neutral-950 font-black">{cat.productCount} items</span>
                      </div>
                      <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(15, (cat.productCount / (analytics?.totalProducts || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock Warning Box (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-neutral-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-neutral-950 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Inventory Health & Alerts
                  </h2>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {analytics?.lowStockProductsCount || 0} Low Stock Alerts
                  </span>
                </div>

                <div className="divide-y divide-neutral-100">
                  {products
                    .filter((p) => p.stock <= 10)
                    .slice(0, 4)
                    .map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
                            <Image src={item.primaryImage} alt={item.name} fill className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-neutral-950 truncate">{item.name}</p>
                            <p className="text-[11px] text-neutral-500">{item.brand} • {item.categoryName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                            {item.stock} left
                          </span>
                          <button
                            onClick={() => {
                              setActiveTab('products');
                              setProductSearch(item.name);
                            }}
                            className="text-xs font-bold text-neutral-700 hover:text-neutral-950 p-1.5 hover:bg-neutral-100 rounded-lg"
                          >
                            Restock
                          </button>
                        </div>
                      </div>
                    ))}
                  {products.filter((p) => p.stock <= 10).length === 0 && (
                    <div className="py-8 text-center text-xs text-neutral-500 font-medium">
                      All products have optimal stock levels (&gt;10 units).
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-neutral-950 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-neutral-600" /> Recent Live Orders
                </h2>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-neutral-700 hover:text-neutral-950 flex items-center gap-1"
                >
                  View All Orders <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-y border-neutral-200">
                    <tr>
                      <th className="py-3 px-3">Order ID</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Payment</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {analytics?.recentOrders?.map((ord) => (
                      <tr key={ord.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-neutral-950">{ord.orderNumber}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-neutral-950">{ord.customerName}</p>
                          <p className="text-[10px] text-neutral-400">{ord.customerEmail}</p>
                        </td>
                        <td className="py-3 px-3 font-black text-neutral-950">{formatINR(ord.totalAmount)}</td>
                        <td className="py-3 px-3">
                          <span className="bg-neutral-100 text-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {ord.paymentMethod} • {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                              ord.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.status === 'SHIPPED'
                                ? 'bg-blue-100 text-blue-800'
                                : ord.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setActiveTab('orders');
                              setOrderSearch(ord.orderNumber);
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS CATALOG */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products by title, brand, or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-neutral-950 font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-bold">{filteredProducts.length} Products</span>
                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="flex items-center gap-1.5 py-2 px-4 bg-[#FFD21F] hover:bg-[#ffc800] text-neutral-950 font-extrabold rounded-xl transition-colors shadow-sm text-xs"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200">
                    <tr>
                      <th className="py-3 px-4">Product Info</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Price (M.R.P / Deal)</th>
                      <th className="py-3 px-3">Stock Units</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {filteredProducts.map((prod) => {
                      const isEditing = editingProductId === prod.id;
                      return (
                        <tr key={prod.id} className="hover:bg-neutral-50/70 transition-colors">
                          {/* Product Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
                                <Image src={prod.primaryImage} alt={prod.name} fill className="object-cover" />
                              </div>
                              <div className="min-w-0 max-w-xs">
                                <p className="font-extrabold text-neutral-950 truncate">{prod.name}</p>
                                <p className="text-[11px] text-neutral-500 font-medium">
                                  {prod.brand} • Store: {prod.sellerStoreName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-3">
                            <span className="bg-neutral-100 text-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              {prod.categoryName}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-3">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editPrice}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '' || /^\d*\.?\d*$/.test(v)) setEditPrice(v);
                                  }}
                                  className="w-24 px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold"
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="font-black text-neutral-950">{formatINR(prod.discountPrice)}</span>
                                <span className="text-[10px] text-neutral-400 line-through ml-1.5">
                                  {formatINR(prod.basePrice)}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Stock */}
                          <td className="py-3.5 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editStock}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === '' || /^\d*$/.test(v)) setEditStock(v);
                                }}
                                className="w-20 px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold"
                              />
                            ) : (
                              <span
                                className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                  prod.stock <= 10
                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                    : 'bg-neutral-100 text-neutral-800'
                                }`}
                              >
                                {prod.stock} units
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            <button
                              onClick={() => handleToggleProductStatus(prod)}
                              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase transition-colors ${
                                prod.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800'
                                  : 'bg-neutral-200 text-neutral-600 hover:bg-emerald-100 hover:text-emerald-800'
                              }`}
                              title="Click to toggle status"
                            >
                              {prod.status}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleSaveProductEdit(prod.id)}
                                  className="px-2.5 py-1 bg-neutral-950 text-white font-bold rounded-lg text-xs hover:bg-neutral-800"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingProductId(null)}
                                  className="px-2 py-1 text-neutral-500 font-bold hover:text-neutral-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingProductId(prod.id);
                                    setEditPrice(String(prod.discountPrice));
                                    setEditStock(String(prod.stock));
                                  }}
                                  className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors"
                                  title="Quick edit stock & price"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <Link
                                  href={`/products/${prod.slug}`}
                                  target="_blank"
                                  className="p-1.5 text-neutral-400 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors"
                                  title="View in Storefront"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CATEGORY MANAGEMENT */}
        {activeTab === 'categories' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-neutral-900">Category Management</h2>
              <button
                onClick={() => {
                  resetCategoryForm();
                  setIsAddCategoryOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3.5 bg-[#111111] hover:bg-neutral-800 text-white font-bold rounded-xl transition-all shadow-sm text-xs"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            {adminCategoriesStatus === 'loading' && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-sm text-neutral-500">
                Loading categories…
              </div>
            )}

            {adminCategoriesStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-2">
                <p className="text-sm font-bold text-red-700">Couldn&apos;t load categories</p>
                <button onClick={loadAdminCategories} className="text-xs font-bold underline text-red-800">
                  Retry
                </button>
              </div>
            )}

            {adminCategoriesStatus === 'empty' && (
              <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center space-y-2">
                <p className="text-sm font-bold text-neutral-700">No categories created yet</p>
                <p className="text-xs text-neutral-500">
                  Sellers and admins need at least one active category before products can be listed.
                </p>
                <button
                  onClick={() => {
                    resetCategoryForm();
                    setIsAddCategoryOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 mt-2 py-2 px-4 bg-[#FFD21F] text-neutral-950 font-extrabold rounded-xl text-xs"
                >
                  <Plus className="w-4 h-4" /> Create Category
                </button>
              </div>
            )}

            {adminCategoriesStatus === 'ready' && (
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr className="text-left text-neutral-500 uppercase tracking-wider">
                        <th className="px-4 py-3 font-bold">Category</th>
                        <th className="px-4 py-3 font-bold">Slug</th>
                        <th className="px-4 py-3 font-bold">Order</th>
                        <th className="px-4 py-3 font-bold">Products</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {adminCategories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-neutral-50">
                          {editingCategoryId === cat.id ? (
                            <>
                              <td className="px-4 py-3">
                                <input
                                  defaultValue={cat.name}
                                  id={`cat-name-${cat.id}`}
                                  className="w-full px-2 py-1 border border-neutral-300 rounded font-bold"
                                />
                              </td>
                              <td className="px-4 py-3 text-neutral-400">{cat.slug}</td>
                              <td className="px-4 py-3">
                                <input
                                  defaultValue={cat.displayOrder}
                                  id={`cat-order-${cat.id}`}
                                  inputMode="numeric"
                                  className="w-16 px-2 py-1 border border-neutral-300 rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-neutral-500">{cat.productCount}</td>
                              <td className="px-4 py-3 text-neutral-400">—</td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  onClick={() => {
                                    const nameEl = document.getElementById(`cat-name-${cat.id}`) as HTMLInputElement | null;
                                    const orderEl = document.getElementById(`cat-order-${cat.id}`) as HTMLInputElement | null;
                                    const nextOrder = Number(orderEl?.value ?? cat.displayOrder);
                                    handleUpdateCategory(cat.id, {
                                      name: nameEl?.value?.trim() || cat.name,
                                      displayOrder: Number.isNaN(nextOrder) ? cat.displayOrder : nextOrder,
                                    });
                                  }}
                                  className="text-emerald-700 font-bold hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingCategoryId(null)}
                                  className="text-neutral-500 font-bold hover:underline"
                                >
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-neutral-900">{cat.name}</td>
                              <td className="px-4 py-3 text-neutral-400">{cat.slug}</td>
                              <td className="px-4 py-3 text-neutral-500">{cat.displayOrder}</td>
                              <td className="px-4 py-3 text-neutral-500">{cat.productCount}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleUpdateCategory(cat.id, { isActive: !cat.isActive })}
                                  className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                    cat.isActive
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-neutral-200 text-neutral-500'
                                  }`}
                                  title="Click to toggle active/inactive"
                                >
                                  {cat.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right space-x-3">
                                <button
                                  onClick={() => setEditingCategoryId(cat.id)}
                                  className="text-neutral-700 font-bold hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                  className="text-red-600 font-bold hover:underline"
                                >
                                  {cat.productCount > 0 ? 'Archive' : 'Delete'}
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isAddCategoryOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsAddCategoryOpen(false)}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
                >
                  <div className="flex items-center justify-between px-5 py-4 bg-[#111111] rounded-t-2xl sticky top-0">
                    <h3 className="text-white font-extrabold flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#FFD21F]" /> Add New Category
                    </h3>
                    <button onClick={() => setIsAddCategoryOpen(false)} className="text-neutral-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-5 space-y-3 text-xs">
                    <div>
                      <label className="block text-neutral-700 font-bold mb-1">Category Name *</label>
                      <input
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="e.g. Home Audio"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-700 font-bold mb-1">Icon (lucide-react name)</label>
                      <input
                        value={catIcon}
                        onChange={(e) => setCatIcon(e.target.value)}
                        placeholder="e.g. Headphones"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-700 font-bold mb-1">Category Image URL</label>
                      <input
                        value={catImageUrl}
                        onChange={(e) => setCatImageUrl(e.target.value)}
                        placeholder="https://res.cloudinary.com/..."
                        className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-700 font-bold mb-1">Description</label>
                      <textarea
                        value={catDescription}
                        onChange={(e) => setCatDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-700 font-bold mb-1">Display Order</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={catDisplayOrder}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^-?\d*$/.test(v)) setCatDisplayOrder(v);
                        }}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900"
                      />
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Slug is generated automatically from the name and must be unique.
                    </p>
                  </div>
                  <div className="flex gap-2 p-5 pt-0 sticky bottom-0 bg-white">
                    <button
                      onClick={() => setIsAddCategoryOpen(false)}
                      className="flex-1 py-2.5 border border-neutral-300 rounded-xl font-bold text-neutral-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCategory}
                      className="flex-1 py-2.5 bg-[#FFD21F] rounded-xl font-extrabold text-neutral-950"
                    >
                      Create Category
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ORDERS & FULFILLMENT */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter Row */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by order ID, customer name, or email..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-neutral-950 font-medium"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold">
                {['ALL', 'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap text-[11px] ${
                      orderStatusFilter === st
                        ? 'bg-neutral-950 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Feed */}
            <div className="space-y-3">
              {filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-neutral-950 text-sm">{ord.orderNumber}</span>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                            ord.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.status === 'SHIPPED'
                              ? 'bg-blue-100 text-blue-800'
                              : ord.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 font-medium">
                        Placed by <strong className="text-neutral-900">{ord.customerName}</strong> ({ord.customerEmail} • {ord.customerPhone})
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-base font-black text-neutral-950">{formatINR(ord.totalAmount)}</p>
                      <p className="text-[11px] text-neutral-400 font-medium">
                        {ord.paymentMethod} • {ord.paymentStatus}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ord.items.map((it) => (
                      <div key={it.id} className="flex items-center gap-2.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-neutral-200">
                          <Image src={it.productImage} alt={it.productName} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 text-xs">
                          <p className="font-bold text-neutral-950 truncate">{it.productName}</p>
                          <p className="text-neutral-500 font-medium text-[11px]">
                            Qty: {it.quantity} × {formatINR(it.unitPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Advance Status Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                    <span className="text-[11px] text-neutral-400 font-medium">
                      Est. Delivery: {new Date(ord.estimatedDeliveryDate).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {ord.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'CONFIRMED')}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors"
                        >
                          Confirm Order
                        </button>
                      )}
                      {ord.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'PROCESSING')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors"
                        >
                          Pack & Process
                        </button>
                      )}
                      {ord.status === 'PROCESSING' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'SHIPPED')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" /> Dispatch / Ship
                        </button>
                      )}
                      {ord.status === 'SHIPPED' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                        </button>
                      )}
                      {ord.status !== 'CANCELLED' && ord.status !== 'DELIVERED' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'CANCELLED')}
                          className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 font-bold rounded-lg text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <div className="bg-white rounded-2xl p-12 text-center text-neutral-500 text-xs font-medium border border-neutral-200">
                  No orders match the selected filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: USERS & ROLES */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search users by name, email, phone, or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-neutral-950 font-medium"
                />
              </div>
              <span className="text-xs text-neutral-500 font-bold">{filteredUsers.length} Registered Accounts</span>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-3">Contact</th>
                      <th className="py-3 px-3">Current Role</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Assign Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-950 text-[#FFD21F] font-black text-xs flex items-center justify-center">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-extrabold text-neutral-950">{u.username}</p>
                              <p className="text-[10px] text-neutral-400">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="font-bold text-neutral-900">{u.email}</p>
                          <p className="text-[11px] text-neutral-500">{u.phone || 'No phone'}</p>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                              u.role === 'ADMIN'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : u.role === 'SELLER'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeUserRole(u.id, e.target.value as 'CUSTOMER' | 'SELLER' | 'ADMIN')}
                            className="text-xs font-bold bg-neutral-100 border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-800 focus:outline-none"
                          >
                            <option value="CUSTOMER">Customer</option>
                            <option value="SELLER">Seller</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FFD21F]" />
                <h3 className="font-black text-base">Add New Product to Catalog</h3>
              </div>
              <button onClick={() => setIsAddProductOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs font-medium">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sony, Apple, Nike"
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Category</label>
                  {categoriesStatus === 'loading' && (
                    <div className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-neutral-50 text-neutral-400 text-sm">
                      Loading categories…
                    </div>
                  )}
                  {categoriesStatus === 'error' && (
                    <div className="space-y-1.5">
                      <div className="w-full px-3 py-2 border border-red-300 bg-red-50 rounded-xl text-red-700 text-sm font-semibold">
                        Couldn&apos;t load categories
                      </div>
                      <button
                        type="button"
                        onClick={retryLoadCategories}
                        className="text-xs font-bold text-neutral-900 underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {categoriesStatus === 'empty' && (
                    <div className="w-full px-3 py-2 border border-neutral-300 bg-neutral-50 rounded-xl text-neutral-500 text-sm">
                      No categories created yet
                    </div>
                  )}
                  {categoriesStatus === 'ready' && (
                    <select
                      required
                      value={newProdCategoryId}
                      onChange={(e) => setNewProdCategoryId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                    >
                      <option value="">Select a category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Original Price (₹) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={newProdBasePrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setNewProdBasePrice(v);
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Deal Price (₹) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={newProdDiscountPrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setNewProdDiscountPrice(v);
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Initial Stock Units *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={newProdStock}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*$/.test(v)) setNewProdStock(v);
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Product Image (Optional)</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 shrink-0 rounded-xl border border-neutral-300 bg-neutral-50 overflow-hidden flex items-center justify-center">
                      {newProdImage ? (
                        <Image src={newProdImage} alt="Product preview" fill className="object-cover" />
                      ) : (
                        <ImagePlus className="w-6 h-6 text-neutral-400" />
                      )}
                    </div>
                    <label className="flex-1">
                      <span className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-700 cursor-pointer hover:bg-neutral-50 w-full justify-center">
                        {newProdImageUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading {newProdImageUploadProgress}%
                          </>
                        ) : (
                          <>
                            <ImagePlus className="w-4 h-4" />
                            {newProdImage ? 'Change image' : 'Upload image'}
                          </>
                        )}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                        onChange={handleProductImageSelect}
                        disabled={newProdImageUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="or paste an image URL directly"
                    value={newProdImage}
                    onChange={(e) => setNewProdImage(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-700 font-bold mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed specs, highlights and features..."
                  value={newProdDescription}
                  onChange={(e) => setNewProdDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-medium text-neutral-900"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdIsDeal}
                    onChange={(e) => setNewProdIsDeal(e.target.checked)}
                    className="w-4 h-4 rounded text-neutral-950"
                  />
                  <span className="font-bold text-neutral-800">Featured in Today&apos;s Deals</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdIsFeatured}
                    onChange={(e) => setNewProdIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-neutral-950"
                  />
                  <span className="font-bold text-neutral-800">Spotlight Hero Product</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2.5 font-bold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-[#FFD21F] font-extrabold rounded-xl transition-all shadow-md"
                >
                  Publish Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
