import { goto } from '$app/navigation';
import { getCurrentUser, getCurrentUserRole } from '$lib/services/authService';

// Configuración de rutas protegidas
export const routePermissions: Record<string, string[]> = {
	'/dashboard': ['superadmin', 'admin', 'user','viewer','digitalizacion', 'transcripcion', 'validacion'],
	'/users': ['superadmin'],
	'/reports': ['superadmin'],
	
	// Proceso Electoral
	'/electoralProcess': ['superadmin','admin'],
	'/electoralProcess/list': ['superadmin','admin'],
	'/electoralProcess/politicalOrganization': ['superadmin','admin'],
	'/electoralProcess/electoralPosition': ['superadmin','admin'],
	'/electoralProcess/partyParticipation': ['superadmin','admin'],
	
	// Gestión de Actas (solo superadmin)
	'/electoralProcess/actas/generation': ['superadmin'],
	'/electoralProcess/actas/view': ['superadmin','admin','digitalizacion', 'transcripcion', 'validacion'],
	
	// Flujo de Actas (por roles específicos)
	'/electoralProcess/actas/scan': ['superadmin', 'admin', 'digitalizacion'],
	'/electoralProcess/actas/transcript': ['superadmin', 'admin', 'transcripcion'],
	'/electoralProcess/actas/validation': ['superadmin', 'admin', 'validacion'],
	'/electoralProcess/observed': ['superadmin', 'admin'],
	'/electoralProcess/results': ['superadmin', 'admin','viewer'],
	
	// Geografía
	'/geografy/country': ['superadmin'],
	'/geografy/departaments': ['superadmin'],
	'/geografy/provinces': ['superadmin'],
	'/geografy/municipalities': ['superadmin'],
	'/geografy/locations': ['superadmin'],
	'/geografy/precinct': ['superadmin'],
	
	// Configuración
	'/settings': ['superadmin']
};

// Verifica si el usuario tiene acceso a una ruta
export async function checkRouteAccess(pathname: string): Promise<boolean> {
	const user = getCurrentUser();

	// Si no hay usuario, redirigir a login
	if (!user) {
		goto('/login');
		return false;
	}

	// Obtener permisos de la ruta
	const requiredRoles = routePermissions[pathname];

	// Si la ruta no está en la configuración, permitir acceso
	if (!requiredRoles) {
		return true;
	}

	// Verificar rol del usuario
	const userRole = await getCurrentUserRole();

	if (!requiredRoles.includes(userRole)) {
		console.warn(`Acceso denegado: rol '${userRole}' no tiene permiso para '${pathname}'`);
		goto('/dashboard'); // Redirigir a dashboard si no tiene permiso
		return false;
	}

	return true;
}

// Guard para usar en layouts
export async function requireAuth() {
	const user = getCurrentUser();
	if (!user) {
		goto('/login');
		return false;
	}
	return true;
}

// Guard para requerir rol específico
export async function requireRole(role: string) {
	const user = getCurrentUser();
	if (!user) {
		goto('/login');
		return false;
	}

	const userRole = await getCurrentUserRole();
	if (userRole !== role) {
		goto('/dashboard');
		return false;
	}

	return true;
}

// Guard para requerir cualquiera de varios roles
export async function requireAnyRole(roles: string[]) {
	const user = getCurrentUser();
	if (!user) {
		goto('/login');
		return false;
	}

	const userRole = await getCurrentUserRole();
	if (!roles.includes(userRole)) {
		goto('/dashboard');
		return false;
	}

	return true;
}