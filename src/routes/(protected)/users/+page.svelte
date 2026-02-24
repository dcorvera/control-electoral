<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { User, Plus, Edit, Trash2, Search, RefreshCw, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-svelte';
  import { getCurrentUser } from '$lib/services/authService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  let loading = false;
  
  // Usuarios y roles
  let users: any[] = [];
  let filteredUsers: any[] = [];
  let searchTerm = '';
  let availableRoles: any[] = [];
  
  // Modal
  let showModal = false;
  let modalMode: 'create' | 'edit' = 'create';
  let editingUser: any = null;
  
  // Form data
  let formData = {
    username: '',
    email: '',
    password: '',
    selectedRoles: [] as string[],
    active: true
  };
  
  // Validación
  let showPassword = false;
  let formErrors: Record<string, string> = {};
  
  // Estilos de roles
  const roleStyles: Record<string, any> = {
    superadmin: { label: 'Super Admin', icon: '👑', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20' },
    admin: { label: 'Admin', icon: '🛡️', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20' },
    digitalizacion: { label: 'Digitalizador', icon: '📸', color: 'text-green-600 bg-green-100 dark:bg-green-900/20' },
    transcripcion: { label: 'Transcriptor', icon: '✍️', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20' },
    validacion: { label: 'Validador', icon: '✅', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20' },
    viewer: { label: 'Visualizador', icon: '👁️', color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/20' }
  };

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      // Verificar roles de Parse directamente
      const userHasAccess = await checkUserHasAdminRole();
      
      if (!userHasAccess) {
        alert('No tienes permisos para acceder a esta sección. Necesitas rol de admin o superadmin.');
        goto('/dashboard');
        return;
      }
      
      loaded = true;
      await loadRoles();
      await loadUsers();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  });

  async function checkUserHasAdminRole(): Promise<boolean> {
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const roleQuery = new Parse.Query(Parse.Role);
      roleQuery.equalTo('users', currentUser);
      
      const userRoles = await roleQuery.find();
      const roleNames = userRoles.map(r => r.get('name'));
      
      return roleNames.includes('superadmin') || roleNames.includes('admin');
    } catch (error) {
      console.error('Error verificando roles:', error);
      return false;
    }
  }

  async function loadRoles() {
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const query = new Parse.Query(Parse.Role);
      query.ascending('name');
      
      const results = await query.find();
      availableRoles = results.map(role => ({
        id: role.id,
        name: role.get('name')
      }));
      
      console.log('🎭 Roles cargados desde Parse:', availableRoles);
      
      // Si no hay roles, advertir
      if (availableRoles.length === 0) {
        console.warn('⚠️ No se encontraron roles en Parse. Asegúrate de crear roles en _Role.');
      }
      
    } catch (error) {
      console.error('❌ Error al cargar roles:', error);
      // Si falla cargar roles, usar lista por defecto
      availableRoles = [
        { id: 'default-superadmin', name: 'superadmin' },
        { id: 'default-admin', name: 'admin' },
        { id: 'default-digitalizacion', name: 'digitalizacion' },
        { id: 'default-transcripcion', name: 'transcripcion' },
        { id: 'default-validacion', name: 'validacion' },
        { id: 'default-viewer', name: 'viewer' }
      ];
      console.log('⚠️ Usando roles por defecto:', availableRoles);
    }
  }

  async function loadUsers() {
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      const query = new Parse.Query(Parse.User);
      query.descending('createdAt');
      query.limit(1000);
      
      const results = await query.find();
      
      console.log(`📊 Cargando ${results.length} usuarios...`);
      
      // Cargar roles de cada usuario
      const usersWithRoles = await Promise.all(
        results.map(async (user) => {
          const roles = await getUserRoles(user);
          return {
            id: user.id,
            username: user.get('username'),
            email: user.get('email'),
            roles: roles,
            active: user.get('active') !== false,
            createdAt: user.get('createdAt')
          };
        })
      );
      
      users = usersWithRoles;
      filteredUsers = users;
      
      console.log('✅ Usuarios cargados:', users);
      
    } catch (error) {
      console.error('❌ Error al cargar usuarios:', error);
      alert('Error al cargar usuarios: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      loading = false;
    }
  }

  async function getUserRoles(user: any): Promise<string[]> {
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      // Crear query para buscar roles que contengan este usuario
      const roleQuery = new Parse.Query(Parse.Role);
      roleQuery.equalTo('users', user);
      
      const roles = await roleQuery.find();
      const roleNames = roles.map(role => role.get('name'));
      
      // Debug: mostrar roles encontrados
      if (roleNames.length > 0) {
        console.log(`Usuario ${user.get('username')} tiene roles:`, roleNames);
      } else {
        console.warn(`Usuario ${user.get('username')} no tiene roles asignados`);
      }
      
      return roleNames;
    } catch (error) {
      console.error(`Error obteniendo roles para ${user.get('username')}:`, error);
      return [];
    }
  }

  function openCreateModal() {
    modalMode = 'create';
    editingUser = null;
    formData = { username: '', email: '', password: '', selectedRoles: [], active: true };
    formErrors = {};
    showModal = true;
  }

  function openEditModal(user: any) {
    modalMode = 'edit';
    editingUser = user;
    formData = {
      username: user.username,
      email: user.email,
      password: '',
      selectedRoles: [...user.roles],
      active: user.active
    };
    formErrors = {};
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  function validateForm(): boolean {
    formErrors = {};
    
    if (!formData.username.trim()) formErrors.username = 'Requerido';
    if (!formData.email.trim()) formErrors.email = 'Requerido';
    if (modalMode === 'create' && !formData.password) formErrors.password = 'Requerido';
    if (formData.selectedRoles.length === 0) formErrors.roles = 'Selecciona al menos un rol';
    
    return Object.keys(formErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      if (modalMode === 'create') {
        // Crear usuario
        const user = new Parse.User();
        user.set('username', formData.username.trim());
        user.set('email', formData.email.trim());
        user.set('password', formData.password);
        user.set('active', formData.active);
        
        await user.signUp();
        
        // Asignar roles
        for (const roleName of formData.selectedRoles) {
          const roleQuery = new Parse.Query(Parse.Role);
          roleQuery.equalTo('name', roleName);
          const role = await roleQuery.first();
          
          if (role) {
            role.relation('users').add(user);
            await role.save();
          }
        }
        
        alert('✅ Usuario creado exitosamente');
      } else {
        // Editar usuario
        const query = new Parse.Query(Parse.User);
        const user = await query.get(editingUser.id);
        
        user.set('username', formData.username.trim());
        user.set('email', formData.email.trim());
        user.set('active', formData.active);
        
        // Solo el mismo usuario puede cambiar su contraseña
        if (formData.password && user.id === currentUser?.id) {
          user.set('password', formData.password);
        }
        
        await user.save();
        
        // Actualizar roles
        const currentRoles = new Set(editingUser.roles);
        const newRoles = new Set(formData.selectedRoles);
        
        // Remover de roles viejos
        for (const roleName of currentRoles) {
          if (!newRoles.has((roleName:any))) {
            const roleQuery = new Parse.Query(Parse.Role);
            roleQuery.equalTo('name', roleName);
            const role = await roleQuery.first();
            if (role) {
              role.relation('users').remove(user);
              await role.save();
            }
          }
        }
        
        // Agregar a roles nuevos
        for (const roleName of newRoles) {
          if (!currentRoles.has(roleName)) {
            const roleQuery = new Parse.Query(Parse.Role);
            roleQuery.equalTo('name', roleName);
            const role = await roleQuery.first();
            if (role) {
              role.relation('users').add(user);
              await role.save();
            }
          }
        }
        
        alert('✅ Usuario actualizado');
      }
      
      closeModal();
      await loadUsers();
      
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function deleteUser(user: any) {
    if (user.id === currentUser?.id) {
      alert('❌ No puedes eliminar tu propio usuario');
      return;
    }
    
    if (!confirm(`¿Eliminar usuario "${user.username}"?`)) return;
    
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const query = new Parse.Query(Parse.User);
      const userObj = await query.get(user.id);
      
      // Remover de todos los roles
      for (const roleName of user.roles) {
        const roleQuery = new Parse.Query(Parse.Role);
        roleQuery.equalTo('name', roleName);
        const role = await roleQuery.first();
        if (role) {
          role.relation('users').remove(userObj);
          await role.save();
        }
      }
      
      await userObj.destroy();
      alert('✅ Usuario eliminado');
      await loadUsers();
      
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function toggleUserStatus(user: any) {
    loading = true;
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const query = new Parse.Query(Parse.User);
      const userObj = await query.get(user.id);
      userObj.set('active', !user.active);
      await userObj.save();
      await loadUsers();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      loading = false;
    }
  }

  function getRoleStyle(roleName: string) {
    const style = roleStyles[roleName];
    
    if (!style) {
      console.warn(`⚠️ Rol "${roleName}" no tiene estilo definido en roleStyles`);
    }
    
    return style || { 
      label: roleName.charAt(0).toUpperCase() + roleName.slice(1), 
      icon: '🔹', 
      color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-200' 
    };
  }

  function toggleRole(roleName: string) {
    const index = formData.selectedRoles.indexOf(roleName);
    if (index > -1) {
      formData.selectedRoles = formData.selectedRoles.filter(r => r !== roleName);
    } else {
      formData.selectedRoles = [...formData.selectedRoles, roleName];
    }
  }

  $: {
    if (searchTerm) {
      filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      filteredUsers = users;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
  <div class="max-w-7xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">👥 Gestión de Usuarios</h1>
      <p class="text-gray-600 dark:text-gray-400">Administra usuarios y roles del sistema</p>
    </div>

    {#if loaded}
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div class="relative flex-1 w-full sm:max-w-md">
            <Search size={20} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" bind:value={searchTerm} placeholder="Buscar..." 
                   class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
          </div>

          <div class="flex gap-3 w-full sm:w-auto">
            <button on:click={loadUsers} disabled={loading}
                    class="flex-1 sm:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2">
              <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button on:click={openCreateModal}
                    class="flex-1 sm:flex-none px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2">
              <Plus size={16} />
              Nuevo Usuario
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {#if loading && users.length === 0}
          <div class="p-12 text-center">
            <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-orange-600" />
            <p class="text-gray-600 dark:text-gray-400">Cargando...</p>
          </div>
        {:else if filteredUsers.length === 0}
          <div class="p-12 text-center">
            <User size={48} class="mx-auto mb-4 text-gray-400" />
            <h3 class="text-lg font-semibold mb-2 dark:text-white">No hay usuarios</h3>
            <button on:click={openCreateModal} class="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg">
              Crear Usuario
            </button>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-700 border-b-2 dark:border-gray-600">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Usuario</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Roles</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Estado</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each filteredUsers as user}
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold text-white">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div class="font-semibold dark:text-white">{user.username}</div>
                          <div class="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex flex-wrap gap-1">
                        {#if user.roles.length > 0}
                          {#each user.roles as roleName}
                            {@const style = getRoleStyle(roleName)}
                            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs {style.color}">
                              {style.icon} {style.label}
                            </span>
                          {/each}
                        {:else}
                          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-red-600 bg-red-100 dark:bg-red-900/20">
                            ⚠️ Sin roles
                          </span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      {#if user.active}
                        <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full text-sm">
                          <CheckCircle size={14} /> Activo
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-full text-sm">
                          <XCircle size={14} /> Inactivo
                        </span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button on:click={() => toggleUserStatus(user)} disabled={loading}
                                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition">
                          {#if user.active}<XCircle size={18} />{:else}<CheckCircle size={18} />{/if}
                        </button>
                        <button on:click={() => openEditModal(user)} disabled={loading}
                                class="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                          <Edit size={18} />
                        </button>
                        <button on:click={() => deleteUser(user)} disabled={user.id === currentUser?.id || loading}
                                class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b dark:border-gray-700">
        <h3 class="text-2xl font-bold dark:text-white">
          {modalMode === 'create' ? '➕ Crear Usuario' : '✏️ Editar Usuario'}
        </h3>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">Username *</label>
          <input type="text" bind:value={formData.username} 
                 class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white {formErrors.username ? 'border-red-500' : ''}" />
          {#if formErrors.username}<p class="text-red-500 text-sm mt-1">{formErrors.username}</p>{/if}
        </div>

        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">Email *</label>
          <input type="email" bind:value={formData.email}
                 class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white {formErrors.email ? 'border-red-500' : ''}" />
          {#if formErrors.email}<p class="text-red-500 text-sm mt-1">{formErrors.email}</p>{/if}
        </div>

        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">
            Password {modalMode === 'edit' ? '(dejar vacío para no cambiar)' : '*'}
          </label>
          <div class="relative">
            <input type={showPassword ? 'text' : 'password'} bind:value={formData.password}
                   class="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white {formErrors.password ? 'border-red-500' : ''}" />
            <button type="button" on:click={() => showPassword = !showPassword}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {#if showPassword}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
            </button>
          </div>
          {#if formErrors.password}<p class="text-red-500 text-sm mt-1">{formErrors.password}</p>{/if}
        </div>

        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">Roles *</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each availableRoles as role}
              {@const style = getRoleStyle(role.name)}
              {@const isSelected = formData.selectedRoles.includes(role.name)}
              <label class="flex items-start p-4 border-2 rounded-lg cursor-pointer {isSelected ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600'}">
                <input type="checkbox" checked={isSelected} on:change={() => toggleRole(role.name)} class="mt-1" />
                <div class="ml-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">{style.icon}</span>
                    <span class="font-semibold dark:text-white text-sm">{style.label}</span>
                  </div>
                </div>
              </label>
            {/each}
          </div>
          {#if formErrors.roles}<p class="text-red-500 text-sm mt-1">{formErrors.roles}</p>{/if}
        </div>

        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" bind:checked={formData.active} class="w-5 h-5 text-orange-600 rounded" />
          <span class="font-medium dark:text-white">Usuario Activo</span>
        </label>
      </div>

      <div class="p-6 border-t dark:border-gray-700 flex gap-3">
        <button on:click={closeModal} class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300">
          Cancelar
        </button>
        <button on:click={handleSubmit} disabled={loading}
                class="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
          {loading ? 'Guardando...' : (modalMode === 'create' ? 'Crear' : 'Guardar')}
        </button>
      </div>
    </div>
  </div>
{/if}