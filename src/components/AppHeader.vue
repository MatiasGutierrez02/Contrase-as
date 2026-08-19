<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; eyebrow?: string; backTo?: string }>(),
  {
    eyebrow: undefined,
    backTo: undefined,
  },
);
</script>

<template>
  <header class="app-header">
    <RouterLink
      v-if="backTo"
      :to="backTo"
      class="icon-button"
      aria-label="Volver"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
    </RouterLink>
    <div class="app-header__copy">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
    </div>
    <slot />
  </header>
</template>
