import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/passwords/new",
      name: "password-new",
      component: () => import("@/views/PasswordFormView.vue"),
    },
    {
      path: "/passwords/:id",
      name: "password-detail",
      component: () => import("@/views/PasswordDetailView.vue"),
    },
    {
      path: "/passwords/:id/edit",
      name: "password-edit",
      component: () => import("@/views/PasswordFormView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
    },
  ],
});

export default router;
