<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import type { PasswordEntry } from "@/models/PasswordEntry";
import { usePasswordsStore } from "@/stores/passwords";
import { passwordAccent } from "@/utils/passwordAccent";

const route = useRoute();
const router = useRouter();
const passwords = usePasswordsStore();
const entry = ref<PasswordEntry>();
const loading = ref(true);
const passwordVisible = ref(true);
const copied = ref(false);
const confirmDelete = ref(false);
const id = Number(route.params.id);

onMounted(async () => {
  try {
    if (Number.isInteger(id)) entry.value = await passwords.unlockAndGet(id);
  } catch {
    entry.value = undefined;
  } finally {
    loading.value = false;
  }
});

async function copyPassword() {
  if (!entry.value) return;
  await navigator.clipboard.writeText(entry.value.password);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1800);
}

async function removeEntry() {
  if (!entry.value?.id) return;
  try {
    await passwords.remove(entry.value.id);
    confirmDelete.value = false;
    await router.push("/");
  } catch {
    confirmDelete.value = false;
  }
}
</script>

<template>
  <main class="page detail-page">
    <AppHeader title="Detalle" back-to="/" />
    <section v-if="loading" class="empty-state">
      <p>Verificá tu identidad para desbloquear esta cuenta…</p>
    </section>
    <section v-else-if="passwords.error" class="empty-state empty-state--error">
      <h2>No se desbloqueó la cuenta</h2>
      <p>{{ passwords.error }}</p>
      <button class="secondary-button" type="button" @click="$router.go(0)">
        Intentar nuevamente
      </button>
    </section>
    <section
      v-else-if="entry"
      class="detail-card"
      :style="{ '--accent': passwordAccent(entry.name) }"
    >
      <div class="detail-identity">
        <span class="detail-avatar">{{ entry.name.charAt(0) }}</span>
        <div>
          <span class="eyebrow">Cuenta</span>
          <h2>{{ entry.name }}</h2>
        </div>
      </div>
      <dl class="credential-list">
        <div>
          <dt>Usuario / mail</dt>
          <dd>{{ entry.username }}</dd>
        </div>
        <div>
          <dt>Contraseña</dt>
          <dd class="password-value">
            <span>{{
              passwordVisible ? entry.password : "••••••••••••••"
            }}</span
            ><button
              class="text-button"
              type="button"
              @click="passwordVisible = !passwordVisible"
            >
              {{ passwordVisible ? "Ocultar" : "Mostrar" }}
            </button>
          </dd>
        </div>
      </dl>
      <button class="primary-button" type="button" @click="copyPassword">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8h11v11H8z" />
          <path d="M5 16H4V4h12v1" /></svg
        >{{ copied ? "Copiada" : "Copiar contraseña" }}
      </button>
      <div class="detail-actions">
        <RouterLink :to="`/passwords/${entry.id}/edit`" class="secondary-button"
          >Editar</RouterLink
        ><button
          class="danger-button"
          type="button"
          @click="confirmDelete = true"
        >
          Eliminar
        </button>
      </div>
    </section>
    <section v-else class="empty-state">
      <h2>No encontramos esta contraseña</h2>
      <RouterLink to="/" class="primary-button">Volver al inicio</RouterLink>
    </section>

    <div
      v-if="confirmDelete"
      class="dialog-backdrop"
      @click.self="confirmDelete = false"
    >
      <section
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <span class="dialog__icon">!</span>
        <h2 id="delete-title">¿Eliminar {{ entry?.name }}?</h2>
        <p>Esta acción eliminará la entrada de tu dispositivo.</p>
        <div class="dialog__actions">
          <button
            class="secondary-button"
            type="button"
            @click="confirmDelete = false"
          >
            Cancelar</button
          ><button
            class="danger-button danger-button--filled"
            type="button"
            @click="removeEntry"
          >
            Eliminar
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
