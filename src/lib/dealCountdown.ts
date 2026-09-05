'use client';

import { useEffect, useState } from 'react';

/**
 * Flash deals count down to the real end of the calendar day (local time),
 * not an arbitrary number that quietly resets on refresh. This is the
 * "don't fake scarcity" principle applied to the countdown itself — the
 * deadline is real and consistent no matter when the person loads the
 * page or how many times they reload it today.
 */
function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return { hours, minutes, seconds };
}

export function useDealCountdown() {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 1000);
    return () => clearInterval(timer);
  }, []);

  return timeLeft;
}

export function formatCountdown(t: { hours: number; minutes: number; seconds: number }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(t.hours)}:${pad(t.minutes)}:${pad(t.seconds)}`;
}
