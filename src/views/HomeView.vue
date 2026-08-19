<script setup lang="ts">
import { onMounted } from "vue";
import AppHeader from "@/components/AppHeader.vue";
import PasswordCard from "@/components/PasswordCard.vue";
import { usePasswordsStore } from "@/stores/passwords";
import { passwordAccent } from "@/utils/passwordAccent";

const passwords = usePasswordsStore();
onMounted(() => {
  passwords.lock();
  void passwords.loadAll().catch(() => undefined);
});

function retryLoad() {
  void passwords.loadAll().catch(() => undefined);
}
</script>

<template>
  <main class="page home-page">
    <AppHeader title="Mi bóveda" eyebrow="Contraseñas">
      <RouterLink
        to="/settings"
        class="icon-button"
        aria-label="Abrir configuración"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path
            d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4l-.4 3a8 8 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.1l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3h4l.4-3a8 8 0 0 0 1.8-1l2.4 1 2 3.4-2-1.5a7 7 0 0 0 .1-1Z"
          />
        </svg>
      </RouterLink>
    </AppHeader>
    <section class="vault-intro">
      <p>Todo lo importante, en un solo lugar.</p>
      <span v-if="!passwords.loading"
        >{{ passwords.entries.length }} guardadas</span
      >
    </section>

    <section
      v-if="passwords.loading"
      class="empty-state loading-state"
      aria-live="polite"
    >
      <span class="loading-spinner" aria-hidden="true"></span>
      <p>Cargando tu bóveda…</p>
    </section>
    <section v-else-if="passwords.error" class="empty-state empty-state--error">
      <h2>No pudimos abrir tu bóveda</h2>
      <p>{{ passwords.error }}</p>
      <button class="secondary-button" type="button" @click="retryLoad">
        Reintentar
      </button>
    </section>
    <section
      v-else-if="passwords.entries.length"
      class="password-grid"
      aria-label="Contraseñas guardadas"
    >
      <PasswordCard
        v-for="entry in passwords.entries"
        :id="entry.id!"
        :key="entry.id"
        :name="entry.name"
        :accent="passwordAccent(entry.name)"
      />
    </section>
    <section v-else class="empty-state empty-state--vault">
      <span class="empty-state__icon">+</span>
      <h2>Tu bóveda está vacía</h2>
      <p>Creá tu primera entrada para verla acá.</p>
      <RouterLink to="/passwords/new" class="primary-button"
        >Crear contraseña</RouterLink
      >
    </section>

    <RouterLink
      to="/passwords/new"
      class="fab"
      aria-label="Crear nueva contraseña"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </RouterLink>
  </main>
</template>
