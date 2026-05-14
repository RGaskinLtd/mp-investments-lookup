<script setup lang="ts">
import type { DashboardMP } from '~/composables/useDashboard';

const props = defineProps<{ mps: DashboardMP[] }>();

const { isFlagged, mpHasFlag } = useRedFlags();
const { selectedMPId } = useSelectedMP();

const INVESTMENT_CATEGORIES = [
  '7. (i) Shareholdings',
  '7. (ii) Other shareholdings',
  '6. Land and property',
  '1. Employment and earnings',
];

const ALL_CATEGORIES = computed(() => {
  const set = new Set<string>();
  for (const mp of props.mps) {
    for (const i of mp.interests) {
      if (i.category) set.add(i.category);
    }
  }
  return [...set].sort();
});

const enabledCategories = ref<Set<string>>(new Set());

// Prime with investment-relevant categories on first load
watch(
  ALL_CATEGORIES,
  (cats) => {
    if (enabledCategories.value.size === 0) {
      const defaults = cats.filter((c) =>
        INVESTMENT_CATEGORIES.some((ic) => c.toLowerCase().includes(ic.toLowerCase().slice(0, 12)))
      );
      enabledCategories.value = new Set(defaults.length ? defaults : cats);
    }
  },
  { immediate: true }
);

function toggleCategory(cat: string) {
  const next = new Set(enabledCategories.value);
  next.has(cat) ? next.delete(cat) : next.add(cat);
  enabledCategories.value = next;
}

const filteredMPs = computed(() =>
  props.mps
    .map((mp) => ({
      ...mp,
      filtered: mp.interests.filter((i) => i.category && enabledCategories.value.has(i.category)),
    }))
    .filter((mp) => mp.filtered.length > 0)
);

const expanded = ref<Set<number>>(new Set());
function toggleMP(id: number) {
  const next = new Set(expanded.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded.value = next;
  selectedMPId.value = id;
}

function categoryColour(cat: string): string {
  if (cat.startsWith('7.')) return '#6366f1';
  if (cat.startsWith('1.')) return '#22d3ee';
  if (cat.startsWith('6.')) return '#f59e0b';
  return '#94a3b8';
}
</script>

<template>
  <div>
    <!-- Category filter chips -->
    <div class="chip-row" style="margin-bottom: 1.25rem">
      <button
        v-for="cat in ALL_CATEGORIES"
        :key="cat"
        :style="{
          padding: '4px 10px',
          borderRadius: '999px',
          border: `1px solid ${categoryColour(cat)}`,
          background: enabledCategories.has(cat) ? categoryColour(cat) + '33' : 'transparent',
          color: enabledCategories.has(cat) ? '#e2e8f0' : '#64748b',
          cursor: 'pointer',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }"
        @click="toggleCategory(cat)"
      >
        {{ cat }}
      </button>
    </div>

    <p v-if="filteredMPs.length === 0" style="color: var(--text-muted); font-size: 13px">
      No interests match the selected categories.
    </p>

    <!-- Per-MP rows -->
    <div
      v-for="mp in filteredMPs"
      :key="mp.parliamentId"
      :style="{
        marginBottom: '8px',
        border: mpHasFlag(mp.filtered) ? '1px solid #ef444455' : '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }"
    >
      <!-- MP header -->
      <button
        :style="{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: mpHasFlag(mp.filtered) ? '#ef44440d' : 'var(--surface)',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          textAlign: 'left',
        }"
        @click="toggleMP(mp.parliamentId)"
      >
        <img
          v-if="mp.thumbnailUrl"
          :src="mp.thumbnailUrl"
          :alt="mp.name"
          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0"
        />
        <div style="flex: 1; min-width: 0">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight: 600; font-size: 13px">{{ mp.name }}</span>
            <span
              v-if="mpHasFlag(mp.filtered)"
              style="padding:1px 6px;border-radius:4px;background:#ef444420;border:1px solid #ef444455;color:#f87171;font-size:10px;font-weight:700"
            >⚠ Flagged</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted)">{{ mp.constituency ?? '' }}</div>
        </div>
        <div style="display: flex; gap: 16px; flex-shrink: 0; font-size: 12px; color: var(--text-muted)">
          <span>{{ mp.filtered.length }} interest{{ mp.filtered.length !== 1 ? 's' : '' }}</span>
          <span v-if="mp.filtered.some((i) => i.amountGbp)">
            £{{ mp.filtered.reduce((s, i) => s + (i.amountGbp ?? 0), 0).toLocaleString() }}
          </span>
          <span>{{ expanded.has(mp.parliamentId) ? '▲' : '▼' }}</span>
        </div>
      </button>

      <!-- Interest rows -->
      <div v-if="expanded.has(mp.parliamentId)">
        <div
          v-for="(interest, idx) in mp.filtered"
          :key="idx"
          :style="{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '8px',
            alignItems: 'start',
            background: isFlagged(interest.companyName) ? '#ef44440a' : (idx % 2 === 0 ? 'transparent' : '#ffffff08'),
            borderLeft: isFlagged(interest.companyName) ? '3px solid #ef4444' : '3px solid transparent',
          }"
        >
          <div>
            <span
              :style="{
                display: 'inline-block',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '10px',
                background: categoryColour(interest.category) + '22',
                color: categoryColour(interest.category),
                marginBottom: '5px',
                border: `1px solid ${categoryColour(interest.category)}44`,
              }"
            >
              {{ interest.category }}
            </span>
            <div
              v-if="interest.companyName"
              style="font-size: 13px; font-weight: 500; margin-bottom: 3px"
            >
              {{ interest.companyName }}
              <span
                v-if="interest.company?.status"
                :style="{
                  marginLeft: '6px',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: interest.company.status === 'active' ? '#16a34a22' : '#94a3b822',
                  color: interest.company.status === 'active' ? '#4ade80' : '#94a3b8',
                }"
              >
                {{ interest.company.status }}
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); line-height: 1.5; max-width: 680px">
              {{ interest.rawText }}
            </div>
          </div>
          <div
            v-if="interest.amountGbp"
            style="font-size: 13px; font-weight: 600; color: #a5b4fc; white-space: nowrap; text-align: right"
          >
            £{{ interest.amountGbp.toLocaleString() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
