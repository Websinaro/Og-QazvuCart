/**
 * Spawns a small clone of a product image that flies from its source
 * element (e.g. the card's image) to the header cart icon, then removes
 * itself. Purely visual — no state changes here. Safe to call from any
 * click handler; does nothing if the cart icon isn't on screen (e.g. a
 * layout without the Header, or the tab lost focus mid-animation).
 */
export function flyToCart(sourceEl: HTMLElement, imageUrl: string) {
  if (typeof window === 'undefined') return;

  const target = document.getElementById('header-cart-icon');
  if (!target) return;

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const size = 56;
  const startX = sourceRect.left + sourceRect.width / 2 - size / 2;
  const startY = sourceRect.top + sourceRect.height / 2 - size / 2;
  const endX = targetRect.left + targetRect.width / 2 - size / 2;
  const endY = targetRect.top + targetRect.height / 2 - size / 2;

  const ghost = document.createElement('div');
  ghost.style.position = 'fixed';
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  ghost.style.borderRadius = '12px';
  ghost.style.overflow = 'hidden';
  ghost.style.zIndex = '9999';
  ghost.style.pointerEvents = 'none';
  ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
  ghost.style.setProperty('--fly-translate', `translate(${endX - startX}px, ${endY - startY}px)`);
  ghost.className = 'animate-fly-to-cart';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  ghost.appendChild(img);

  document.body.appendChild(ghost);

  const cleanup = () => {
    ghost.remove();
    target.classList.remove('animate-cart-bump');
    // Force reflow so the bump animation can be retriggered next time.
    void target.offsetWidth;
    target.classList.add('animate-cart-bump');
    setTimeout(() => target.classList.remove('animate-cart-bump'), 450);
  };

  ghost.addEventListener('animationend', cleanup, { once: true });
  // Fallback in case animationend doesn't fire (e.g. reduced-motion users
  // where the browser may skip the animation entirely).
  setTimeout(cleanup, 800);
}
