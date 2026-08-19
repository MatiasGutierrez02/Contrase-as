<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import { usePasswordsStore } from "@/stores/passwords";

const route = useRoute();
const router = useRouter();
const passwords = usePasswordsStore();
const isEditing = computed(() => route.name === "password-edit");
const id = computed(() => Number(route.params.id));
const loading = ref(isEditing.value);
const saving = ref(false);
const passwordVisible = ref(false);
const entryExists = ref(!isEditing.value);
const form = reactive({ name: "", username: "", password: "" });

onMounted(async () => {
  if (!isEditing.value || !Number.isInteger(id.value)) {
    loading.value = false;
    return;
  }
  try {
    const entry = await passwords.getForEditing(id.value);
    if (entry) {
      Object.assign(form, {
        name: entry.name,
        username: entry.username,
        password: entry.password,
      });
      entryExists.value = true;
    }
  } catch {
    entryExists.value = false;
  } finally {
    loading.value = false;
  }
});

async function submitForm() {
  saving.value = true;
  try {
    const input = {
      name: form.name.trim(),
      username: form.username.trim(),
      password: form.password,
    };
    if (isEditing.value) {
      await passwords.update(id.value, input);
      await router.push(`/passwords/${id.value}`);
    } else {
      const newId = await passwords.create(input);
      await router.push(`/passwords/${newId}`);
    }
  } catch {
    // El store expone el mensaje en el formulario.
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="page form-page">
    <AppHeader
      :title="isEditing ? 'Editar cuenta' : 'Nueva cuenta'"
      :back-to="isEditing ? `/passwords/${id}` : '/'"
    />
    <section v-if="loading" class="empty-state">
      <p>Cargando contraseña…</p>
    </section>
    <section v-else-if="passwords.error" class="empty-state empty-state--error">
      <h2>No se desbloqueó la cuenta</h2>
      <p>{{ passwords.error }}</p>
      <RouterLink to="/" class="secondary-button">Volver al inicio</RouterLink>
    </section>
    <section v-else-if="isEditing && !entryExists" class="empty-state">
      <h2>No encontramos esta contraseña</h2>
      <RouterLink to="/" class="primary-button">Volver al inicio</RouterLink>
    </section>
    <form v-else class="entry-form" @submit.prevent="submitForm">
      <div class="form-heading">
        <span class="form-heading__icon">+</span>
        <div>
          <h2>
            {{ isEditing ? "Actualizá los datos" : "Guardá una contraseña" }}
          </h2>
          <p>La entrada se guardará localmente en este dispositivo.</p>
        </div>
      </div>
      <p v-if="passwords.error" class="form-error" role="alert">
        {{ passwords.error }}
      </p>
      <label class="field"
        ><span>Nombre</span
        ><input
          v-model="form.name"
          name="name"
          type="text"
          placeholder="Ej. Google"
          autocomplete="off"
          required
      /></label>
      <label class="field"
        ><span>Usuario / mail</span
        ><input
          v-model="form.username"
          name="username"
          type="text"
          placeholder="nombre@ejemplo.com"
          autocomplete="username"
          required
      /></label>
      <label class="field"
        ><span>Contraseña</span
        ><span class="password-input"
          ><input
            v-model="form.password"
            name="password"
            :type="passwordVisible ? 'text' : 'password'"
            placeholder="Ingresá una contraseña"
            autocomplete="new-password"
            required
          /><button type="button" @click="passwordVisible = !passwordVisible">
            {{ passwordVisible ? "Ocultar" : "Mostrar" }}
          </button></span
        ></label
      >
      <button
        class="primary-button primary-button--large"
        type="submit"
        :disabled="saving"
      >
        {{
          saving
            ? "Guardando…"
            : isEditing
              ? "Guardar cambios"
              : "Guardar contraseña"
        }}
      </button>
    </form>
  </main>
</template>
