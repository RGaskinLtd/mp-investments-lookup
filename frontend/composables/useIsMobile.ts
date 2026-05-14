export function useIsMobile(breakpoint = 640) {
  const isMobile = ref(false);

  onMounted(() => {
    const check = () => { isMobile.value = window.innerWidth < breakpoint; };
    check();
    window.addEventListener('resize', check, { passive: true });
    onUnmounted(() => window.removeEventListener('resize', check));
  });

  return { isMobile };
}
