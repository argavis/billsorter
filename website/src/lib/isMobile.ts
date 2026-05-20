export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Mobile = schmal ODER Touch-only ODER coarse pointer
  const narrow = window.innerWidth < 768;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return narrow || coarse;
};
