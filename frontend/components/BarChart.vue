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

const chartData = computed(() => ({
  labels: props.mps.map((mp) => mp.name.split(' ').pop()),
  datasets: [
    {
      label: 'Total declared (£)',
      data: props.mps.map((mp) => mp.totalAmount),
      backgroundColor: '#6366f1cc',
      borderColor: '#6366f1',
      borderWidth: 1,
      borderRadius: 4,
    },
  ],
}));

const options = {
  responsive: true,
  maintainAspectRatio: false,
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
};
</script>

<template>
  <div style="height: 320px">
    <Bar :data="chartData" :options="options" />
  </div>
</template>
