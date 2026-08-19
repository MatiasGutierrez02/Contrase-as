import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  PasswordEntry,
  PasswordEntryInput,
  PasswordSummary,
} from "@/models/PasswordEntry";
import { passwordRepository } from "@/services/database";

export const usePasswordsStore = defineStore("passwords", () => {
  const entries = ref<PasswordSummary[]>([]);
  const unlockedEntry = ref<PasswordEntry>();
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    error.value = null;
    try {
      return await operation();
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Ocurrió un error inesperado.";
      throw cause;
    }
  }

  async function loadAll() {
    loading.value = true;
    try {
      entries.value = await run(() => passwordRepository.listSummaries());
    } finally {
      loading.value = false;
    }
  }

  async function unlockAndGet(id: number) {
    const privateKey = await run(() =>
      passwordRepository.keyProvider.unlockPrivateKey(),
    );
    const entry = await run(() => passwordRepository.get(id, privateKey));
    unlockedEntry.value = entry;
    return entry;
  }

  async function getForEditing(id: number) {
    if (unlockedEntry.value?.id === id) return unlockedEntry.value;
    return unlockAndGet(id);
  }

  async function create(entry: PasswordEntryInput) {
    const id = await run(() => passwordRepository.create(entry));
    await loadAll();
    return id;
  }

  async function update(id: number, entry: PasswordEntryInput) {
    await run(() => passwordRepository.update(id, entry));
    unlockedEntry.value = { id, ...entry };
    await loadAll();
  }

  async function remove(id: number) {
    await run(() => passwordRepository.remove(id));
    entries.value = entries.value.filter((entry) => entry.id !== id);
    if (unlockedEntry.value?.id === id) unlockedEntry.value = undefined;
  }

  return {
    entries,
    unlockedEntry,
    loading,
    error,
    loadAll,
    unlockAndGet,
    getForEditing,
    create,
    update,
    remove,
  };
});
