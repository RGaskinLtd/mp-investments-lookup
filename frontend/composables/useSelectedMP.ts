// Module-level ref — shared across all component instances in the same app
const selectedMPId = ref<number | null>(null);

export const useSelectedMP = () => {
  return { selectedMPId };
};
