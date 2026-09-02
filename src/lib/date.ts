export interface DeliveryEstimate {
  dateString: string;
  dayOfWeek: string;
  formattedDate: string;
  fullDate: string;
  isToday: boolean;
  isTomorrow: boolean;
  deliveryFee: number;
  freeDeliveryThreshold: number;
}

export function getDeliveryEstimate(estimatedDays: number = 3, baseDeliveryFee: number = 40): DeliveryEstimate {
  const now = new Date();
  const deliveryDate = new Date(now.getTime() + estimatedDays * 24 * 60 * 60 * 1000);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayOfWeek = daysOfWeek[deliveryDate.getDay()];
  const month = months[deliveryDate.getMonth()];
  const fullMonth = fullMonths[deliveryDate.getMonth()];
  const dayOfMonth = deliveryDate.getDate();
  const year = deliveryDate.getFullYear();

  const isToday = estimatedDays === 0;
  const isTomorrow = estimatedDays === 1;

  const formattedDate = `${month} ${dayOfMonth}`;
  const dateString = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : `${dayOfWeek}, ${month} ${dayOfMonth}`;
  const fullDate = `${dayOfWeek}, ${fullMonth} ${dayOfMonth}, ${year}`;

  return {
    dateString,
    dayOfWeek,
    formattedDate,
    fullDate,
    isToday,
    isTomorrow,
    deliveryFee: baseDeliveryFee,
    freeDeliveryThreshold: 999,
  };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
