<script setup lang="ts">
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { DashboardMP } from '~/composables/useDashboard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps<{ mps: DashboardMP[] }>();

const { selectedMPId } = useSelectedMP();

const chartData = computed(() => {
  const anySelected = selectedMPId.value !== null;
  return {
    labels: props.mps.map((mp) => mp.name.split(' ').pop()),
    datasets: [
      {
        label: 'Total declared (£)',
        data: props.mps.map((mp) => mp.totalAmount),
        backgroundColor: props.mps.map((mp) =>
          !anySelected || mp.parliamentId === selectedMPId.value ? '#6366f1cc' : '#6366f133'
        ),
        borderColor: props.mps.map((mp) =>
          mp.parliamentId === selectedMPId.value ? '#a5b4fc' : '#6366f1'
        ),
        borderWidth: props.mps.map((mp) =>
          mp.parliamentId === selectedMPId.value ? 2 : 1
        ),
        borderRadius: 4,
      },
    ],
  };
});

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_event: any, elements: any[]) => {
    if (elements.length === 0) return;
    const mp = props.mps[elements[0].index];
    if (mp) selectedMPId.value = mp.parliamentId;
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `£${ctx.raw.toLocaleString()}`,
      },
    },
  },
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a2d3a' } },
    y: {
      ticks: { color: '#94a3b8', callback: (v: any) => `£${(v / 1000).toFixed(0)}k` },
      grid: { color: '#2a2d3a' },
    },
  },
}));
</script>

<template>
  <div style="height: 320px">
    <Bar :data="chartData" :options="options" style="cursor: pointer" />
  </div>
</template>
