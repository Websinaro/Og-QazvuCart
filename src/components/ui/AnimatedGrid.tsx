'use client';

import React from 'react';
import { LayoutGroup, motion, useReducedMotion, type Variants } from 'motion/react';

/**
 * Staggered grid entrance used by every product / category grid.
 *
 *  - Cards rise, scale up and fade in one after another with a soft spring
 *    as the grid scrolls into view (once).
 *  - `layout="position"` makes cards glide to their new cell when the grid
 *    reflows (e.g. switching 2 / 3 / 4 columns) instead of snapping.
 *    Position-only, so images are never squashed during the move.
 *  - Changing `resetKey` (page, filters, sort) replays the entrance.
 *  - Honours prefers-reduced-motion by rendering a plain grid.
 *
 * Deliberately no `filter` / persistent transforms: those create a
 * containing block that would break `position: fixed` descendants.
 */

const containerVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 210, damping: 22, mass: 0.9 },
  },
};

export interface AnimatedGridProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds between each child's entrance. */
  stagger?: number;
  /** Seconds before the first child starts. */
  delay?: number;
  /** Replays the entrance whenever this value changes. */
  resetKey?: string | number;
  /** Class for each cell wrapper (defaults to full-height so cards align). */
  itemClassName?: string;
}

export function AnimatedGrid({
  children,
  className,
  stagger = 0.06,
  delay = 0.04,
  resetKey,
  itemClassName = 'h-full',
}: AnimatedGridProps) {
  const reduceMotion = useReducedMotion();
  const items = React.Children.toArray(children);

  if (reduceMotion) {
    return (
      <div className={className}>
        {items.map((child, i) => (
          <div key={React.isValidElement(child) && child.key != null ? child.key : i} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <LayoutGroup>
      <motion.div
        key={resetKey}
        className={className}
        variants={containerVariants(stagger, delay)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.05 }}
      >
        {items.map((child, i) => (
          <motion.div
            key={React.isValidElement(child) && child.key != null ? child.key : i}
            variants={itemVariants}
            layout="position"
            className={itemClassName}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    </LayoutGroup>
  );
}
