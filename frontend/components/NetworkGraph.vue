<script setup lang="ts">
import * as d3 from 'd3';
import type { DashboardMP } from '~/composables/useDashboard';

const props = defineProps<{ mps: DashboardMP[] }>();

const { isFlagged, mpHasFlag, flags } = useRedFlags();
const { selectedMPId } = useSelectedMP();

const svgRef = ref<SVGSVGElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);

// Kept across renders so the watch can center after render/sim-settle
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
let liveNodes: NodeDatum[] = [];

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'mp' | 'company';
  interests?: DashboardMP['interests'];
  totalAmount?: number;
  rawInterests?: DashboardMP['interests'];
  radius: number; // computed in render()
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  amount: number;
  mpName: string;
  category: string;
}

interface SelectedNode {
  type: 'mp' | 'company';
  label: string;
  interests: DashboardMP['interests'];
  totalAmount: number;
  braveQuery: string;
}

const selected = ref<SelectedNode | null>(null);

function buildGraph() {
  const nodes: NodeDatum[] = [];
  const links: LinkDatum[] = [];
  const nodeSet = new Set<string>();

  for (const mp of props.mps) {
    const mpId = `mp-${mp.parliamentId}`;
    if (!nodeSet.has(mpId)) {
      nodes.push({ id: mpId, label: mp.name, type: 'mp', totalAmount: mp.totalAmount, interests: mp.interests, radius: 12 });
      nodeSet.add(mpId);
    }
    for (const interest of mp.interests) {
      if (!interest.companyName) continue;
      const compId = `co-${interest.companyName}`;
      if (!nodeSet.has(compId)) {
        nodes.push({ id: compId, label: interest.companyName, type: 'company', rawInterests: [], totalAmount: 0, radius: 6 });
        nodeSet.add(compId);
      }
      const compNode = nodes.find((n) => n.id === compId)!;
      compNode.rawInterests!.push(interest);
      compNode.totalAmount = (compNode.totalAmount ?? 0) + (interest.amountGbp ?? 0);
      links.push({ source: mpId, target: compId, amount: interest.amountGbp ?? 0, mpName: mp.name, category: interest.category });
    }
  }
  return { nodes, links };
}

function render() {
  const el = svgRef.value;
  if (!el) return;

  const { nodes, links } = buildGraph();
  const width = el.clientWidth || 900;
  const height = 680;

  // Scale company node radii by total invested amount (sqrt so area ∝ amount)
  const companyNodes = nodes.filter((n) => n.type === 'company');
  const maxAmount = d3.max(companyNodes, (n) => n.totalAmount ?? 0) ?? 1;
  const rScale = d3.scaleSqrt().domain([0, maxAmount]).range([5, 26]).clamp(true);
  for (const n of companyNodes) {
    n.radius = rScale(n.totalAmount ?? 0);
  }

  d3.select(el).selectAll('*').remove();

  const svg = d3.select(el).attr('width', width).attr('height', height);
  const g = svg.append('g');

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.15, 6])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  zoomBehavior = zoom;

  // Zoom buttons
  const ctrl = svg.append('g').attr('transform', `translate(${width - 44}, 12)`);
  const makeBtn = (g: d3.Selection<SVGGElement, unknown, null, undefined>, y: number, glyph: string) => {
    const b = g.append('g').attr('transform', `translate(0,${y})`).style('cursor', 'pointer');
    b.append('rect').attr('width', 28).attr('height', 28).attr('rx', 6).attr('fill', '#1a1d27').attr('stroke', '#3a3d4a');
    b.append('text').attr('x', 14).attr('y', 19).attr('text-anchor', 'middle').attr('fill', '#cbd5e1').attr('font-size', 16).text(glyph);
    return b;
  };
  makeBtn(ctrl, 0, '+').on('click', () => svg.transition().duration(220).call(zoom.scaleBy, 1.45));
  makeBtn(ctrl, 34, '−').on('click', () => svg.transition().duration(220).call(zoom.scaleBy, 0.7));
  makeBtn(ctrl, 68, '⊙').on('click', () => svg.transition().duration(280).call(zoom.transform, d3.zoomIdentity));

  liveNodes = nodes; // D3 mutates this array in-place, so the ref stays live

  // ── Simulation ──────────────────────────────────────────────────────────────
  // Link distance scales with company node size so bigger nodes sit further out
  const sim = d3.forceSimulation<NodeDatum>(nodes)
    .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id((d) => d.id)
      .distance((l) => {
        const target = l.target as NodeDatum;
        return 160 + (target.radius ?? 6) * 3;
      })
      .strength(0.4))
    .force('charge', d3.forceManyBody().strength((d) => (d as NodeDatum).type === 'mp' ? -1200 : -600))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.04))
    .force('x', d3.forceX(width / 2).strength(0.02))
    .force('y', d3.forceY(height / 2).strength(0.02))
    .force('collision', d3.forceCollide<NodeDatum>((d) => d.radius + 36))
    .alphaDecay(0.015);

  // ── Links ───────────────────────────────────────────────────────────────────
  const link = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', '#334155')
    .attr('stroke-width', (d) => (d.amount > 0 ? Math.min(1 + d.amount / 25000, 4) : 1.2))
    .attr('stroke-opacity', 0.7);

  // ── Node groups ─────────────────────────────────────────────────────────────
  const nodeG = g.append('g')
    .selectAll<SVGGElement, NodeDatum>('g')
    .data(nodes)
    .join('g')
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      if (d.type === 'mp') {
        selected.value = { type: 'mp', label: d.label, interests: d.interests ?? [], totalAmount: d.totalAmount ?? 0, braveQuery: `${d.label} MP financial interests declared` };
      } else {
        const ints = d.rawInterests ?? [];
        selected.value = { type: 'company', label: d.label, interests: ints, totalAmount: ints.reduce((s, i) => s + (i.amountGbp ?? 0), 0), braveQuery: `${d.label} UK company politicians investment` };
      }
    })
    .call(
      d3.drag<SVGGElement, NodeDatum>()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Circle — red for flagged nodes, normal colours otherwise
  nodeG.append('circle')
    .attr('r', (d) => d.radius)
    .attr('fill', (d) => {
      if (d.type === 'company' && isFlagged(d.label)) return '#dc2626';
      if (d.type === 'mp' && mpHasFlag(d.interests ?? [])) return '#7f1d1d';
      return d.type === 'mp' ? '#6366f1' : '#0e9488';
    })
    .attr('stroke', (d) => {
      if (d.type === 'company' && isFlagged(d.label)) return '#fca5a5';
      if (d.type === 'mp' && mpHasFlag(d.interests ?? [])) return '#ef4444';
      return d.type === 'mp' ? '#a5b4fc' : '#2dd4bf';
    })
    .attr('stroke-width', (d) => {
      const flagged = d.type === 'company' ? isFlagged(d.label) : mpHasFlag(d.interests ?? []);
      return flagged ? 2.5 : 2;
    });

  // ⚠ warning symbol on flagged nodes
  nodeG.each(function (d) {
    const isFlaggedNode = d.type === 'company'
      ? isFlagged(d.label)
      : mpHasFlag(d.interests ?? []);
    if (!isFlaggedNode) return;
    d3.select(this).append('text')
      .text('⚠')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', Math.max(d.radius * 0.9, 8))
      .attr('fill', '#fff')
      .style('pointer-events', 'none');
  });

  // Label boxes — vertically and horizontally centred on a rect pinned beside the circle
  const PAD_X = 7, PAD_Y = 4;
  const FONT_SIZE_MP = 11, FONT_SIZE_CO = 10;
  const CHAR_W_MP = 6.4, CHAR_W_CO = 5.8; // px-per-char estimates at those font sizes

  nodeG.each(function (d) {
    const group = d3.select(this);
    const isMP = d.type === 'mp';
    const full = d.label;
    const display = full.length > 50 ? full.slice(0, 50) + '…' : full;
    const fontSize = isMP ? FONT_SIZE_MP : FONT_SIZE_CO;
    const charW = isMP ? CHAR_W_MP : CHAR_W_CO;
    const boxW = display.length * charW + PAD_X * 2;
    const boxH = fontSize + PAD_Y * 2;
    // Pin left edge of box just past the circle radius, vertically centred on node origin
    const offsetX = d.radius + 5;

    group.append('rect')
      .attr('x', offsetX)
      .attr('y', -boxH / 2)
      .attr('width', boxW)
      .attr('height', boxH)
      .attr('rx', 4)
      .attr('fill', isMP ? '#312e81' : '#134e4a')
      .attr('fill-opacity', 0.93);

    group.append('text')
      .text(display)
      .attr('x', offsetX + boxW / 2)   // horizontal centre of box
      .attr('y', 0)                     // vertical centre of box (node origin)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', fontSize)
      .attr('font-weight', isMP ? '600' : '400')
      .attr('fill', isMP ? '#e0e7ff' : '#ccfbf1')
      .style('pointer-events', 'none');

    // Native browser tooltip for truncated labels
    if (full.length > 50) {
      group.append('title').text(full);
    }
  });

  // ── Tick ────────────────────────────────────────────────────────────────────
  sim.on('tick', () => {
    link
      .attr('x1', (d) => (d.source as NodeDatum).x!)
      .attr('y1', (d) => (d.source as NodeDatum).y!)
      .attr('x2', (d) => (d.target as NodeDatum).x!)
      .attr('y2', (d) => (d.target as NodeDatum).y!);
    nodeG.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  sim.on('end', () => {
    if (selectedMPId.value != null) centerOnMP(selectedMPId.value);
  });
}

function centerOnMP(parliamentId: number) {
  if (!zoomBehavior || !svgRef.value) return;
  const node = liveNodes.find((n) => n.id === `mp-${parliamentId}`);
  if (!node || node.x == null || node.y == null) return;

  const el = svgRef.value;
  const width = el.clientWidth || 900;
  const height = 680;
  const scale = 1.8;

  d3.select(el)
    .transition()
    .duration(700)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity
        .translate(width / 2 - node.x * scale, height / 2 - node.y * scale)
        .scale(scale),
    );
}

function openBrave() {
  if (!selected.value) return;
  window.open(`https://search.brave.com/search?q=${encodeURIComponent(selected.value.braveQuery)}`, '_blank', 'noopener');
}

onMounted(render);
watch(() => props.mps, render, { deep: true });
watch(flags, render, { deep: true });
watch(selectedMPId, (id) => { if (id != null) centerOnMP(id); });

const { isMobile } = useIsMobile();
</script>

<template>
  <div ref="wrapRef" style="position: relative">
    <svg ref="svgRef" style="width: 100%; height: 680px; display: block" />

    <Transition :name="isMobile ? 'slide-up' : 'slide'">
      <div
        v-if="selected"
        :style="isMobile
          ? 'position:absolute;bottom:0;left:0;right:0;background:#1a1d27f5;border-top:1px solid #2a2d3a;border-radius:12px 12px 0 0;overflow:hidden;backdrop-filter:blur(10px);z-index:10'
          : 'position:absolute;top:12px;left:12px;width:300px;background:#1a1d27ee;border:1px solid #2a2d3a;border-radius:10px;overflow:hidden;backdrop-filter:blur(8px)'"
      >
        <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #2a2d3a">
          <div>
            <div style="font-size: 10px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px">
              {{ selected.type === 'mp' ? 'MP' : 'Company' }}
            </div>
            <div style="font-weight: 600; font-size: 13px; line-height: 1.3; color: #f1f5f9">{{ selected.label }}</div>
          </div>
          <button style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 0 0 8px" @click="selected = null">×</button>
        </div>

        <div style="padding: 10px 14px; max-height: 280px; overflow-y: auto">
          <div v-if="selected.totalAmount" style="font-size: 20px; font-weight: 700; color: #a5b4fc; margin-bottom: 6px">
            £{{ selected.totalAmount.toLocaleString() }}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 10px">
            {{ selected.interests.length }} declared interest{{ selected.interests.length !== 1 ? 's' : '' }}
          </div>

          <div v-for="(interest, i) in selected.interests.slice(0, 5)" :key="i" style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #1e293b">
            <div style="font-size: 10px; color: #6366f1; margin-bottom: 2px">{{ interest.category }}</div>
            <div v-if="interest.companyName" style="font-size: 12px; font-weight: 500; color: #e2e8f0; margin-bottom: 2px">
              {{ interest.companyName }}
              <span v-if="interest.amountGbp" style="color: #a5b4fc"> · £{{ interest.amountGbp.toLocaleString() }}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.4">
              {{ interest.rawText.slice(0, 120) }}{{ interest.rawText.length > 120 ? '…' : '' }}
            </div>
          </div>
          <div v-if="selected.interests.length > 5" style="font-size: 11px; color: #64748b">
            + {{ selected.interests.length - 5 }} more
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
