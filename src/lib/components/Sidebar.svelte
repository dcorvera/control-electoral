<script lang="ts">
	import { Home, Users, BarChart3, Menu, LogOut, FileText, Settings, ChevronLeft, ChevronRight,Globe, Vote } from 'lucide-svelte';
	import { logout } from '$lib/services/authService';
	import { clearUser, currentUser, userRole} from '$lib/stores/userStore';
	import { goto } from '$app/navigation';

	let collapsed = false;

	// Define todos los items del menú con sus roles permitidos
	const allMenuItems = [
	{ 
		name: 'Inicio', 
		path: '/dashboard', 
		icon: Home,
		roles: ['superadmin','admin', 'user', 'viewer']
	},
	{ 
		name: 'Usuarios', 
		path: '/users', 
		icon: Users,
		roles: ['superadmin','admin']
	},
	{ 
		name: 'Proceso Electoral', 
		//path: '/electoralProcess/list', 
		icon: Vote,
		roles: ['superadmin'],
		children: [
				{
				name: 'Lista de Procesos',
				path: '/electoralProcess/list',
				roles: ['superadmin']
			},
				{
				name: 'Organizaciones Politicas',
				path: '/electoralProcess/politicalOrganization',
				roles: ['superadmin']
			},
		]
	},
	{ 
		name: 'Geografía',
		icon: Globe,
		roles: ['superadmin'],
		children: [
			{
				name: 'Países',
				path: '/geografy/country',
				roles: ['superadmin']
			},
			{
				name: 'Departamentos',
				path: '/geografy/departaments',
				roles: ['superadmin']
			},
			{
				name: 'Provincias',
				path: '/geografy/provinces',
				roles: ['superadmin']
			},
			{
				name: 'Municipios',
				path: '/geografy/municipalities',
				roles: ['superadmin']
			},
			{
				name: 'Localidades',
				path: '/geografy/locations',
				roles: ['superadmin']
			},
			{
				name: 'Recintos',
				path: '/geografy/precinct',
				roles: ['superadmin']
			},
		]
	},
	{ 
		name: 'Configuración', 
		path: '/settings', 
		icon: Settings,
		roles: ['superadmin']
	}
];


	// Filtra el menú según el rol del usuario (reactivo)
	$: menuItems = allMenuItems.filter(item => item.roles.includes($userRole));

	function toggleSidebar() {
		collapsed = !collapsed;
	}

	async function handleLogout() {
		await logout();
		clearUser();
		goto('/login');
	}

	let openSubmenus = new Set();

function toggleSubmenu(name: string) {
	if (openSubmenus.has(name)) {
		openSubmenus.delete(name);
	} else {
		openSubmenus.add(name);
	}
	// Forzar reactividad
	openSubmenus = new Set(openSubmenus);
}
</script>
<aside
	class="bg-gray-900 dark:bg-gray-800 text-white h-screen flex flex-col transition-all duration-300 ease-in-out relative"
	class:w-64={!collapsed}
	class:w-20={collapsed}
>
	<!-- Encabezado mejorado -->
	<div class="relative p-4 border-b border-gray-700">
		<div class="flex items-center justify-between">
			<!-- Logo y texto -->
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">
					CE
				</div>
				{#if !collapsed}
					<div class="transition-opacity duration-200">
						<h1 class="text-lg font-bold">Control Electoral</h1>
						<p class="text-xs text-gray-400">Sistema de Gestión</p>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Botón de colapsar (fuera del contenedor) -->
		<button 
			on:click={toggleSidebar} 
			class="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 border-2 border-gray-900 z-10"
			title={collapsed ? 'Expandir' : 'Contraer'}
		>
			{#if collapsed}
				<ChevronRight size={14} />
			{:else}
				<ChevronLeft size={14} />
			{/if}
		</button>
	</div>

	<!-- Info del Usuario -->
	{#if $currentUser && !collapsed}
		<div class="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold text-sm">
					{$currentUser.get('username').charAt(0).toUpperCase()}
				</div>
				<div>
					<p class="text-sm font-medium">{$currentUser.get('username')}</p>
					<p class="text-xs text-gray-400 capitalize flex items-center gap-1">
						<span class="w-2 h-2 rounded-full bg-green-500"></span>
						{$userRole}
					</p>
				</div>
			</div>
		</div>
	{:else if $currentUser && collapsed}
		<div class="px-4 py-3 border-b border-gray-700 flex justify-center">
			<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold text-sm">
				{$currentUser.get('username').charAt(0).toUpperCase()}
			</div>
		</div>
	{/if}

	<!-- Menú -->
<nav class="flex-1 p-3 space-y-1 overflow-y-auto">
	{#each menuItems as item}

		<!-- Si NO tiene children → item normal -->
		{#if !item.children}
			<a
				href={item.path}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700 transition group"
				title={collapsed ? item.name : ''}
			>
				<svelte:component this={item.icon} size={20} class="flex-shrink-0" />
				<span
					class="whitespace-nowrap overflow-hidden transition-all duration-300"
					class:w-0={collapsed}
					class:opacity-0={collapsed}
				>{item.name}</span>
			</a>

		{:else}
		<!-- Si TIENE children → submenú -->
			<div>
				<button 
					on:click={() => toggleSubmenu(item.name)}
					class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700 transition group"
					title={collapsed ? item.name : ''}
				>
					<svelte:component this={item.icon} size={20} />
					<span
						class="whitespace-nowrap overflow-hidden transition-all duration-300"
						class:w-0={collapsed}
						class:opacity-0={collapsed}
					>
						{item.name}
					</span>

					<!-- Flecha 
					{#if !collapsed}
						<ChevronRight 
							size={16}
							class="ml-auto transition-transform"
							class:rotate-90={openSubmenus.has(item.name)}
						/>
					{/if}-->
					{#if !collapsed}
						<ChevronRight 
							size={16}
							class="ml-auto transition-transform"
						/>
					{/if}
				</button>

				<!-- Contenido del submenú -->
				{#if openSubmenus.has(item.name) && !collapsed}
					<div class="ml-6 mt-1 space-y-1">
						{#each item.children as child}
							<a 
								href={child.path}
								class="block px-3 py-2 rounded-lg hover:bg-gray-700/70 transition text-sm"
							>
								{child.name}
							</a>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

	{/each}
</nav>


	<!-- Logout -->
	<div class="p-3 border-t border-gray-700">
		<button
			on:click={handleLogout}
			class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-600 transition w-full group"
			title={collapsed ? 'Cerrar Sesión' : ''}
		>
			<LogOut size={20} class="flex-shrink-0" />
			<span
				class="whitespace-nowrap overflow-hidden transition-all duration-300"
				class:w-0={collapsed}
				class:opacity-0={collapsed}
			>
				Cerrar Sesión
			</span>
		</button>
	</div>
</aside>

