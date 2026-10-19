'use client';

/**
 * Icon layer for the whole app, powered by Phosphor Icons.
 *
 * Every screen imports icons from here instead of from an icon package
 * directly, so the library can be swapped again in one place.
 *
 * Wrapper behaviour:
 *  - `strokeWidth` is accepted for API compatibility with the previous icon
 *    set and mapped onto Phosphor weights (>= 2.5 -> bold, otherwise regular).
 *  - If a `fill-*` Tailwind class is present, the icon switches to the
 *    "fill" weight so the colour actually shows (e.g. filled rating stars).
 */
import React from 'react';
import {
  ArrowCounterClockwise as PArrowCounterClockwise,
  ArrowLeft as PArrowLeft,
  ArrowRight as PArrowRight,
  ArrowSquareOut as PArrowSquareOut,
  ArrowsClockwise as PArrowsClockwise,
  Bag as PBag,
  Barbell as PBarbell,
  Bell as PBell,
  BellRinging as PBellRinging,
  Buildings as PBuildings,
  CalendarBlank as PCalendarBlank,
  CaretDown as PCaretDown,
  CaretLeft as PCaretLeft,
  CaretRight as PCaretRight,
  ChatCircleText as PChatCircleText,
  Check as PCheck,
  CheckCircle as PCheckCircle,
  Checks as PChecks,
  CircleNotch as PCircleNotch,
  Clock as PClock,
  ClockCounterClockwise as PClockCounterClockwise,
  CreditCard as PCreditCard,
  CurrencyDollar as PCurrencyDollar,
  EnvelopeSimple as PEnvelopeSimple,
  Eye as PEye,
  Fire as PFire,
  Funnel as PFunnel,
  GearSix as PGearSix,
  GridFour as PGridFour,
  Headphones as PHeadphones,
  Heart as PHeart,
  House as PHouse,
  ImageSquare as PImageSquare,
  Info as PInfo,
  Laptop as PLaptop,
  Lightning as PLightning,
  List as PList,
  Lock as PLock,
  MagnifyingGlass as PMagnifyingGlass,
  MagnifyingGlassPlus as PMagnifyingGlassPlus,
  MapPin as PMapPin,
  Minus as PMinus,
  Money as PMoney,
  Moon as PMoon,
  Package as PPackage,
  PencilSimple as PPencilSimple,
  Phone as PPhone,
  Plus as PPlus,
  Question as PQuestion,
  ShareNetwork as PShareNetwork,
  Shield as PShield,
  ShieldCheck as PShieldCheck,
  SignOut as PSignOut,
  Sliders as PSliders,
  Sparkle as PSparkle,
  SquaresFour as PSquaresFour,
  Star as PStar,
  Storefront as PStorefront,
  Sun as PSun,
  TShirt as PTShirt,
  Tag as PTag,
  ThumbsUp as PThumbsUp,
  Trash as PTrash,
  TrendUp as PTrendUp,
  Truck as PTruck,
  User as PUser,
  Users as PUsers,
  Warning as PWarning,
  WarningCircle as PWarningCircle,
  Watch as PWatch,
  X as PX,
  type Icon,
  type IconProps,
} from '@phosphor-icons/react';

export type AppIconProps = Omit<IconProps, 'ref'> & { strokeWidth?: number | string };
export type AppIcon = React.ComponentType<AppIconProps>;

function wrap(Base: Icon, name: string): AppIcon {
  const Wrapped = ({ strokeWidth, weight, className, ...rest }: AppIconProps) => {
    let w = weight;
    if (!w) {
      const sw = typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : strokeWidth;
      if (className && /(^|\s)fill-/.test(className)) w = 'fill';
      else if (sw !== undefined && sw >= 2.5) w = 'bold';
      else w = 'regular';
    }
    return <Base weight={w} className={className} {...rest} />;
  };
  Wrapped.displayName = `AppIcon(${name})`;
  return Wrapped;
}

export const AlertCircle = wrap(PWarningCircle, 'AlertCircle');
export const AlertTriangle = wrap(PWarning, 'AlertTriangle');
export const ArrowLeft = wrap(PArrowLeft, 'ArrowLeft');
export const ArrowRight = wrap(PArrowRight, 'ArrowRight');
export const Banknote = wrap(PMoney, 'Banknote');
export const Bell = wrap(PBell, 'Bell');
export const BellRing = wrap(PBellRinging, 'BellRing');
export const Building2 = wrap(PBuildings, 'Building2');
export const Calendar = wrap(PCalendarBlank, 'Calendar');
export const Check = wrap(PCheck, 'Check');
export const CheckCheck = wrap(PChecks, 'CheckCheck');
export const CheckCircle2 = wrap(PCheckCircle, 'CheckCircle2');
export const ChevronDown = wrap(PCaretDown, 'ChevronDown');
export const ChevronLeft = wrap(PCaretLeft, 'ChevronLeft');
export const ChevronRight = wrap(PCaretRight, 'ChevronRight');
export const Clock = wrap(PClock, 'Clock');
export const CreditCard = wrap(PCreditCard, 'CreditCard');
export const DollarSign = wrap(PCurrencyDollar, 'DollarSign');
export const Dumbbell = wrap(PBarbell, 'Dumbbell');
export const Edit2 = wrap(PPencilSimple, 'Edit2');
export const ExternalLink = wrap(PArrowSquareOut, 'ExternalLink');
export const Eye = wrap(PEye, 'Eye');
export const Filter = wrap(PFunnel, 'Filter');
export const Flame = wrap(PFire, 'Flame');
export const Grid2X2 = wrap(PSquaresFour, 'Grid2X2');
export const Grid3X3 = wrap(PGridFour, 'Grid3X3');
export const Headphones = wrap(PHeadphones, 'Headphones');
export const Heart = wrap(PHeart, 'Heart');
export const HelpCircle = wrap(PQuestion, 'HelpCircle');
export const History = wrap(PClockCounterClockwise, 'History');
export const Home = wrap(PHouse, 'Home');
export const ImagePlus = wrap(PImageSquare, 'ImagePlus');
export const Info = wrap(PInfo, 'Info');
export const Laptop = wrap(PLaptop, 'Laptop');
export const LayoutDashboard = wrap(PSquaresFour, 'LayoutDashboard');
export const LayoutGrid = wrap(PSquaresFour, 'LayoutGrid');
export const Loader2 = wrap(PCircleNotch, 'Loader2');
export const Lock = wrap(PLock, 'Lock');
export const LogOut = wrap(PSignOut, 'LogOut');
export const Mail = wrap(PEnvelopeSimple, 'Mail');
export const MapPin = wrap(PMapPin, 'MapPin');
export const Menu = wrap(PList, 'Menu');
export const MessageSquare = wrap(PChatCircleText, 'MessageSquare');
export const Minus = wrap(PMinus, 'Minus');
export const Moon = wrap(PMoon, 'Moon');
export const Package = wrap(PPackage, 'Package');
export const PackageCheck = wrap(PPackage, 'PackageCheck');
export const Phone = wrap(PPhone, 'Phone');
export const Plus = wrap(PPlus, 'Plus');
export const RefreshCw = wrap(PArrowsClockwise, 'RefreshCw');
export const RotateCcw = wrap(PArrowCounterClockwise, 'RotateCcw');
export const Search = wrap(PMagnifyingGlass, 'Search');
export const Settings = wrap(PGearSix, 'Settings');
export const Share2 = wrap(PShareNetwork, 'Share2');
export const Shield = wrap(PShield, 'Shield');
export const ShieldCheck = wrap(PShieldCheck, 'ShieldCheck');
export const Shirt = wrap(PTShirt, 'Shirt');
export const ShoppingBag = wrap(PBag, 'ShoppingBag');
export const SlidersHorizontal = wrap(PSliders, 'SlidersHorizontal');
export const Sparkles = wrap(PSparkle, 'Sparkles');
export const Star = wrap(PStar, 'Star');
export const Store = wrap(PStorefront, 'Store');
export const Sun = wrap(PSun, 'Sun');
export const Tag = wrap(PTag, 'Tag');
export const ThumbsUp = wrap(PThumbsUp, 'ThumbsUp');
export const Trash2 = wrap(PTrash, 'Trash2');
export const TrendingUp = wrap(PTrendUp, 'TrendingUp');
export const Truck = wrap(PTruck, 'Truck');
export const User = wrap(PUser, 'User');
export const Users = wrap(PUsers, 'Users');
export const Watch = wrap(PWatch, 'Watch');
export const X = wrap(PX, 'X');
export const Zap = wrap(PLightning, 'Zap');
export const ZoomIn = wrap(PMagnifyingGlassPlus, 'ZoomIn');
