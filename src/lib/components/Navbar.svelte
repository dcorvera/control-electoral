<script lang="ts">
  import { currentUser, clearUser, userRole } from '$lib/stores/userStore';
  import { logout } from '$lib/services/authService';
  import { darkMode } from '$lib/stores/themeStore';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Menu, ChevronDown, User } from 'lucide-svelte';

  let dropdownOpen = false;

  async function handleLogout() {
    await logout();
    clearUser(); // Limpiar el store
    goto('/login', { replaceState: true });
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
  }

  // Para cerrar dropdown al click fuera
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#user-dropdown')) {
      dropdownOpen = false;
    }
  };

  onMount(() => {
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  });
</script>

<nav class="bg-white dark:bg-gray-800 shadow p-4 flex justify-between items-center">
  <h1 class="font-bold text-gray-900 dark:text-white">Mi App</h1>
<!--
  {#if $currentUser}
    <div class="relative" id="user-dropdown">
      <button
        on:click={toggleDropdown}
        class="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
      >
        <User size={16} />
        <span class="text-gray-900 dark:text-white">{$currentUser.get('username')}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400 capitalize">({$userRole})</span>
        <ChevronDown size={16} />
      </button>

     {#if dropdownOpen}
        <div
          class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 z-50"
        >
          {/* Info del usuario */}
          <div class="p-3 border-b border-gray-200 dark:border-gray-700">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {$currentUser.get('username')}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">
              Rol: {$userRole}
            </p>
          </div>

          {/*  Modo oscuro */}
          <div class="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
            <span class="text-sm text-gray-900 dark:text-white">Modo Oscuro</span>
            <input 
              type="checkbox" 
              bind:checked={$darkMode} 
              class="cursor-pointer w-4 h-4"
            />
          </div>

          <hr class="border-gray-200 dark:border-gray-700" />

          {/* Cerrar sesión */}
          <button
            on:click={handleLogout}
            class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg transition"
          >
            Cerrar sesión
          </button>
        </div>
      {/if}
    </div>
  {/if}-->
</nav>