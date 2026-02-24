<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentUser, userRole, isLoadingUser, initUser } from '$lib/stores/userStore';
  import { checkRouteAccess } from '$lib/guards/roleGuard';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Navbar from '$lib/components/Navbar.svelte';
  import '../../app.css';

  let ready = false;
  let hasAccess = true;

  // Verificar acceso cuando cambie la ruta
  $: if (ready && $currentUser && $page.url.pathname !== '/login') {
    verifyRouteAccess($page.url.pathname);
  }

  async function verifyRouteAccess(pathname: string) {
    hasAccess = await checkRouteAccess(pathname);
  }

  onMount(async () => {
    // Inicializar usuario y rol
    await initUser();
    
    // Si no hay usuario, redirigir a login
    if (!$currentUser) {
      goto('/login', { replaceState: true });
      return;
    }
    
    // Verificar acceso a la ruta actual
    await verifyRouteAccess($page.url.pathname);
    
    ready = true;
  });
</script>

{#if $isLoadingUser}
  <!-- Pantalla de carga mejorada -->
  <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
    <div class="text-center">
      <div class="relative mb-8">
        <!-- Logo animado -->
        <div class="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl animate-pulse">
          <span class="text-3xl font-bold text-white">CE</span>
        </div>
        <!-- Círculo de carga -->
        <div class="absolute -inset-2">
          <div class="w-24 h-24 border-4 border-orange-200 dark:border-orange-900 border-t-orange-600 rounded-full animate-spin"></div>
        </div>
      </div>
      <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-2">Control Electoral</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">Cargando sistema...</p>
    </div>
  </div>
{:else if ready && $currentUser && hasAccess}
  <!-- Layout principal responsive -->
  <div class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
    <Sidebar />
    
    <!-- Contenedor principal -->
    <div class="flex-1 flex flex-col min-h-screen">
      <Navbar />
      
      <!-- Main content -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <div class="w-full max-w-[1920px] mx-auto">
          <slot />
        </div>
      </main>
      
      <!-- Footer -->
      <footer class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 mt-auto">
        <div class="max-w-7xl mx-auto">
          <p class="text-xs text-center text-gray-500 dark:text-gray-400">
            © 2026 Control Electoral - Sistema de Gestión Electoral
          </p>
        </div>
      </footer>
    </div>
  </div>
{:else if ready && $currentUser && !hasAccess}
  <!-- Acceso denegado mejorado -->
  <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
    <div class="text-center max-w-md">
      <!-- Icono -->
      <div class="mb-6">
        <div class="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto flex items-center justify-center">
          <span class="text-5xl">🚫</span>
        </div>
      </div>
      
      <!-- Mensaje -->
      <h1 class="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">
        Acceso Denegado
      </h1>
      <p class="text-gray-700 dark:text-gray-300 mb-2">
        No tienes permisos para acceder a esta página.
      </p>
      <div class="inline-block px-4 py-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg mb-6">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Tu rol actual: <strong class="text-orange-600 dark:text-orange-400 capitalize">{$userRole}</strong>
        </p>
      </div>
      
      <!-- Botones -->
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          on:click={() => goto('/dashboard')}
          class="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-lg transition font-semibold"
        >
          Volver al Dashboard
        </button>
        <button
          on:click={() => window.history.back()}
          class="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition"
        >
          Página Anterior
        </button>
      </div>
    </div>
  </div>
{/if}