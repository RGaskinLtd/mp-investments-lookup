<script setup lang="ts">
import { useDashboard, type Party } from '~/composables/useDashboard';

const { data, loading, error, fetch, fetchParties } = useDashboard();

const parties = ref<Party[]>([]);
const selectedParty = ref<Party>({ id: 15, name: 'Labour' });
const limit = ref(10);
const activeView = ref<'bar' | 'network' | 'treemap' | 'investments'>('bar');

onMounted(async () => {
  parties.value = await fetchParties();
  const labour = parties.value.find((p) => p.name === 'Labour');
  if (labour) selectedParty.value = labour;
  await fetch(selectedParty.value, limit.value);
});

async function refresh() {
  await fetch(selectedParty.value, limit.value);
}

const VIEW_LABELS: Record<string, string> = {
  bar: 'Bar chart',
  network: 'Network',
  treemap: 'Treemap',
  investments: 'Investments',
};

const sliderPercent = computed(() => ((limit.value - 5) / (50 - 5)) * 100);

const { isFlagged, mpHasFlag } = useRedFlags();
</script>

<template>
  <div class="container" style="padding-top: 1.75rem; padding-bottom: 4rem">

    <header style="margin-bottom: 1.75rem">
      <h1 style="font-size: clamp(1.1rem, 4vw, 1.5rem); font-weight: 700; margin-bottom: 0.3rem; letter-spacing: -0.01em">
        MP Financial Interests
      </h1>
      <p style="color: var(--text-muted); font-size: clamp(12px, 3vw, 13px); line-height: 1.5">
        Declared interests from the Register of Members' Financial Interests,
        cross-referenced with Companies House.
      </p>
    </header>

    <!-- Controls -->
    <div class="controls-card controls-row" style="margin-bottom: 1.25rem">

      <!-- Party selector -->
      <div class="ctrl-group">
        <label class="ctrl-label">Party</label>
        <div class="select-wrap">
          <select v-model="selectedParty" class="ctrl-select">
            <option v-for="p in parties" :key="p.id" :value="p">{{ p.name }}</option>
          </select>
          <span class="select-arrow">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>

      <!-- MPs slider -->
      <div class="ctrl-group">
        <label class="ctrl-label">
          Top MPs
          <span class="ctrl-badge">{{ limit }}</span>
        </label>
        <div class="slider-wrap">
          <input
            v-model.number="limit"
            type="range"
            min="5"
            max="50"
            step="5"
            class="ctrl-slider"
            :style="`--pct: ${sliderPercent}%`"
          />
          <div class="slider-ticks">
            <span v-for="n in [5,10,20,30,40,50]" :key="n" :class="['tick', limit >= n ? 'tick--active' : '']">{{ n }}</span>
          </div>
        </div>
      </div>

      <!-- Load button -->
      <button class="ctrl-btn" :disabled="loading" @click="refresh">
        <span v-if="loading" class="btn-spinner" />
        <span>{{ loading ? 'Loading…' : 'Load data' }}</span>
      </button>

    </div>

    <!-- Red flag watchlist -->
    <RedFlagManager />

    <!-- Error -->
    <div v-if="error" style="color: #f87171; margin-bottom: 1rem; font-size: 13px; padding: 10px 14px; background: #f8717115; border: 1px solid #f8717133; border-radius: 6px">
      {{ error }}
    </div>

    <!-- View tabs -->
    <div v-if="data" class="tab-row" style="margin-bottom: 1.25rem">
      <button
        v-for="view in (['bar', 'network', 'treemap', 'investments'] as const)"
        :key="view"
        :style="{
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          background: activeView === view ? 'var(--accent)' : 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: activeView === view ? '600' : '400',
        }"
        @click="activeView = view"
      >
        {{ VIEW_LABELS[view] }}
      </button>
    </div>

    <!-- Charts -->
    <div v-if="data" class="card" style="margin-bottom: 1.25rem; padding: 0; overflow: hidden">
      <BarChart v-if="activeView === 'bar'" :mps="data.mps" />
      <NetworkGraph v-else-if="activeView === 'network'" :mps="data.mps" />
      <Treemap v-else-if="activeView === 'treemap'" :mps="data.mps" :party="data.party" />
      <div v-else style="padding: 1rem">
        <InvestmentsBreakdown :mps="data.mps" />
      </div>
    </div>

    <!-- Summary table -->
    <div v-if="data" class="card">
      <div class="table-scroll">
        <table style="width: 100%; border-collapse: collapse; min-width: 360px">
          <thead>
            <tr style="color: var(--text-muted); font-size: 12px; text-align: left">
              <th style="padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap">MP</th>
              <th class="hide-mobile" style="padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap">Constituency</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap">Interests</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap">Total declared</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mp in data.mps" :key="mp.parliamentId" style="border-bottom: 1px solid var(--border)">
              <td style="padding: 10px 12px">
                <div style="display: flex; align-items: center; gap: 8px">
                  <img v-if="mp.thumbnailUrl" :src="mp.thumbnailUrl" :alt="mp.name"
                    style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0" />
                  <span style="font-size: 13px">{{ mp.name }}</span>
                  <span
                    v-if="mpHasFlag(mp.interests)"
                    title="Has flagged investment"
                    style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;background:#ef444420;border:1px solid #ef444455;color:#f87171;font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0"
                  >⚠ Flagged</span>
                </div>
              </td>
              <td class="hide-mobile" style="padding: 10px 12px; color: var(--text-muted); font-size: 13px">{{ mp.constituency ?? '—' }}</td>
              <td style="padding: 10px 12px; text-align: right; font-size: 13px">{{ mp.interestCount }}</td>
              <td style="padding: 10px 12px; text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap">
                {{ mp.totalAmount ? `£${mp.totalAmount.toLocaleString()}` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="font-size: 11px; color: var(--text-muted); margin-top: 8px; padding: 0 4px">
        Generated {{ data.generatedAt ? new Date(data.generatedAt).toLocaleString() : '' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* ── Controls card ───────────────────────────────────────────────────────── */
.controls-card {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
  padding: 1.25rem 1.25rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
}

/* ── Label + input group ─────────────────────────────────────────────────── */
.ctrl-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 150px; }

.ctrl-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ctrl-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

/* ── Custom select ───────────────────────────────────────────────────────── */
.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.ctrl-select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 9px 36px 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.ctrl-select:hover { border-color: #4b5563; }
.ctrl-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #6366f133; }

.select-arrow {
  position: absolute;
  right: 11px;
  color: var(--text-muted);
  pointer-events: none;
  display: flex;
  align-items: center;
}

/* ── Range slider ────────────────────────────────────────────────────────── */
.slider-wrap { display: flex; flex-direction: column; gap: 6px; }

.ctrl-slider {
  width: 100%;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent) var(--pct, 0%),
    #2a2d3a var(--pct, 0%),
    #2a2d3a 100%
  );
}
.ctrl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.ctrl-slider::-webkit-slider-thumb:hover,
.ctrl-slider:active::-webkit-slider-thumb {
  transform: scale(1.2);
  box-shadow: 0 0 0 4px #6366f133;
}
.ctrl-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  cursor: pointer;
}

.slider-ticks {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}
.tick {
  font-size: 10px;
  color: #475569;
  transition: color 0.15s;
}
.tick--active { color: var(--text-muted); }

/* ── Load button ─────────────────────────────────────────────────────────── */
.ctrl-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 2px 8px #6366f133;
  white-space: nowrap;
}
.ctrl-btn:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 4px 14px #6366f144;
  transform: translateY(-1px);
}
.ctrl-btn:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
.ctrl-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid #ffffff55;
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Mobile ──────────────────────────────────────────────────────────────── */
@media (max-width: 639px) {
  .controls-card { flex-direction: column; align-items: stretch; }
  .ctrl-group { min-width: unset; }
  .ctrl-btn { width: 100%; }
}
</style>
