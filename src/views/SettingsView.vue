<script setup lang="ts">
import { ref } from "vue";
import AppHeader from "@/components/AppHeader.vue";

const selectedTheme = ref("system");
const themes = [
  { id: "system", label: "Sistema" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Oscuro" },
];
</script>

<template>
  <main class="page settings-page">
    <AppHeader title="Configuración" back-to="/" />
    <section class="settings-section">
      <div class="section-heading">
        <span class="settings-icon settings-icon--purple">◐</span>
        <div>
          <h2>Tema</h2>
          <p>Elegí cómo querés ver la aplicación.</p>
        </div>
      </div>
      <div class="theme-selector" role="radiogroup" aria-label="Tema">
        <label v-for="theme in themes" :key="theme.id"
          ><input
            v-model="selectedTheme"
            type="radio"
            name="theme"
            :value="theme.id"
          /><span>{{ theme.label }}</span></label
        >
      </div>
      <p class="helper-text">
        La selección es visual. Por ahora la app sigue el tema de tu
        dispositivo.
      </p>
    </section>
    <section class="settings-section">
      <div class="section-heading">
        <span class="settings-icon settings-icon--blue">↕</span>
        <div>
          <h2>Tus datos</h2>
          <p>Mové tu bóveda de forma segura.</p>
        </div>
      </div>
      <button class="settings-row" type="button">
        <span
          ><strong>Importar</strong
          ><small>Restaurar desde un archivo</small></span
        ><span>›</span>
      </button>
      <button class="settings-row" type="button">
        <span
          ><strong>Exportar</strong
          ><small>Crear una copia de seguridad</small></span
        ><span>›</span>
      </button>
      <p class="helper-text">
        Importar y exportar estarán disponibles en una fase posterior.
      </p>
    </section>
    <section class="settings-section">
      <div class="section-heading">
        <span class="settings-icon settings-icon--green">i</span>
        <div>
          <h2>Acerca de</h2>
          <p>Información de la aplicación.</p>
        </div>
      </div>
      <div class="about-row">
        <span>Versión</span><strong>0.2.0 · UI Preview</strong>
      </div>
      <div class="about-row">
        <span>Almacenamiento</span><strong>Local en tu dispositivo</strong>
      </div>
    </section>
  </main>
</template>
