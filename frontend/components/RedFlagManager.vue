<script setup lang="ts">
const { flags, addFlag, removeFlag } = useRedFlags();

const input = ref('');
const open = ref(false);

function submit() {
  if (!input.value.trim()) return;
  addFlag(input.value);
  input.value = '';
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') submit();
}
</script>

<template>
  <div class="rfm-wrap">
    <!-- Toggle row -->
    <button class="rfm-toggle" @click="open = !open">
      <span class="rfm-toggle__icon">⚑</span>
      <span class="rfm-toggle__label">Red Flag watchlist</span>
      <span v-if="flags.length" class="rfm-count">{{ flags.length }}</span>
      <span class="rfm-toggle__caret" :style="open ? 'transform:rotate(180deg)' : ''">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>

    <!-- Panel -->
    <Transition name="expand">
      <div v-if="open" class="rfm-panel">
        <!-- Add input -->
        <div class="rfm-add">
          <input
            v-model="input"
            class="rfm-input"
            placeholder="Company or organisation name…"
            @keydown="onKey"
          />
          <button class="rfm-add-btn" :disabled="!input.trim()" @click="submit">
            Add flag
          </button>
        </div>

        <!-- Empty state -->
        <p v-if="flags.length === 0" class="rfm-empty">
          No flags yet. Any MP with a matching investment will be highlighted.
        </p>

        <!-- Flag chips -->
        <div v-else class="rfm-chips">
          <span v-for="flag in flags" :key="flag" class="rfm-chip">
            <span class="rfm-chip__icon">⚠</span>
            {{ flag }}
            <button class="rfm-chip__remove" @click="removeFlag(flag)" aria-label="Remove">×</button>
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rfm-wrap {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
  margin-bottom: 1.25rem;
}

/* Toggle button */
.rfm-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}
.rfm-toggle:hover { background: #ffffff08; }

.rfm-toggle__icon { font-size: 14px; color: #ef4444; }
.rfm-toggle__label { font-weight: 500; flex: 1; }
.rfm-toggle__caret { color: var(--text-muted); transition: transform 0.2s; display: flex; }

.rfm-count {
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Panel */
.rfm-panel {
  padding: 0 14px 14px;
  border-top: 1px solid var(--border);
}

.rfm-add {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  margin-bottom: 10px;
}

.rfm-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: 0;
}
.rfm-input::placeholder { color: #475569; }
.rfm-input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px #ef444422;
}

.rfm-add-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.rfm-add-btn:hover:not(:disabled) { background: #dc2626; }
.rfm-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.rfm-empty {
  font-size: 12px;
  color: #475569;
  font-style: italic;
}

/* Chips */
.rfm-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.rfm-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 7px;
  background: #ef444418;
  border: 1px solid #ef444444;
  border-radius: 6px;
  font-size: 12px;
  color: #fca5a5;
}
.rfm-chip__icon { font-size: 11px; }
.rfm-chip__remove {
  background: none;
  border: none;
  color: #f87171;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 0 0 0 2px;
  opacity: 0.7;
}
.rfm-chip__remove:hover { opacity: 1; }

/* Transition */
.expand-enter-active, .expand-leave-active { transition: opacity 0.15s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; }
</style>
