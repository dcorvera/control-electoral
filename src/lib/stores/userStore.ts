import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getCurrentUser, getCurrentUserRole } from '$lib/services/authService';

// Store para el usuario actual
export const currentUser = writable<any>(null);

// Store para el rol del usuario
export const userRole = writable<string>('viewer');

// Store para verificar si está cargando
export const isLoadingUser = writable<boolean>(true);

// Derived store para verificar si el usuario es admin
export const isAdmin = derived(userRole, ($role) => $role === 'admin');

// Derived store para verificar si el usuario tiene permisos de escritura
export const canWrite = derived(userRole, ($role) => ['admin', 'user'].includes($role));

// Inicializar el usuario y su rol
export async function initUser() {
	if (!browser) return;
	
	isLoadingUser.set(true);
	
	const user = getCurrentUser();
	currentUser.set(user);
	
	if (user) {
		const role = await getCurrentUserRole();
		userRole.set(role);
		console.log('Usuario y rol cargados:', user.get('username'), role);
	}
	
	isLoadingUser.set(false);
}

// Limpiar stores al hacer logout
export function clearUser() {
	currentUser.set(null);
	userRole.set('viewer');
}