<script setup lang="ts">
import { ref } from "vue";
import AppHeader from "@/components/AppHeader.vue";
import { createEncryptedBackup, readEncryptedBackup } from "@/services/backup";
import { passwordRepository } from "@/services/database";

const selectedTheme = ref("system");
const themes = [
  { id: "system", label: "Sistema" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Oscuro" },
];
const fileInput = ref<HTMLInputElement>();
const dialogAction = ref<"export" | "import">();
const backupPassword = ref("");
const importFile = ref<File>();
const busy = ref(false);
const feedback = ref("");
const feedbackIsError = ref(false);

function openExport() {
  resetFeedback();
  dialogAction.value = "export";
}

function chooseImportFile() {
  resetFeedback();
  fileInput.value?.click();
}

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  importFile.value = file;
  dialogAction.value = "import";
}

function closeDialog() {
  if (busy.value) return;
  dialogAction.value = undefined;
  backupPassword.value = "";
  importFile.value = undefined;
}

async function submitBackupAction() {
  if (!dialogAction.value) return;
  busy.value = true;
  resetFeedback();
  try {
    if (dialogAction.value === "export") await exportBackup();
    else await importBackup();
    busy.value = false;
    closeDialog();
  } catch (cause) {
    feedback.value =
      cause instanceof Error
        ? cause.message
        : "No se pudo completar la operación.";
    feedbackIsError.value = true;
  } finally {
    busy.value = false;
  }
}

async function exportBackup() {
  const privateKey = await passwordRepository.keyProvider.unlockPrivateKey();
  const entries = await passwordRepository.listAll(privateKey);
  const serialized = await createEncryptedBackup(entries, backupPassword.value);
  const url = URL.createObjectURL(
    new Blob([serialized], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `password-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  feedback.value = `Backup exportado con ${entries.length} entradas.`;
}

async function importBackup() {
  if (!importFile.value) throw new Error("Seleccioná un archivo de backup.");
  const entries = await readEncryptedBackup(
    await importFile.value.text(),
    backupPassword.value,
  );
  const privateKey = await passwordRepository.keyProvider.unlockPrivateKey();
  const imported = await passwordRepository.importUnique(entries, privateKey);
  feedback.value = imported
    ? `Se importaron ${imported} entradas.`
    : "No había entradas nuevas para importar.";
}

function resetFeedback() {
  feedback.value = "";
  feedbackIsError.value = false;
}
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
      <input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        accept="application/json,.json"
        @change="handleFile"
      />
      <button class="settings-row" type="button" @click="chooseImportFile">
        <span
          ><strong>Importar</strong
          ><small>Restaurar desde un archivo cifrado</small></span
        ><span>›</span>
      </button>
      <button class="settings-row" type="button" @click="openExport">
        <span
          ><strong>Exportar</strong
          ><small>Crear una copia protegida con contraseña</small></span
        ><span>›</span>
      </button>
      <p
        v-if="feedback"
        class="settings-feedback"
        :class="{ 'settings-feedback--error': feedbackIsError }"
        role="status"
      >
        {{ feedback }}
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
      <div class="about-row"><span>Versión</span><strong>1.0.0</strong></div>
      <div class="about-row">
        <span>Almacenamiento</span><strong>Local en tu dispositivo</strong>
      </div>
    </section>

    <div v-if="dialogAction" class="dialog-backdrop" @click.self="closeDialog">
      <form
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
        @submit.prevent="submitBackupAction"
      >
        <span class="dialog__icon">{{
          dialogAction === "export" ? "↓" : "↑"
        }}</span>
        <h2 id="backup-title">
          {{ dialogAction === "export" ? "Proteger backup" : "Abrir backup" }}
        </h2>
        <p v-if="dialogAction === 'export'">
          Primero verificaremos tu identidad. Esta contraseña será necesaria
          para importar el archivo.
        </p>
        <p v-else>
          Archivo: <strong>{{ importFile?.name }}</strong>
        </p>
        <label class="field backup-password-field"
          ><span>Contraseña del backup</span
          ><input
            v-model="backupPassword"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
        /></label>
        <p v-if="feedbackIsError" class="form-error" role="alert">
          {{ feedback }}
        </p>
        <div class="dialog__actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="busy"
            @click="closeDialog"
          >
            Cancelar</button
          ><button class="primary-button" type="submit" :disabled="busy">
            {{
              busy
                ? "Procesando…"
                : dialogAction === "export"
                  ? "Exportar"
                  : "Importar"
            }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>
