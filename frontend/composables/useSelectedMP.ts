export const useSelectedMP = () => {
  const selectedMPId = useState<number | null>('selectedMP', () => null);
  return { selectedMPId };
};
