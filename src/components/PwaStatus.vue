<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRegisterSW } from "virtual:pwa-register/vue";

const online = ref(navigator.onLine);
const updating = ref(false);
const updateError = ref("");
const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true });

function updateConnectionStatus() {
  online.value = navigator.onLine;
}

async function applyUpdate() {
  updating.value = true;
  updateError.value = "";
  try {
    await updateServiceWorker();
  } catch {
    updateError.value = "No se pudo actualizar. Intentá nuevamente.";
  } finally {
    updating.value = false;
  }
}

onMounted(() => {
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
});

onBeforeUnmount(() => {
  window.removeEventListener("online", updateConnectionStatus);
  window.removeEventListener("offline", updateConnectionStatus);
});
</script>

<template>
  <aside v-if="needRefresh" class="pwa-status" role="status" aria-live="polite">
    <span
      ><strong>Actualización disponible</strong
      ><small>{{
        updateError || "Se aplicará cuando vos decidas."
      }}</small></span
    >
    <button type="button" :disabled="updating" @click="applyUpdate">
      {{ updating ? "Actualizando…" : "Actualizar" }}
    </button>
    <button
      class="pwa-status__dismiss"
      type="button"
      aria-label="Más tarde"
      @click="needRefresh = false"
    >
      ×
    </button>
  </aside>
  <aside
    v-else-if="!online"
    class="pwa-status pwa-status--offline"
    role="status"
    aria-live="polite"
  >
    <span
      ><strong>Sin conexión</strong
      ><small>Tu bóveda local sigue disponible.</small></span
    >
  </aside>
</template>
