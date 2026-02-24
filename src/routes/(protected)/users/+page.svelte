<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { User, Plus, Edit, Trash2, Search, Shield, RefreshCw, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-svelte';
  import { getCurrentUser, hasAnyRole } from '$lib/services/authService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  let loading = false;
  
  // Usuarios
  let users: any[] = [];
  let filteredUsers: any[] = [];
  let searchTerm = '';
  
  // Modal
  let showModal = false;
  let modalMode: 'create' | 'edit' = 'create';
  let editingUser: any = null;
  
  // Form data
  let formData = {
    username: '',
    email: '',
    password: '',
    role: 'viewer' as 'superadmin' | 'admin' | 'digitalizacion' | 'transcripcion' | 'validacion' | 'viewer',
    active: true
  };
  
  // Validación
  let showPassword = false;
  let formErrors: Record<string, string> = {};
  
  // Roles disponibles
  const roles = [
    { 
      value: 'superadmin', 
      label: 'Super Administrador',
      description: 'Acceso total al sistema',
      icon: '👑',
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20'
    },
    { 
      value: 'admin', 
      label: 'Administrador',
      description: 'Gestión completa del proceso electoral',
      icon: '🛡️',
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20'
    },
    { 
      value: 'digitalizacion', 
      label: 'Digitalizador',
      description: 'Escaneo y carga de actas',
      icon: '📸',
      color: 'text-green-600 bg-green-100 dark:bg-green-900/20'
    },
    { 
      value: 'transcripcion', 
      label: 'Transcriptor',
      description: 'Transcripción de votos',
      icon: '✍️',
      color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
    },
    { 
      value: 'validacion', 
      label: 'Validador',
      description: 'Validación de actas transcritas',
      icon: '✅',
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20'
    },
    { 
      value: 'viewer', 
      label: 'Visualizador',
      description: 'Solo lectura de resultados',
      icon: '👁️',
      color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/20'
    }
  ];

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      const hasAccess = await hasAnyRole(['superadmin', 'admin']);
      
      if (!hasAccess) {
        alert('No tienes permisos para acceder a esta sección');
        goto('/dashboard');
        return;
      }
      
      loaded = true;
      await loadUsers();
      
    } catch (error) {
      console.error('Error:', error);
      goto('/login');
    }
  });

  async function loadUsers() {
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      // Intentar cargar UserProfiles
      const UserProfile = Parse.Object.extend('UserProfile');
      const query = new Parse.Query(UserProfile);
      query.include('user');
      query.descending('createdAt');
      query.limit(1000);
      
      let results = [];
      
      try {
        results = await query.find();
      } catch (error: any) {
        // Si la clase no existe, intentar crearla con un objeto dummy
        if (error.code === 119 || error.message.includes('non-existent class')) {
          console.log('Clase UserProfile no existe, creando...');
          
          // Crear el primer UserProfile para el usuario actual
          const currentUserRole = currentUser?.get('role') || 'superadmin';
          
          const profile = new UserProfile();
          profile.set('user', currentUser);
          profile.set('username', currentUser?.get('username'));
          profile.set('email', currentUser?.get('email'));
          profile.set('role', currentUserRole);
          profile.set('active', true);
          
          // ACL básico
          const acl = new Parse.ACL();
          acl.setPublicReadAccess(false);
          acl.setPublicWriteAccess(false);
          acl.setReadAccess(currentUser, true);
          acl.setWriteAccess(currentUser, true);
          profile.setACL(acl);
          
          try {
            await profile.save();
            console.log('✅ Clase UserProfile creada');
            
            // Recargar después de crear
            results = await query.find();
          } catch (saveError) {
            console.error('Error al crear UserProfile:', saveError);
            throw new Error('No se pudo crear la clase UserProfile. Por favor, créala manualmente en Parse Dashboard.');
          }
        } else {
          throw error;
        }
      }
      
      users = results.map(profile => {
        const user = profile.get('user');
        return {
          id: profile.id,
          userId: user?.id,
          username: user?.get('username') || profile.get('username'),
          email: user?.get('email') || profile.get('email'),
          role: profile.get('role') || 'viewer',
          active: profile.get('active') !== false,
          createdAt: profile.get('createdAt'),
          updatedAt: profile.get('updatedAt')
        };
      });
      
      filteredUsers = users;
      
      // Si no hay usuarios, mostrar ayuda
      if (users.length === 0) {
        console.log('ℹ️ No hay UserProfiles. Crea el primero desde el botón "Nuevo Usuario"');
      }
      
    } catch (error: any) {
      console.error('Error:', error);
      
      let errorMessage = 'Error al cargar usuarios';
      
      if (error.code === 119) {
        errorMessage = 'La clase UserProfile no existe. Se intentó crear automáticamente.';
      } else if (error.message.includes('non-existent class')) {
        errorMessage = 'Por favor, crea la clase UserProfile en Parse Dashboard primero.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    modalMode = 'create';
    editingUser = null;
    formData = {
      username: '',
      email: '',
      password: '',
      role: 'viewer',
      active: true
    };
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
      role: user.role,
      active: user.active
    };
    formErrors = {};
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    formData = {
      username: '',
      email: '',
      password: '',
      role: 'viewer',
      active: true
    };
    formErrors = {};
  }

  function validateForm(): boolean {
    formErrors = {};
    
    if (!formData.username.trim()) {
      formErrors.username = 'El nombre de usuario es requerido';
    } else if (formData.username.length < 3) {
      formErrors.username = 'Mínimo 3 caracteres';
    }
    
    if (!formData.email.trim()) {
      formErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      formErrors.email = 'Email inválido';
    }
    
    if (modalMode === 'create' && !formData.password) {
      formErrors.password = 'La contraseña es requerida';
    } else if (formData.password && formData.password.length < 6) {
      formErrors.password = 'Mínimo 6 caracteres';
    }
    
    return Object.keys(formErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      if (modalMode === 'create') {
        // 1. Crear usuario de Parse
        const user = new Parse.User();
        user.set('username', formData.username.trim());
        user.set('email', formData.email.trim());
        user.set('password', formData.password);
        user.set('role', formData.role); // Guardar rol también en _User
        
        await user.signUp();
        
        // 2. Crear UserProfile asociado
        const UserProfile = Parse.Object.extend('UserProfile');
        const profile = new UserProfile();
        
        profile.set('user', user);
        profile.set('username', formData.username.trim());
        profile.set('email', formData.email.trim());
        profile.set('role', formData.role);
        profile.set('active', formData.active);
        
        // ACL: Acceso basado en el usuario actual y público para admins
        const acl = new Parse.ACL();
        acl.setPublicReadAccess(false);
        acl.setPublicWriteAccess(false);
        
        // El usuario actual (admin) puede leer/escribir
        if (currentUser) {
          acl.setReadAccess(currentUser, true);
          acl.setWriteAccess(currentUser, true);
        }
        
        // El nuevo usuario puede leer su propio perfil
        acl.setReadAccess(user, true);
        
        profile.setACL(acl);
        
        try {
          await profile.save();
          alert('✅ Usuario creado exitosamente');
        } catch (profileError: any) {
          console.error('Error al crear UserProfile:', profileError);
          
          // Si falló crear el profile, eliminar el usuario
          try {
            await user.destroy();
          } catch (cleanupError) {
            console.error('Error al limpiar usuario:', cleanupError);
          }
          
          throw new Error('No se pudo crear el perfil del usuario: ' + profileError.message);
        }
      } else {
        // Editar UserProfile
        const UserProfile = Parse.Object.extend('UserProfile');
        const query = new Parse.Query(UserProfile);
        const profile = await query.get(editingUser.id);
        
        profile.set('username', formData.username.trim());
        profile.set('email', formData.email.trim());
        profile.set('role', formData.role);
        profile.set('active', formData.active);
        
        await profile.save();
        
        // Si cambió la contraseña, intentar actualizar el usuario
        if (formData.password) {
          try {
            const user = await Parse.User.current();
            if (user && user.id === editingUser.userId) {
              user.set('password', formData.password);
              await user.save();
            }
          } catch (err) {
            console.warn('No se pudo actualizar contraseña:', err);
          }
        }
        
        alert('✅ Usuario actualizado exitosamente');
      }
      
      closeModal();
      await loadUsers();
      
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message || 'No se pudo guardar el usuario'}`);
    } finally {
      loading = false;
    }
  }

  async function deleteUser(user: any) {
    if (user.userId === currentUser?.id) {
      alert('❌ No puedes eliminar tu propio usuario');
      return;
    }
    
    if (!confirm(`¿Eliminar usuario "${user.username}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }
    
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      const UserProfile = Parse.Object.extend('UserProfile');
      const query = new Parse.Query(UserProfile);
      const profile = await query.get(user.id);
      
      await profile.destroy();
      
      alert('✅ Usuario eliminado');
      await loadUsers();
      
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al eliminar usuario: ' + (error.message || 'Error desconocido'));
    } finally {
      loading = false;
    }
  }

  async function toggleUserStatus(user: any) {
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      const UserProfile = Parse.Object.extend('UserProfile');
      const query = new Parse.Query(UserProfile);
      const profile = await query.get(user.id);
      
      const newStatus = !user.active;
      profile.set('active', newStatus);
      
      await profile.save();
      
      alert(`✅ Usuario ${newStatus ? 'activado' : 'desactivado'}`);
      await loadUsers();
      
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al cambiar estado: ' + (error.message || 'Error desconocido'));
    } finally {
      loading = false;
    }
  }

  function getRoleInfo(roleValue: string) {
    return roles.find(r => r.value === roleValue) || roles[roles.length - 1];
  }

  $: {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        getRoleInfo(user.role).label.toLowerCase().includes(term)
      );
    } else {
      filteredUsers = users;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        👥 Gestión de Usuarios
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Administra los usuarios del sistema electoral
      </p>
    </div>

    {#if loaded}
      <!-- Acciones y búsqueda -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <!-- Búsqueda -->
          <div class="relative flex-1 w-full sm:max-w-md">
            <Search size={20} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              bind:value={searchTerm}
              placeholder="Buscar por nombre, email o rol..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <!-- Botones -->
          <div class="flex gap-3 w-full sm:w-auto">
            <button
              on:click={loadUsers}
              disabled={loading}
              class="flex-1 sm:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button
              on:click={openCreateModal}
              class="flex-1 sm:flex-none px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Nuevo Usuario
            </button>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {#each roles as role}
            {@const count = users.filter(u => u.role === role.value).length}
            <div class="p-3 rounded-lg border-2 {role.color} border-opacity-20">
              <div class="text-2xl mb-1">{role.icon}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">{role.label}</div>
              <div class="text-xl font-bold dark:text-white">{count}</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Lista de usuarios -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {#if loading && users.length === 0}
          <div class="p-12 text-center">
            <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-orange-600" />
            <p class="text-gray-600 dark:text-gray-400">Cargando usuarios...</p>
          </div>
        {:else if filteredUsers.length === 0}
          <div class="p-12 text-center">
            <User size={48} class="mx-auto mb-4 text-gray-400" />
            <h3 class="text-lg font-semibold mb-2 dark:text-white">
              {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Intenta con otro criterio de búsqueda' : 'Crea el primer usuario del sistema'}
            </p>
            
            {#if !searchTerm}
              <div class="max-w-md mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-left">
                <h4 class="font-semibold text-blue-800 dark:text-blue-200 mb-2">ℹ️ Primer uso:</h4>
                <ol class="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Asegúrate de tener rol "superadmin" o "admin"</li>
                  <li>Click en "Nuevo Usuario" para crear el primer usuario</li>
                  <li>La clase UserProfile se creará automáticamente</li>
                </ol>
              </div>
              
              <button
                on:click={openCreateModal}
                class="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Crear Primer Usuario
              </button>
            {/if}
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Rol
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                    Creado
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each filteredUsers as user}
                  {@const roleInfo = getRoleInfo(user.role)}
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    <td class="px-6 py-4 whitespace-nowrap">
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
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium {roleInfo.color}">
                        <span>{roleInfo.icon}</span>
                        <span>{roleInfo.label}</span>
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if user.active}
                        <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                          <CheckCircle size={14} />
                          Activo
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                          <XCircle size={14} />
                          Inactivo
                        </span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {new Date(user.createdAt).toLocaleDateString('es-BO')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          on:click={() => toggleUserStatus(user)}
                          class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition"
                          title={user.active ? 'Desactivar' : 'Activar'}
                          disabled={user.id === currentUser?.id}
                        >
                          {#if user.active}
                            <XCircle size={18} />
                          {:else}
                            <CheckCircle size={18} />
                          {/if}
                        </button>
                        <button
                          on:click={() => openEditModal(user)}
                          class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          on:click={() => deleteUser(user)}
                          class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Eliminar"
                          disabled={user.id === currentUser?.id}
                        >
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
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    {/if}
  </div>
</div>

<!-- Modal Crear/Editar Usuario -->
{#if showModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full my-8">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-2xl font-bold dark:text-white">
          {modalMode === 'create' ? '➕ Crear Usuario' : '✏️ Editar Usuario'}
        </h3>
      </div>

      <div class="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
        <!-- Username -->
        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">
            Nombre de Usuario <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            bind:value={formData.username}
            class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent {formErrors.username ? 'border-red-500' : ''}"
            placeholder="usuario123"
          />
          {#if formErrors.username}
            <p class="text-red-500 text-sm mt-1">{formErrors.username}</p>
          {/if}
        </div>

        <!-- Email -->
        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">
            Email <span class="text-red-500">*</span>
          </label>
          <input
            type="email"
            bind:value={formData.email}
            class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent {formErrors.email ? 'border-red-500' : ''}"
            placeholder="usuario@ejemplo.com"
          />
          {#if formErrors.email}
            <p class="text-red-500 text-sm mt-1">{formErrors.email}</p>
          {/if}
        </div>

        <!-- Password -->
        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">
            Contraseña {modalMode === 'edit' ? '(dejar en blanco para no cambiar)' : ''} {#if modalMode === 'create'}<span class="text-red-500">*</span>{/if}
          </label>
          <div class="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              bind:value={formData.password}
              class="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent {formErrors.password ? 'border-red-500' : ''}"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              on:click={() => showPassword = !showPassword}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              {#if showPassword}
                <EyeOff size={20} />
              {:else}
                <Eye size={20} />
              {/if}
            </button>
          </div>
          {#if formErrors.password}
            <p class="text-red-500 text-sm mt-1">{formErrors.password}</p>
          {/if}
        </div>

        <!-- Rol -->
        <div>
          <label class="block text-sm font-medium mb-2 dark:text-white">
            Rol <span class="text-red-500">*</span>
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each roles as role}
              <label class="relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition {formData.role === role.value ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'}">
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  bind:group={formData.role}
                  class="mt-1"
                />
                <div class="ml-3 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xl">{role.icon}</span>
                    <span class="font-semibold dark:text-white">{role.label}</span>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{role.description}</p>
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Estado -->
        <div>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={formData.active}
              class="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
            />
            <div>
              <span class="font-medium dark:text-white">Usuario Activo</span>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Los usuarios inactivos no pueden iniciar sesión
              </p>
            </div>
          </label>
        </div>
      </div>

      <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button
          on:click={closeModal}
          class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          Cancelar
        </button>
        <button
          on:click={handleSubmit}
          disabled={loading}
          class="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold disabled:opacity-50"
        >
          {loading ? 'Guardando...' : (modalMode === 'create' ? 'Crear Usuario' : 'Guardar Cambios')}
        </button>
      </div>
    </div>
  </div>
{/if}