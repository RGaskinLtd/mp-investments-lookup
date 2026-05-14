const STORAGE_KEY = 'mp-red-flags';

export function useRedFlags() {
  const flags = ref<string[]>([]);

  onMounted(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) flags.value = JSON.parse(stored);
    } catch {}
  });

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags.value));
  }

  function addFlag(name: string) {
    const t = name.trim();
    if (!t || flags.value.some((f) => f.toLowerCase() === t.toLowerCase())) return;
    flags.value = [...flags.value, t];
    persist();
  }

  function removeFlag(name: string) {
    flags.value = flags.value.filter((f) => f !== name);
    persist();
  }

  function isFlagged(companyName: string | null): boolean {
    if (!companyName || flags.value.length === 0) return false;
    const lower = companyName.toLowerCase();
    return flags.value.some((f) => {
      const fl = f.toLowerCase();
      return lower.includes(fl) || fl.includes(lower);
    });
  }

  function mpHasFlag(interests: Array<{ companyName: string | null }>): boolean {
    return interests.some((i) => isFlagged(i.companyName));
  }

  return { flags, addFlag, removeFlag, isFlagged, mpHasFlag };
}
