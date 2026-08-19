<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
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
const copyStatus = ref("Copiar contraseña");
const confirmDelete = ref(false);
const deleting = ref(false);
const deleteError = ref("");
const id = Number(route.params.id);

onBeforeRouteLeave((to) => {
  const editingCurrentEntry =
    to.name === "password-edit" && Number(to.params.id) === id;
  if (!editingCurrentEntry) passwords.lock();
});

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
  try {
    await navigator.clipboard.writeText(entry.value.password);
    copied.value = true;
    copyStatus.value = "Contraseña copiada";
  } catch {
    copyStatus.value = "No se pudo copiar";
  }
  window.setTimeout(() => {
    copied.value = false;
    copyStatus.value = "Copiar contraseña";
  }, 1800);
}

function openDeleteConfirmation() {
  deleteError.value = "";
  confirmDelete.value = true;
}

async function removeEntry() {
  if (!entry.value?.id) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    await passwords.remove(entry.value.id);
    confirmDelete.value = false;
    await router.push("/");
  } catch {
    deleteError.value = passwords.error ?? "No se pudo eliminar la entrada.";
    passwords.error = null;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <main class="page detail-page">
    <AppHeader title="Detalle" back-to="/" />
    <section
      v-if="loading"
      class="empty-state loading-state"
      aria-live="polite"
    >
      <span class="loading-spinner" aria-hidden="true"></span>
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
      <button
        class="primary-button"
        :class="{ 'primary-button--success': copied }"
        type="button"
        aria-live="polite"
        @click="copyPassword"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8h11v11H8z" />
          <path d="M5 16H4V4h12v1" /></svg
        >{{ copyStatus }}
      </button>
      <div class="detail-actions">
        <RouterLink :to="`/passwords/${entry.id}/edit`" class="secondary-button"
          >Editar</RouterLink
        ><button
          class="danger-button"
          type="button"
          @click="openDeleteConfirmation"
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
        <p v-if="deleteError" class="form-error" role="alert">
          {{ deleteError }}
        </p>
        <div class="dialog__actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="deleting"
            @click="confirmDelete = false"
          >
            Cancelar</button
          ><button
            class="danger-button danger-button--filled"
            type="button"
            :disabled="deleting"
            @click="removeEntry"
          >
            {{ deleting ? "Eliminando…" : "Eliminar" }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
