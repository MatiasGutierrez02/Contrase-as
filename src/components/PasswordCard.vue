<script setup lang="ts">
defineProps<{ id: number; name: string; accent: string }>();
</script>

<template>
  <RouterLink
    :to="`/passwords/${id}`"
    class="password-card"
    :style="{ '--accent': accent }"
    :aria-label="`Abrir ${name}`"
  >
    <span class="password-card__avatar" aria-hidden="true">{{
      name.charAt(0).toUpperCase()
    }}</span>
    <span class="password-card__name">{{ name }}</span>
    <svg class="password-card__arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  </RouterLink>
</template>
