<script lang="ts">
	import { Home, Users, BarChart3, Menu, LogOut, Settings, ChevronLeft, ChevronRight, Globe, Vote, X } from 'lucide-svelte';
	import { logout } from '$lib/services/authService';
	import { clearUser, currentUser, userRole} from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let collapsed = false;
	let mobileMenuOpen = false;
	let isMobile = false;

	// Detectar si es móvil
	onMount(() => {
		const checkMobile = () => {
			isMobile = window.innerWidth < 1024;
			if (!isMobile) {
				mobileMenuOpen = false;
			}
		};
		
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});

	// Define todos los items del menú con sus roles permitidos
	const allMenuItems = [
		{ 
			name: 'Inicio', 
			path: '/dashboard', 
			icon: Home,
			roles: ['superadmin','admin', 'user', 'viewer','digitalizacion', 'transcripcion', 'validacion']
		},
		{ 
			name: 'Usuarios', 
			path: '/users', 
			icon: Users,
			roles: ['superadmin']
		},
		{ 
			name: 'Proceso Electoral', 
			icon: Vote,
			roles: ['superadmin','admin', 'digitalizacion', 'transcripcion', 'validacion','viewer'],
			children: [
				// Administración
				{
					name: 'Configuración',
					header: true,
					roles: ['superadmin','admin']
				},
				{
					name: 'Lista de Procesos',
					path: '/electoralProcess/list',
							roles: ['superadmin','admin']
				},
				{
					name: 'Organizaciones Políticas',
					path: '/electoralProcess/politicalOrganization',
					roles: ['superadmin','admin']
				},
				{
					name: 'Cargos Políticos',
					path: '/electoralProcess/electoralPosition',
					roles: ['superadmin','admin']
				},
				{
					name: 'Asignación de Partidos',
					path: '/electoralProcess/partyParticipation',
					roles: ['superadmin','admin']
				},
				{
					name: 'Gestión de Actas',
					path: '/electoralProcess/actas/generation',
					roles: ['superadmin']
				},
				{
					name: 'Ver Actas',
					path: '/electoralProcess/actas/view',
					roles: ['superadmin', 'admin','digitalizacion', 'transcripcion', 'validacion']
				},
				
				// Flujo de trabajo
				{
					name: 'Flujo de Trabajo',
					header: true,
					roles: ['superadmin', 'admin','digitalizacion', 'transcripcion', 'validacion']
				},
				{
					name: '📸 Digitalizar',
					path: '/electoralProcess/actas/scan',
					roles: ['superadmin', 'admin', 'digitalizacion']
				},
				{
					name: '✍️ Transcribir',
					path: '/electoralProcess/actas/transcript',
					roles: ['superadmin', 'admin', 'transcripcion']
				},
				{
					name: '✅ Validar',
					path: '/electoralProcess/actas/validation',
					roles: ['superadmin', 'admin', 'validacion']
				},
				{
					name: '⚠️ Observadas',
					path: '/electoralProcess/actas/observed',
					roles: ['superadmin', 'admin']
				},
				
				// Resultados
				{
					name: 'Resultados',
					header: true,
					roles: ['superadmin', 'admin']
				},
				{
					name: '📊 Reportes',
					path: '/electoralProcess/results',
					roles: ['superadmin', 'admin','viewer']
				}
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
				}
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

	let openSubmenus = new Set();

	function toggleSubmenu(name: string) {
		if (openSubmenus.has(name)) {
			openSubmenus.delete(name);
		} else {
			openSubmenus.add(name);
		}
		openSubmenus = new Set(openSubmenus);
	}

	function toggleSidebar() {
		collapsed = !collapsed;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	async function handleLogout() {
		await logout();
		clearUser();
		goto('/login');
	}

	// Cerrar menú móvil al navegar
	function handleNavigation() {
		if (isMobile) {
			mobileMenuOpen = false;
		}
	}
</script>

<!-- Botón hamburguesa móvil -->
{#if isMobile}
	<button
		on:click={toggleMobileMenu}
		class="fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg lg:hidden"
	>
		{#if mobileMenuOpen}
			<X size={24} />
		{:else}
			<Menu size={24} />
		{/if}
	</button>
{/if}

<!-- Overlay móvil -->
{#if isMobile && mobileMenuOpen}
	<div 
		class="fixed inset-0 bg-black/50 z-30 lg:hidden"
		on:click={toggleMobileMenu}
	></div>
{/if}

<!-- Sidebar -->
<aside
	class="bg-gray-900 dark:bg-gray-800 text-white flex flex-col transition-all duration-300 ease-in-out
		{isMobile ? 'fixed inset-y-0 left-0 z-40' : 'sticky top-0 h-screen'} 
		{isMobile && !mobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
		{!isMobile && collapsed ? 'w-20' : 'w-64'}"
>
	<!-- Encabezado -->
	<div class="relative p-4 border-b border-gray-700">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">
					CE
				</div>
				{#if !collapsed || isMobile}
					<div class="transition-opacity duration-200">
						<h1 class="text-lg font-bold">Control Electoral</h1>
						<p class="text-xs text-gray-400">Sistema de Gestión</p>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Botón colapsar (solo desktop) -->
		{#if !isMobile}
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
		{/if}
	</div>

	<!-- Info del Usuario -->
	{#if $currentUser && (!collapsed || isMobile)}
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
	{:else if $currentUser && collapsed && !isMobile}
		<div class="px-4 py-3 border-b border-gray-700 flex justify-center">
			<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold text-sm">
				{$currentUser.get('username').charAt(0).toUpperCase()}
			</div>
		</div>
	{/if}

	<!-- Menú -->
	<nav class="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
		{#each menuItems as item}
			{#if !item.children}
				<!-- Item sin hijos -->
				<a
					href={item.path}
					on:click={handleNavigation}
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700 transition group"
					title={collapsed && !isMobile ? item.name : ''}
				>
					<svelte:component this={item.icon} size={20} class="flex-shrink-0" />
					{#if !collapsed || isMobile}
						<span class="whitespace-nowrap overflow-hidden">{item.name}</span>
					{/if}
				</a>
			{:else}
				<!-- Item con submenú -->
				<div>
					<button 
						on:click={() => toggleSubmenu(item.name)}
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700 transition group"
						title={collapsed && !isMobile ? item.name : ''}
					>
						<svelte:component this={item.icon} size={20} class="flex-shrink-0" />
						{#if !collapsed || isMobile}
							<span class="whitespace-nowrap overflow-hidden flex-1 text-left">
								{item.name}
							</span>
							<ChevronRight 
								size={16}
								class="transition-transform {openSubmenus.has(item.name) ? 'rotate-90' : ''}"
							/>
						{/if}
					</button>

					<!-- Submenú -->
					{#if openSubmenus.has(item.name) && (!collapsed || isMobile)}
						<div class="mt-1 space-y-1">
							{#each item.children.filter(child => child.roles.includes($userRole)) as child}
								{#if child.header}
									<!-- Header de sección -->
									<div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">
										{child.name}
									</div>
								{:else}
									<!-- Item normal -->
									<a 
										href={child.path}
										on:click={handleNavigation}
										class="block px-3 py-2 ml-6 rounded-lg hover:bg-gray-700/70 transition text-sm"
									>
										{child.name}
									</a>
								{/if}
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
			title={collapsed && !isMobile ? 'Cerrar Sesión' : ''}
		>
			<LogOut size={20} class="flex-shrink-0" />
			{#if !collapsed || isMobile}
				<span class="whitespace-nowrap overflow-hidden">Cerrar Sesión</span>
			{/if}
		</button>
	</div>
</aside>

<style>
	/* Scrollbar personalizado para el menú */
	nav::-webkit-scrollbar {
		width: 6px;
	}

	nav::-webkit-scrollbar-track {
		background: rgba(31, 41, 55, 0.5); /* gray-800 con opacidad */
		border-radius: 10px;
	}

	nav::-webkit-scrollbar-thumb {
		background: rgba(75, 85, 99, 0.8); /* gray-600 */
		border-radius: 10px;
		transition: background 0.2s;
	}

	nav::-webkit-scrollbar-thumb:hover {
		background: rgba(107, 114, 128, 1); /* gray-500 */
	}

	/* Para Firefox */
	nav {
		scrollbar-width: thin;
		scrollbar-color: rgba(75, 85, 99, 0.8) rgba(31, 41, 55, 0.5);
	}

	/* Smooth scrolling */
	nav {
		scroll-behavior: smooth;
	}
</style>