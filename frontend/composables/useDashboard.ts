export interface Party {
  id: number;
  name: string;
}

export interface DashboardMP {
  parliamentId: number;
  name: string;
  party: string;
  constituency: string | null;
  thumbnailUrl: string | null;
  totalAmount: number;
  interestCount: number;
  interests: Array<{
    category: string;
    rawText: string;
    companyName: string | null;
    amountGbp: number | null;
    company: {
      companyNumber: string;
      name: string;
      status: string | null;
      sicCodes: string[];
    } | null;
  }>;
}

export interface DashboardData {
  party: string;
  mps: DashboardMP[];
  generatedAt: string;
}

export function useDashboard() {
  const config = useRuntimeConfig();
  const data = ref<DashboardData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetch(party: Party, limit: number) {
    loading.value = true;
    error.value = null;
    try {
      const result = await $fetch<DashboardData>(
        `/api/dashboard?partyId=${party.id}&partyName=${encodeURIComponent(party.name)}&limit=${limit}`
      );
      data.value = result;
    } catch (e: any) {
      error.value = e?.message ?? 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  async function fetchParties(): Promise<Party[]> {
    return $fetch<Party[]>(`/api/parties`);
  }

  return { data, loading, error, fetch, fetchParties };
}
