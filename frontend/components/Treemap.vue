<script setup lang="ts">
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { TreemapChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { DashboardMP } from '~/composables/useDashboard';

use([TreemapChart, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ mps: DashboardMP[]; party: string }>();

const chartRef = ref();

interface SelectedItem {
  type: 'mp' | 'company';
  name: string;
  amount: number;
  mpName?: string;
  interests: DashboardMP['interests'];
  braveQuery: string;
}

const selected = ref<SelectedItem | null>(null);

const { selectedMPId } = useSelectedMP();

// Build MP lookup for click handler
const mpByName = computed(() => {
  const m = new Map<string, DashboardMP>();
  for (const mp of props.mps) m.set(mp.name, mp);
  return m;
});

const option = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: {
    enterable: false,
    confine: true,
    formatter: (info: any) => {
      const d = info.data ?? {};
      const name: string = info.name ?? '';
      const val: number = info.value ?? 0;

      let html = `<div style="max-width:300px">`;
      html += `<div style="font-weight:700;font-size:13px;margin-bottom:4px">${name}</div>`;
      if (val > 0) {
        html += `<div style="color:#a5b4fc;font-size:12px;margin-bottom:6px">£${Number(val).toLocaleString()}</div>`;
      }
      if (d.rawText) {
        html += `<div style="font-size:11px;color:#94a3b8;line-height:1.5;white-space:normal">${d.rawText}</div>`;
      }
      if (d.category) {
        html += `<div style="margin-top:5px;font-size:10px;color:#6366f1">${d.category}</div>`;
      }
      if (d.interestCount && !d.rawText) {
        html += `<div style="font-size:11px;color:#94a3b8">${d.interestCount} declared interests</div>`;
      }
      html += `</div>`;
      return html;
    },
  },
  series: [
    {
      type: 'treemap',
      width: '100%',
      height: '100%',
      roam: 'zoom',
      nodeClick: 'zoomToNode',
      drillDownIcon: '▸',
      leafDepth: 2,
      // Deep, saturated palette — all dark enough for white text
      color: ['#3730a3','#065f46','#7c2d12','#1e3a5f','#4a1942','#14532d','#713f12','#1e40af','#064e3b','#581c87'],
      label: {
        show: true,
        formatter: '{b}',
        color: '#f8fafc',
        fontWeight: '600',
        fontSize: 11,
        overflow: 'truncate',
        ellipsis: true,
        textBorderColor: 'rgba(0,0,0,0.7)',
        textBorderWidth: 2,
      },
      upperLabel: {
        show: true,
        height: 28,
        color: '#f8fafc',
        fontWeight: 'bold',
        fontSize: 12,
        overflow: 'truncate',
        textBorderColor: 'rgba(0,0,0,0.7)',
        textBorderWidth: 2,
      },
      breadcrumb: {
        show: true,
        height: 28,
        top: 0,
        itemStyle: {
          color: '#1e293b',
          borderColor: '#334155',
          shadowBlur: 0,
          textStyle: { color: '#e2e8f0', fontSize: 11 },
        },
      },
      itemStyle: { borderColor: '#0f1117', borderWidth: 2, gapWidth: 2 },
      levels: [
        { itemStyle: { borderWidth: 4, borderColor: '#0f1117', gapWidth: 4 }, upperLabel: { show: true } },
        { itemStyle: { borderWidth: 2, borderColor: '#0f1117', gapWidth: 2 }, colorSaturation: [0.6, 0.9] },
        { itemStyle: { borderWidth: 1, borderColor: '#0f1117', gapWidth: 1 }, colorSaturation: [0.5, 0.85] },
      ],
      data: [
        {
          name: props.party,
          value: props.mps.reduce((s, mp) => s + Math.sqrt(mp.totalAmount || mp.interestCount || 1), 0),
          children: props.mps.map((mp) => ({
            name: mp.name,
            value: Math.sqrt(mp.totalAmount || mp.interestCount || 1),
            interestCount: mp.interestCount,
            children: mp.interests
              .filter((i) => i.companyName)
              .map((i) => ({
                name: i.companyName,
                value: Math.sqrt(i.amountGbp ?? 1),
                rawText: i.rawText,
                category: i.category,
                mpName: mp.name,
                amountGbp: i.amountGbp,
              })),
          })),
        },
      ],
    },
  ],
}));

function handleClick(params: any) {
  const d = params.data;
  if (!d || d.name === props.party) return;

  const mp = mpByName.value.get(d.name);
  if (mp) {
    // MP-level node clicked
    selectedMPId.value = mp.parliamentId;
    selected.value = {
      type: 'mp',
      name: mp.name,
      amount: mp.totalAmount,
      interests: mp.interests,
      braveQuery: `${mp.name} MP financial interests Register`,
    };
  } else if (d.rawText !== undefined) {
    // Company leaf node
    selected.value = {
      type: 'company',
      name: d.name,
      mpName: d.mpName,
      amount: d.amountGbp ?? 0,
      interests: [{
        category: d.category,
        rawText: d.rawText,
        companyName: d.name,
        amountGbp: d.amountGbp,
        company: null,
      }],
      braveQuery: `${d.name} UK company investment politicians`,
    };
  }
}

function resetZoom() {
  chartRef.value?.dispatchAction({ type: 'treemapRootToNode', seriesIndex: 0 });
}

function openBrave() {
  if (!selected.value) return;
  window.open(`https://search.brave.com/search?q=${encodeURIComponent(selected.value.braveQuery)}`, '_blank', 'noopener');
}

const { isMobile } = useIsMobile();
</script>

<template>
  <div style="position: relative">
    <!-- Zoom controls -->
    <div style="position: absolute; top: 36px; right: 10px; z-index: 10; display: flex; flex-direction: column; gap: 4px">
      <button
        title="Reset zoom"
        style="width: 36px; height: 36px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center"
        @click="resetZoom"
      >
        ⊙
      </button>
    </div>

    <v-chart
      ref="chartRef"
      :option="option"
      style="height: 460px; width: 100%"
      autoresize
      @click="handleClick"
    />

    <!-- Summary panel -->
    <Transition :name="isMobile ? 'slide-up' : 'slide'">
      <div
        v-if="selected"
        :style="isMobile
          ? 'position:absolute;bottom:0;left:0;right:0;background:#1a1d27f5;border-top:1px solid #2a2d3a;border-radius:12px 12px 0 0;overflow:hidden;backdrop-filter:blur(10px);z-index:20'
          : 'position:absolute;top:40px;left:12px;width:300px;background:#1a1d27ee;border:1px solid #2a2d3a;border-radius:10px;overflow:hidden;backdrop-filter:blur(8px);z-index:20'"
      >
        <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #2a2d3a">
          <div>
            <div style="font-size: 10px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px">
              {{ selected.type === 'mp' ? 'MP' : 'Interest' }}
              <span v-if="selected.mpName" style="color: #475569"> · {{ selected.mpName }}</span>
            </div>
            <div style="font-weight: 600; font-size: 13px; line-height: 1.3; color: #f1f5f9">{{ selected.name }}</div>
          </div>
          <button style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 0 0 8px" @click="selected = null">×</button>
        </div>

        <div style="padding: 10px 14px; max-height: 300px; overflow-y: auto">
          <div v-if="selected.amount" style="font-size: 20px; font-weight: 700; color: #a5b4fc; margin-bottom: 6px">
            £{{ selected.amount.toLocaleString() }}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 10px">
            {{ selected.interests.length }} declared interest{{ selected.interests.length !== 1 ? 's' : '' }}
          </div>

          <div
            v-for="(interest, i) in selected.interests.slice(0, 6)"
            :key="i"
            style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #1e293b"
          >
            <div style="font-size: 10px; color: #6366f1; margin-bottom: 2px">{{ interest.category }}</div>
            <div v-if="interest.companyName" style="font-size: 12px; font-weight: 500; color: #e2e8f0; margin-bottom: 2px">
              {{ interest.companyName }}
              <span v-if="interest.amountGbp" style="color: #a5b4fc"> · £{{ interest.amountGbp.toLocaleString() }}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.4">{{ interest.rawText }}</div>
          </div>
          <div v-if="selected.interests.length > 6" style="font-size: 11px; color: #64748b">
            + {{ selected.interests.length - 6 }} more
          </div>
        </div>

        <div style="padding: 10px 14px; border-top: 1px solid #2a2d3a">
          <button
            style="width: 100%; padding: 8px; background: #e1421b; border: none; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px"
            @click="openBrave"
          >
            <span>🦁</span> Search on Brave
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-6px); }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.22s ease, opacity 0.15s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
