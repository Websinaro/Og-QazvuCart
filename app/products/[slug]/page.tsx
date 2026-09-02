'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import { authFetch } from '@/src/lib/api';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import {
  Star,
  Heart,
  ShoppingBag,
  Zap,
  Truck,
  RotateCcw,
  Store,
  Plus,
  Minus,
  MessageSquare,
  HelpCircle,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Search,
  ThumbsUp,
  Share2,
  Tag,
  ChevronRight,
  ZoomIn,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';
import { formatINR } from '@/src/lib/date';

interface ProductVariant {
  id: number;
  name?: string;
  variantName?: string;
  sku: string;
  priceDelta?: number;
  priceAdjustment?: number;
  stock?: number;
  stockCount?: number;
  attributes: Record<string, string>;
}

interface ProductReview {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

interface ProductQuestion {
  id: number;
  userId: number;
  userName: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  createdAt: string;
}

interface ProductImageItem {
  id?: number;
  imageUrl?: string;
  image_url?: string;
  altText?: string;
  isPrimary?: boolean;
}

interface ProductDetailData {
  id: number;
  name: string;
  slug: string;
  description: string;
  brand: string;
  model?: string;
  warranty?: string;
  weight?: string;
  categoryName: string;
  categorySlug: string;
  seller?: {
    name: string;
    slug: string;
    rating: number;
    reviewCount: number;
  };
  basePrice: number;
  discountPrice: number;
  discountPercent: number;
  stock: number;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  primaryImage?: string;
  images?: Array<string | ProductImageItem>;
  specs?: Record<string, string>;
  specifications?: Array<{ id: number; key: string; value: string }>;
  variants: ProductVariant[];
  reviews?: ProductReview[];
  questions?: ProductQuestion[];
  ratingBreakdown?: {
    [star: number]: { count: number; percentage: number };
  };
  deliveryInfo: {
    dateString: string;
    dayOfWeek: string;
    formattedDate: string;
    fullDate: string;
  };
}

const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80';

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { addToCart, isLoading: isCartLoading } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { success, error } = useToast();

  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [related, setRelated] = useState<ProductCardProps[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>(DEFAULT_FALLBACK_IMAGE);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews' | 'qa'>('specs');
  const [isLoading, setIsLoading] = useState(true);

  // Lightbox Modal
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Pincode Checker State
  const [pincode, setPincode] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [pincodeDeliveryDate, setPincodeDeliveryDate] = useState<string | null>(null);

  // Reviews Filtering
  const [starFilter, setStarFilter] = useState<number | 'ALL'>('ALL');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<number, number>>({});

  // Q&A Search
  const [qaSearchQuery, setQaSearchQuery] = useState('');

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Question Modal State
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      if (!slug) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          console.warn('Product fetch failed:', json?.error?.message || res.statusText);
          setProduct(null);
          return;
        }
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          setProduct(p);

          // Extract first valid image URL
          let firstImage = typeof p.primaryImage === 'string' && p.primaryImage.trim() ? p.primaryImage.trim() : '';
          if (!firstImage && Array.isArray(p.images) && p.images.length > 0) {
            const first = p.images[0];
            if (typeof first === 'string' && first.trim()) {
              firstImage = first.trim();
            } else if (first && typeof first === 'object') {
              firstImage = first.imageUrl || first.image_url || '';
            }
          }
          setSelectedImage(firstImage || DEFAULT_FALLBACK_IMAGE);

          if (p.variants && p.variants.length > 0) {
            setSelectedVariant(p.variants[0]);
          }

          // Fetch related items in same category
          if (p.categorySlug) {
            try {
              const relRes = await fetch(`/api/products?category=${encodeURIComponent(p.categorySlug)}&limit=6`);
              if (relRes.ok) {
                const relJson = await relRes.json();
                if (relJson.success && relJson.data) {
                  setRelated(relJson.data.products.filter((item: ProductCardProps) => item.id !== p.id));
                }
              }
            } catch (relErr) {
              console.warn('Could not fetch related products:', relErr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProduct();
  }, [slug]);

  // Safely build gallery list of valid image URLs
  const imagesList = useMemo(() => {
    if (!product) return [DEFAULT_FALLBACK_IMAGE];
    const rawList: string[] = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      for (const item of product.images) {
        if (typeof item === 'string' && item.trim()) {
          rawList.push(item.trim());
        } else if (item && typeof item === 'object') {
          const url = item.imageUrl || item.image_url;
          if (typeof url === 'string' && url.trim()) {
            rawList.push(url.trim());
          }
        }
      }
    }
    if (product.primaryImage && typeof product.primaryImage === 'string' && product.primaryImage.trim()) {
      if (!rawList.includes(product.primaryImage.trim())) {
        rawList.unshift(product.primaryImage.trim());
      }
    }
    return rawList.length > 0 ? rawList : [DEFAULT_FALLBACK_IMAGE];
  }, [product]);

  const activeMainImage = (selectedImage && selectedImage.trim()) || imagesList[0] || DEFAULT_FALLBACK_IMAGE;

  // Calculate pricing with variant delta
  const priceDelta = selectedVariant ? (selectedVariant.priceDelta ?? selectedVariant.priceAdjustment ?? 0) : 0;
  const currentDiscountPrice = product ? Math.max(0, product.discountPrice + priceDelta) : 0;
  const currentBasePrice = product ? Math.max(0, product.basePrice + priceDelta) : 0;
  const totalSavings = currentBasePrice - currentDiscountPrice;
  const effectiveDiscountPercent =
    currentBasePrice > currentDiscountPrice
      ? Math.round(((currentBasePrice - currentDiscountPrice) / currentBasePrice) * 100)
      : product?.discountPercent || 0;
  const availableStock = selectedVariant
    ? (selectedVariant.stock ?? selectedVariant.stockCount ?? product?.stock ?? 0)
    : (product?.stock ?? 0);
  const isFav = product ? isInWishlist(product.id) : false;

  const handleAddToCart = async () => {
    if (!product || !product.inStock || availableStock <= 0) return;
    try {
      await addToCart(product.id, selectedVariant?.id || null, quantity);
      success(`Added ${quantity}x "${product.name}" to your cart`);
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Please sign in to add items to cart');
    }
  };

  const handleBuyNow = async () => {
    if (!product || !product.inStock || availableStock <= 0) return;
    try {
      await addToCart(product.id, selectedVariant?.id || null, quantity);
      router.push('/checkout');
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Please sign in to proceed to checkout');
    }
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    try {
      const added = await toggleWishlist(product.id);
      success(added ? 'Saved to your Wishlist' : 'Removed from Wishlist');
    } catch {
      error('Please sign in to manage your wishlist');
    }
  };

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length !== 6 || isNaN(Number(pincode))) {
      setPincodeStatus('invalid');
      setPincodeDeliveryDate(null);
      return;
    }
    setPincodeStatus('checking');
    setTimeout(() => {
      setPincodeStatus('valid');
      const now = new Date();
      now.setDate(now.getDate() + 2);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setPincodeDeliveryDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`);
    }, 400);
  };

  const handleHelpfulVote = (reviewId: number) => {
    setHelpfulVotes((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1,
    }));
    success('Thank you for voting this review helpful');
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      if (navigator.share) {
        navigator.share({
          title: product?.name,
          url: window.location.href,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        success('Product link copied to clipboard!');
      }
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      error('Please sign in to submit a review');
      return;
    }
    if (!product) return;
    setIsSubmittingReview(true);
    try {
      const res = await authFetch(`/api/products/${slug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to submit review');

      success('Review submitted successfully! Thank you for your feedback.');
      setIsReviewModalOpen(false);
      setReviewTitle('');
      setReviewComment('');
      // Reload product details
      const updatedRes = await fetch(`/api/products/${encodeURIComponent(slug)}`);
      if (updatedRes.ok) {
        const updatedP = await updatedRes.json();
        if (updatedP.success) setProduct(updatedP.data);
      }
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      error('Please sign in to ask a question');
      return;
    }
    if (!product || !newQuestionText.trim()) return;
    setIsSubmittingQuestion(true);
    try {
      const res = await authFetch(`/api/products/${encodeURIComponent(slug)}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: newQuestionText.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to submit question');

      success('Your question has been posted to the seller!');
      setNewQuestionText('');
      setIsQuestionModalOpen(false);
      // Reload
      const updatedRes = await fetch(`/api/products/${encodeURIComponent(slug)}`);
      if (updatedRes.ok) {
        const updatedP = await updatedRes.json();
        if (updatedP.success) setProduct(updatedP.data);
      }
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not post question');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  // Filtered reviews
  const allReviews = product?.reviews || [];
  const filteredReviews = starFilter === 'ALL'
    ? allReviews
    : allReviews.filter((r) => Math.round(r.rating) === starFilter);

  // Filtered Q&A
  const allQuestions = product?.questions || [];
  const query = qaSearchQuery.trim().toLowerCase();
  const filteredQuestions = !query
    ? allQuestions
    : allQuestions.filter(
        (item) => item.question.toLowerCase().includes(query) || (item.answer && item.answer.toLowerCase().includes(query))
      );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-neutral-900 border-t-[#FFD21F] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-neutral-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <h2 className="text-xl font-black text-neutral-900 mb-2">Product Not Found</h2>
          <p className="text-xs text-neutral-500 mb-6">
            The item you are looking for is currently unavailable or has been removed.
          </p>
          <Link
            href="/products"
            className="px-6 py-2.5 bg-neutral-900 text-[#FFD21F] font-bold text-xs rounded-xl shadow transition-colors"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* 1. Breadcrumbs Header */}
      <div className="bg-white border-b border-neutral-200 py-3 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-500 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-neutral-900 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <Link href="/products" className="hover:text-neutral-900 transition-colors">
              Products
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <Link href={`/products?category=${product.categorySlug}`} className="hover:text-neutral-900 transition-colors font-medium">
              {product.categoryName}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-bold text-neutral-900 truncate max-w-[200px] sm:max-w-md">
              {product.name}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 px-3 py-1 bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 2. Main Product Hero (Gallery + Buy Box) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-neutral-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left: Gallery (5 cols) */}
          <div className="lg:col-span-5 flex flex-col-reverse sm:flex-row gap-4">
            {/* Thumbnails */}
            {imagesList.length > 1 && (
              <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto max-h-[480px] scrollbar-none pb-2 sm:pb-0">
                {imagesList.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 bg-neutral-50 shrink-0 transition-all cursor-pointer ${
                      activeMainImage === imgUrl ? 'border-neutral-900 ring-2 ring-[#FFD21F]' : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <Image
                      src={imgUrl}
                      alt={`${product.name} view ${idx + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Primary Main Image with Zoom Trigger */}
            <div className="flex-1 relative aspect-square bg-neutral-50 rounded-2xl overflow-hidden border border-neutral-200 group">
              <Image
                src={activeMainImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 550px"
                className="object-cover transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
                referrerPolicy="no-referrer"
                onClick={() => setIsLightboxOpen(true)}
              />

              {/* Discount Badge */}
              {effectiveDiscountPercent > 0 && (
                <div className="absolute top-4 left-4 bg-[#E50914] text-white text-xs font-black px-2.5 py-1 rounded-md shadow-md uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>{effectiveDiscountPercent}% OFF</span>
                </div>
              )}

              {/* Wishlist Button */}
              <button
                onClick={handleWishlistToggle}
                className={`absolute top-4 right-4 p-2.5 rounded-full shadow-md backdrop-blur-md transition-all cursor-pointer ${
                  isFav ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white/90 text-neutral-600 hover:text-red-600 border border-neutral-200'
                }`}
                aria-label="Wishlist"
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-red-600' : ''}`} />
              </button>

              {/* Zoom In Hint Overlay */}
              <button
                onClick={() => setIsLightboxOpen(true)}
                className="absolute bottom-4 right-4 p-2 bg-neutral-950/80 hover:bg-neutral-950 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
              >
                <ZoomIn className="w-3.5 h-3.5 text-[#FFD21F]" />
                <span>Enlarge</span>
              </button>
            </div>
          </div>

          {/* Right: Product Info & Buy Box (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div>
              {/* Brand & In-Stock Status */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">
                  Brand: <strong className="text-neutral-900">{product.brand}</strong>
                </span>
                {product.inStock && availableStock > 0 ? (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    In Stock ({availableStock} units available)
                  </span>
                ) : (
                  <span className="bg-red-50 text-red-800 border border-red-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    Currently Out of Stock
                  </span>
                )}
              </div>

              {/* Product Title */}
              <h1 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight leading-tight mb-3">
                {product.name}
              </h1>

              {/* Ratings & Q&A Summary Bar */}
              <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs font-extrabold">
                  <span>{product.rating > 0 ? product.rating.toFixed(1) : '4.6'}</span>
                  <Star className="w-3.5 h-3.5 fill-emerald-700 text-emerald-700" />
                </div>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 underline transition-colors cursor-pointer"
                >
                  {product.reviewCount} Ratings & {product.reviews?.length || 0} Reviews
                </button>
                <span className="text-neutral-300">|</span>
                <button
                  onClick={() => setActiveTab('qa')}
                  className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{product.questions?.length || 0} Q&As</span>
                </button>
                <span className="text-neutral-300">|</span>
                <span className="text-xs text-neutral-500 font-medium">SKU: {selectedVariant?.sku || `PROD-${product.id}`}</span>
              </div>

              {/* Sold By */}
              {product.seller?.slug && (
                <div className="flex items-center gap-2 pt-3 text-xs">
                  <Store className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-neutral-500 font-medium">Sold by</span>
                  <Link
                    href={`/seller/${product.seller.slug}`}
                    className="font-bold text-neutral-900 hover:text-[#c9a300] underline decoration-neutral-300 underline-offset-2 transition-colors"
                  >
                    {product.seller.name}
                  </Link>
                  {product.seller.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-emerald-700 font-bold">
                      <Star className="w-3 h-3 fill-emerald-700" />
                      {product.seller.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              )}

              {/* 3. Original Price, Discount & Discounted Price Box */}
              <div className="py-4 space-y-1.5 bg-neutral-50/70 p-4 rounded-2xl border border-neutral-100 my-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  {/* Final Discounted Price */}
                  <span className="text-3xl sm:text-4xl font-black text-neutral-950 tracking-tight">
                    {formatINR(currentDiscountPrice)}
                  </span>

                  {/* Original Strike-through Base Price */}
                  {currentBasePrice > currentDiscountPrice && (
                    <>
                      <span className="text-base sm:text-lg text-neutral-400 line-through font-semibold">
                        {formatINR(currentBasePrice)}
                      </span>
                      {/* Discount Percentage Pill */}
                      <span className="text-xs font-black text-red-700 bg-red-100/90 px-2.5 py-1 rounded-md border border-red-200 uppercase tracking-wide">
                        Save {formatINR(totalSavings)} ({effectiveDiscountPercent}% OFF)
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Inclusive of all taxes. Free shipping on orders over ₹999.
                </p>

                {/* Bank / EMI Offer Highlights */}
                <div className="pt-3 border-t border-neutral-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2 text-neutral-700 bg-white p-2 rounded-xl border border-neutral-200/70">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 fill-amber-400" />
                    <span><strong>Bank Offer:</strong> 10% instant discount up to ₹1,500 on major cards</span>
                  </div>
                  <div className="flex items-start gap-2 text-neutral-700 bg-white p-2 rounded-xl border border-neutral-200/70">
                    <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>No Cost EMI:</strong> Available starting from {formatINR(Math.round(currentDiscountPrice / 6))}/mo</span>
                  </div>
                </div>
              </div>

              {/* 4. Variant Selection */}
              {product.variants && product.variants.length > 0 && (
                <div className="pt-2 pb-4 border-t border-neutral-100">
                  <label className="block text-xs font-extrabold text-neutral-800 uppercase tracking-wider mb-2">
                    Select Option / Edition: <span className="text-neutral-500 font-medium">{selectedVariant?.name || selectedVariant?.variantName}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => {
                      const vName = v.name || v.variantName || 'Option';
                      const delta = v.priceDelta ?? v.priceAdjustment ?? 0;
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-950 text-[#FFD21F] border-neutral-950 shadow-sm ring-2 ring-[#FFD21F]/30'
                              : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200'
                          }`}
                        >
                          <span>{vName}</span>
                          {delta !== 0 && (
                            <span className="text-[10px] opacity-80 font-normal">
                              ({delta > 0 ? `+${formatINR(delta)}` : formatINR(delta)})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Interactive Pincode & Delivery Checker */}
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-3">
                <form onSubmit={handleCheckPincode} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit delivery pincode (e.g. 560001)"
                      className="w-full pl-3 pr-20 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD21F]"
                    />
                    <button
                      type="submit"
                      disabled={pincode.length !== 6 || pincodeStatus === 'checking'}
                      className="absolute right-1 top-1 bottom-1 px-3 bg-neutral-900 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {pincodeStatus === 'checking' ? 'Checking...' : 'Check'}
                    </button>
                  </div>
                </form>

                {pincodeStatus === 'valid' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Delivery available to {pincode} by <strong>{pincodeDeliveryDate || product.deliveryInfo.dateString}</strong> • Cash on Delivery Available
                    </span>
                  </div>
                )}

                {pincodeStatus === 'invalid' && (
                  <p className="text-xs text-red-600 font-medium">Please enter a valid 6-digit Indian postal pincode.</p>
                )}

                {pincodeStatus === 'idle' && (
                  <div className="flex items-start gap-2.5 text-xs text-neutral-800">
                    <Truck className="w-4 h-4 text-[#FFD21F] shrink-0 mt-0.5 fill-[#FFD21F]" />
                    <div>
                      <span className="font-semibold text-neutral-900">
                        Standard Delivery by <strong className="text-neutral-950 font-black">{product.deliveryInfo.dateString}</strong>
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Free delivery on all orders over ₹999. Dispatched within 24 hours.
                      </p>
                    </div>
                  </div>
                )}

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-neutral-200/60 text-[11px] text-neutral-600 font-medium">
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5 text-neutral-500" /> 7-Day Replacement
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" /> {product.warranty || '1 Year Brand Warranty'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-neutral-500" /> Verified Merchant
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Quantity Stepper & Main CTAs */}
            <div className="pt-4 border-t border-neutral-100 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">Quantity:</span>
                <div className="flex items-center border border-neutral-300 rounded-xl bg-white shadow-xs overflow-hidden">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-2 hover:bg-neutral-100 text-neutral-700 transition-colors disabled:opacity-40 cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3.5 text-xs font-bold text-neutral-950 min-w-8 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                    disabled={quantity >= availableStock}
                    className="p-2 hover:bg-neutral-100 text-neutral-700 transition-colors disabled:opacity-40 cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {availableStock > 0 && availableStock <= 5 && (
                  <span className="text-xs font-bold text-amber-600">Only {availableStock} left in stock!</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.inStock || isCartLoading || availableStock <= 0}
                  className="py-3.5 px-5 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{product.inStock && availableStock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={!product.inStock || isCartLoading || availableStock <= 0}
                  className="py-3.5 px-5 bg-neutral-950 hover:bg-neutral-800 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-[#FFD21F] fill-[#FFD21F]" />
                  <span>Buy Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabbed Content: Description, Specifications, Reviews & Q&A */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b border-neutral-200 bg-neutral-50 px-4 sm:px-6 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('specs')}
              className={`py-4 px-5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'specs'
                  ? 'border-neutral-950 text-neutral-950 bg-white font-black'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Description & Specifications
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-4 px-5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'reviews'
                  ? 'border-neutral-950 text-neutral-950 bg-white font-black'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span>Customer Reviews</span>
              <span className="bg-neutral-200 text-neutral-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {product.reviews?.length || product.reviewCount || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`py-4 px-5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'qa'
                  ? 'border-neutral-950 text-neutral-950 bg-white font-black'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span>Questions & Answers</span>
              <span className="bg-neutral-200 text-neutral-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {product.questions?.length || 0}
              </span>
            </button>
          </div>

          {/* TAB 1: DESCRIPTION & SPECIFICATIONS */}
          {activeTab === 'specs' && (
            <div className="p-6 sm:p-10 space-y-10">
              {/* Description Section */}
              <div>
                <h3 className="text-lg font-black text-neutral-950 mb-3 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-amber-500" />
                  <span>Product Description & Features</span>
                </h3>
                <div className="text-sm text-neutral-700 leading-relaxed max-w-4xl whitespace-pre-line space-y-4">
                  <p>{product.description}</p>
                </div>

                {/* Key Highlight Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-neutral-100">
                  <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center space-y-1">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto" />
                    <h5 className="text-xs font-bold text-neutral-900">100% Genuine</h5>
                    <p className="text-[11px] text-neutral-500">Verified authentic item</p>
                  </div>
                  <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center space-y-1">
                    <RotateCcw className="w-5 h-5 text-blue-600 mx-auto" />
                    <h5 className="text-xs font-bold text-neutral-900">Easy Returns</h5>
                    <p className="text-[11px] text-neutral-500">7-day replacement guarantee</p>
                  </div>
                  <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center space-y-1">
                    <Truck className="w-5 h-5 text-amber-600 mx-auto" />
                    <h5 className="text-xs font-bold text-neutral-900">Express Delivery</h5>
                    <p className="text-[11px] text-neutral-500">Fast pan-India dispatch</p>
                  </div>
                  <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center space-y-1">
                    <Store className="w-5 h-5 text-purple-600 mx-auto" />
                    <h5 className="text-xs font-bold text-neutral-900">Warranty Covered</h5>
                    <p className="text-[11px] text-neutral-500">{product.warranty || '1 Year Brand Warranty'}</p>
                  </div>
                </div>
              </div>

              {/* Technical Specifications Section */}
              <div>
                <h3 className="text-lg font-black text-neutral-950 mb-4">Technical Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Basic Specifications */}
                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-2.5">
                    <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider pb-2 border-b border-neutral-200">
                      General Information
                    </h4>
                    <div className="flex justify-between text-xs py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500 font-semibold">Brand</span>
                      <span className="text-neutral-900 font-bold">{product.brand}</span>
                    </div>
                    {product.model && (
                      <div className="flex justify-between text-xs py-1 border-b border-neutral-200/50">
                        <span className="text-neutral-500 font-semibold">Model</span>
                        <span className="text-neutral-900 font-bold">{product.model}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500 font-semibold">Category</span>
                      <span className="text-neutral-900 font-bold">{product.categoryName}</span>
                    </div>
                    {product.warranty && (
                      <div className="flex justify-between text-xs py-1 border-b border-neutral-200/50">
                        <span className="text-neutral-500 font-semibold">Warranty</span>
                        <span className="text-neutral-900 font-bold">{product.warranty}</span>
                      </div>
                    )}
                    {product.weight && (
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-neutral-500 font-semibold">Item Weight</span>
                        <span className="text-neutral-900 font-bold">{product.weight}</span>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Technical Specs */}
                  {product.specs && Object.keys(product.specs).length > 0 ? (
                    <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-2.5">
                      <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider pb-2 border-b border-neutral-200">
                        Key Attributes & Hardware
                      </h4>
                      {Object.entries(product.specs).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-xs py-1 border-b border-neutral-200/50 last:border-0">
                          <span className="text-neutral-500 font-semibold uppercase">{key}</span>
                          <span className="text-neutral-900 font-bold text-right">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  ) : product.specifications && product.specifications.length > 0 ? (
                    <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-2.5">
                      <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider pb-2 border-b border-neutral-200">
                        Key Attributes & Hardware
                      </h4>
                      {product.specifications.map((s) => (
                        <div key={s.id} className="flex justify-between text-xs py-1 border-b border-neutral-200/50 last:border-0">
                          <span className="text-neutral-500 font-semibold uppercase">{s.key}</span>
                          <span className="text-neutral-900 font-bold text-right">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMER REVIEWS & RATINGS */}
          {activeTab === 'reviews' && (
            <div className="p-6 sm:p-10 space-y-8">
              {/* Rating Summary Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8 border-b border-neutral-100">
                {/* Score */}
                <div className="flex flex-col items-center justify-center p-6 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center">
                  <div className="text-5xl font-black text-neutral-950 mb-2">
                    {product.reviewCount > 0 ? product.rating.toFixed(1) : '—'}
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= Math.round(product.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500 font-semibold">
                    {product.reviewCount > 0
                      ? `Based on ${product.reviewCount} verified customer ratings`
                      : 'No reviews yet'}
                  </p>
                </div>

                {/* Rating Distribution Bars */}
                <div className="flex flex-col justify-center space-y-2 text-xs font-semibold text-neutral-700 bg-neutral-50 p-6 rounded-2xl border border-neutral-200/80">
                  {product.reviewCount > 0 ? (
                    ([5, 4, 3, 2, 1] as const).map((score) => {
                      const breakdownInfo = product.ratingBreakdown?.[score];
                      const percent = breakdownInfo?.percentage || 0;
                      const count = breakdownInfo?.count || 0;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setStarFilter(starFilter === score ? 'ALL' : score)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
                        >
                          <span className="w-12 text-neutral-600 font-bold">{score} Stars</span>
                          <div className="flex-1 bg-neutral-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-[#FFD21F] h-full rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="w-10 text-[11px] text-neutral-400 text-right">{percent}%</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-center text-neutral-400 py-4">No reviews yet</p>
                  )}
                </div>

                {/* Write Review CTA */}
                <div className="flex flex-col items-center justify-center text-center p-6 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <Sparkles className="w-6 h-6 text-amber-700 mb-2" />
                  <h4 className="text-sm font-bold text-neutral-950 mb-1">Have you used this product?</h4>
                  <p className="text-xs text-neutral-600 mb-4">
                    Share your verified feedback to assist fellow shoppers.
                  </p>
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        error('Please sign in to write a verified review');
                      } else {
                        setIsReviewModalOpen(true);
                      }
                    }}
                    className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Write a Customer Review
                  </button>
                </div>
              </div>

              {/* Review Filter Chips */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-500">Filter by:</span>
                  <button
                    onClick={() => setStarFilter('ALL')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      starFilter === 'ALL'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    All Reviews ({product.reviews?.length || 0})
                  </button>
                  {[5, 4, 3, 2, 1].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStarFilter(st)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                        starFilter === st
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <span>{st}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {filteredReviews.length === 0 ? (
                  <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
                    <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs text-neutral-500 font-medium">
                      No customer reviews found matching this filter.
                    </p>
                    <button
                      onClick={() => setStarFilter('ALL')}
                      className="text-xs font-bold text-neutral-900 underline"
                    >
                      Show all reviews
                    </button>
                  </div>
                ) : (
                  filteredReviews.map((rev) => {
                    const votes = helpfulVotes[rev.id] || 0;
                    return (
                      <div
                        key={rev.id}
                        className="p-5 rounded-2xl bg-neutral-50/70 border border-neutral-200/80 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-900 text-[#FFD21F] font-black text-xs flex items-center justify-center">
                              {rev.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-neutral-900">{rev.userName}</span>
                                {rev.verifiedPurchase && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Verified Buyer
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-400">{new Date(rev.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Star rating */}
                          <div className="flex items-center gap-0.5 text-amber-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                              />
                            ))}
                          </div>
                        </div>

                        {rev.title && <h5 className="text-xs font-bold text-neutral-950">{rev.title}</h5>}
                        <p className="text-xs text-neutral-700 leading-relaxed">{rev.comment}</p>

                        {/* Helpful vote */}
                        <div className="flex items-center gap-3 pt-2 border-t border-neutral-200/60 text-[11px] text-neutral-500">
                          <span>Was this review helpful?</span>
                          <button
                            onClick={() => handleHelpfulVote(rev.id)}
                            className="flex items-center gap-1 font-bold text-neutral-700 hover:text-neutral-950 px-2 py-0.5 bg-white rounded border border-neutral-200 transition-colors cursor-pointer"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>Helpful ({votes})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUESTIONS & ANSWERS (Q&A) */}
          {activeTab === 'qa' && (
            <div className="p-6 sm:p-10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
                <div>
                  <h4 className="text-base font-black text-neutral-950">Customer Questions & Answers</h4>
                  <p className="text-xs text-neutral-500">Have questions about compatibility, specs, or warranty? Ask verified sellers.</p>
                </div>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      error('Please sign in to ask a question');
                    } else {
                      setIsQuestionModalOpen(true);
                    }
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  Ask a Question
                </button>
              </div>

              {/* Search Bar for Questions */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={qaSearchQuery}
                  onChange={(e) => setQaSearchQuery(e.target.value)}
                  placeholder="Search questions by keyword..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD21F] focus:bg-white"
                />
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                  <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
                    <HelpCircle className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs text-neutral-500">
                      {qaSearchQuery ? 'No questions match your search.' : 'No questions have been asked yet for this item. Be the first to ask!'}
                    </p>
                  </div>
                ) : (
                  filteredQuestions.map((qa) => (
                    <div key={qa.id} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="font-black text-xs text-neutral-900 bg-neutral-200 px-1.5 py-0.5 rounded">Q</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-neutral-900">{qa.question}</p>
                          <span className="text-[10px] text-neutral-400">Asked by {qa.userName} on {new Date(qa.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {qa.answer ? (
                        <div className="flex items-start gap-2 pl-4 border-l-2 border-[#FFD21F] mt-2">
                          <span className="font-black text-xs text-amber-900 bg-[#FFD21F] px-1.5 py-0.5 rounded">A</span>
                          <div>
                            <p className="text-xs text-neutral-700 leading-relaxed">{qa.answer}</p>
                            <span className="text-[10px] text-neutral-500 font-semibold flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Answered by {qa.answeredBy || 'Verified Seller'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 italic pl-6">
                          Pending response from the verified seller.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Suggested / Related Products (Desktop 4-col, responsive grid) */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-black text-neutral-950 tracking-tight">
                Customers Also Viewed & Suggested Items
              </h3>
              <p className="text-xs text-neutral-500">Curated recommendations based on this item</p>
            </div>
            <Link
              href={`/products?category=${product.categorySlug}`}
              className="text-xs font-bold text-neutral-900 hover:text-amber-600 transition-colors"
            >
              Explore {product.categoryName} &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {related.slice(0, 4).map((item) => (
              <ProductCard key={item.id} {...item} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Image Preview Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl overflow-hidden p-4 sm:p-6 flex flex-col items-center">
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full text-neutral-800 transition-colors cursor-pointer z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative w-full aspect-square max-h-[65vh] bg-neutral-50 rounded-2xl overflow-hidden">
              <Image
                src={activeMainImage}
                alt={product.name}
                fill
                sizes="800px"
                className="object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            {imagesList.length > 1 && (
              <div className="flex gap-2 overflow-x-auto mt-4 pt-2 max-w-full">
                {imagesList.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                      activeMainImage === img ? 'border-neutral-900 ring-2 ring-[#FFD21F]' : 'border-neutral-200'
                    }`}
                  >
                    <Image src={img} alt="thumb" fill sizes="56px" className="object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-950">Write a Customer Review</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4 pt-4">
              {/* Rating selection */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Overall Rating
                </label>
                <div className="flex items-center gap-2 text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setReviewRating(s)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star className={`w-7 h-7 ${s <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`} />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-neutral-800 ml-2">{reviewRating} of 5 Stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Review Headline
                </label>
                <input
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Excellent build quality & fast delivery"
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD21F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Detailed Experience
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details of your experience with this item..."
                  rows={4}
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD21F]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full py-3 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Verified Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ask Question Modal */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-950">Ask the Seller a Question</h3>
              <button onClick={() => setIsQuestionModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleQuestionSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Your Question
                </label>
                <textarea
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="e.g. Does this unit include a Type-C fast charging cable?"
                  rows={4}
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD21F]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingQuestion}
                className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingQuestion ? 'Posting...' : 'Post Question to Seller'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
