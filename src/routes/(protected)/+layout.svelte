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
  <!-- Pantalla de carga -->
  <div class="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
      <p class="text-gray-600 dark:text-gray-400">Cargando...</p>
    </div>
  </div>
{:else if ready && $currentUser && hasAccess}
  <!-- Contenido principal -->
  <div class="flex min-h-screen bg-gray-100 dark:bg-gray-900">
    <Sidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <Navbar />
      <main class="p-3 sm:p-6 flex-1 min-w-0 overflow-x-hidden">
        <slot />
      </main>
    </div>
  </div>
{:else if ready && $currentUser && !hasAccess}
  <!-- Acceso denegado -->
  <div class="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
    <div class="text-center max-w-md">
      <div class="text-6xl mb-4">🚫</div>
      <h1 class="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Acceso Denegado</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        No tienes permisos para acceder a esta página.
        <br />
        Tu rol actual es: <strong class="text-orange-600">{$userRole}</strong>
      </p>
      <button
        on:click={() => goto('/dashboard')}
        class="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-md transition"
      >
        Volver al Dashboard
      </button>
    </div>
  </div>
{/if}