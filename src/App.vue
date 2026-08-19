<script setup lang="ts">
import { RouterView } from "vue-router";
import PwaStatus from "@/components/PwaStatus.vue";
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <PwaStatus />
</template>
