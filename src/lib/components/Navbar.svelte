<script lang="ts">
  import { currentUser, clearUser, userRole } from '$lib/stores/userStore';
  import { logout } from '$lib/services/authService';
  import { darkMode } from '$lib/stores/themeStore';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ChevronDown, User, Moon, Sun, LogOut } from 'lucide-svelte';

  let dropdownOpen = false;

  async function handleLogout() {
    await logout();
    clearUser();
    goto('/login', { replaceState: true });
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
  }

  function toggleDarkMode() {
    darkMode.update(v => !v);
  }

  // Cerrar dropdown al click fuera
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

<nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4">
  <div class="flex justify-between items-center">
    <!-- Logo/Title (solo móvil) -->
    <div class="lg:hidden">
      <h1 class="font-bold text-gray-900 dark:text-white text-lg">Control Electoral</h1>
    </div>

    <!-- Desktop: título de página o breadcrumb -->
    <div class="hidden lg:block">
      <h2 class="text-xl font-semibold text-gray-800 dark:text-white">
        <!-- Aquí puedes agregar el título dinámico de la página -->
      </h2>
    </div>

    <!-- User Menu -->
    {#if $currentUser}
      <div class="relative" id="user-dropdown">
        <button
          on:click={toggleDropdown}
          class="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition border border-gray-200 dark:border-gray-600"
        >
          <!-- Avatar -->
          <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold text-sm text-white">
            {$currentUser.get('username').charAt(0).toUpperCase()}
          </div>
          
          <!-- Nombre (oculto en móvil) -->
          <div class="hidden sm:block text-left">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {$currentUser.get('username')}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {$userRole}
            </p>
          </div>
          
          <ChevronDown size={16} class="text-gray-600 dark:text-gray-400" />
        </button>

        <!-- Dropdown -->
        {#if dropdownOpen}
          <div
            class="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
          >
            <!-- Info del usuario -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold text-white">
                  {$currentUser.get('username').charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {$currentUser.get('username')}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 capitalize flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                    {$userRole}
                  </p>
                </div>
              </div>
            </div>

            <!-- Modo oscuro -->
            <div class="p-3">
              <button
                on:click={toggleDarkMode}
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <div class="flex items-center gap-3">
                  {#if $darkMode}
                    <Sun size={18} class="text-yellow-500" />
                    <span class="text-sm text-gray-900 dark:text-white">Modo Claro</span>
                  {:else}
                    <Moon size={18} class="text-blue-500" />
                    <span class="text-sm text-gray-900 dark:text-white">Modo Oscuro</span>
                  {/if}
                </div>
                
                <!-- Toggle visual -->
                <div class="relative inline-block w-10 h-5 transition duration-200 ease-linear rounded-full {$darkMode ? 'bg-blue-600' : 'bg-gray-300'}">
                  <span class="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-linear {$darkMode ? 'translate-x-5' : ''}"></span>
                </div>
              </button>
            </div>

            <hr class="border-gray-200 dark:border-gray-700" />

            <!-- Cerrar sesión -->
            <button
              on:click={handleLogout}
              class="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <LogOut size={18} />
              <span class="font-medium">Cerrar sesión</span>
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</nav>