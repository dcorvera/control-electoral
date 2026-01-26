import Parse from '$lib/parseClient';
import { browser } from '$app/environment';

// -----------------------------
// Login de usuario
// -----------------------------
export async function login(username: string, password: string) {
	try {
		if (!browser) throw new Error("login solo se puede ejecutar en navegador");
		const user = await Parse.User.logIn(username, password);
		return user;
	} catch (error: any) {
		throw new Error(error.message || 'Error al iniciar sesión');
	}
}

// -----------------------------
// Registro de usuario
// -----------------------------
export async function signup(username: string, password: string, email: string) {
	const user = new Parse.User();
	user.set('username', username);
	user.set('password', password);
	user.set('email', email);

	try {
		const newUser = await user.signUp();
		return newUser;
	} catch (error: any) {
		throw new Error(error.message || 'Error al registrar usuario');
	}
}

// -----------------------------
// Logout
// -----------------------------
export async function logout() {
	try {
		if (!browser) return;
		await Parse.User.logOut();
	} catch (error: any) {
		throw new Error(error.message || 'Error al cerrar sesión');
	}
}

// -----------------------------
// Obtener usuario actual
// -----------------------------
export function getCurrentUser() {
	if (!browser) return null;
	if (!Parse.User) return null;
	const current = Parse.User.current();
	return current;
}

// -----------------------------
// Obtener roles del usuario actual desde la clase Role
// -----------------------------
export async function getCurrentUserRoles(): Promise<string[]> {
	try {
		if (!browser) return [];
		
		const user = getCurrentUser();
		if (!user) return [];

		// Consultar roles donde el usuario está incluido
		const roleQuery = new Parse.Query(Parse.Role);
		roleQuery.equalTo('users', user);
		
		const roles = await roleQuery.find();
		const roleNames = roles.map((role:any) => role.get('name'));
		
		console.log('Roles del usuario:', roleNames);
		return roleNames;
	} catch (error: any) {
		console.error('Error al obtener roles:', error);
		return [];
	}
}

// -----------------------------
// Obtener el rol principal (el primero o 'viewer' por defecto)
// -----------------------------
export async function getCurrentUserRole(): Promise<string> {
	const roles = await getCurrentUserRoles();
	
	// Prioridad: admin > user > viewer
	if (roles.includes('admin')) return 'admin';
	if (roles.includes('user')) return 'user';
	if (roles.includes('viewer')) return 'viewer';
	
	return roles.length > 0 ? roles[0] : 'viewer';
}

// -----------------------------
// Verificar si el usuario tiene un rol específico
// -----------------------------
export async function hasRole(roleName: string): Promise<boolean> {
	const roles = await getCurrentUserRoles();
	return roles.includes(roleName);
}

// -----------------------------
// Verificar si el usuario tiene uno de varios roles
// -----------------------------
export async function hasAnyRole(roleNames: string[]): Promise<boolean> {
	const roles = await getCurrentUserRoles();
	return roleNames.some(name => roles.includes(name));
}

// -----------------------------
// Agregar usuario a un rol
// -----------------------------
export async function addUserToRole(userId: string, roleName: string) {
	try {
		if (!browser) throw new Error("Solo en navegador");
		
		// Obtener el rol
		const roleQuery = new Parse.Query(Parse.Role);
		roleQuery.equalTo('name', roleName);
		const role = await roleQuery.first();
		
		if (!role) {
			throw new Error(`Rol '${roleName}' no encontrado`);
		}
		
		// Obtener el usuario
		const userQuery = new Parse.Query(Parse.User);
		const user = await userQuery.get(userId);
		
		// Agregar usuario al rol
		const relation = role.relation('users');
		relation.add(user);
		await role.save();
		
		console.log(`✅ Usuario agregado al rol '${roleName}'`);
		return role;
	} catch (error: any) {
		throw new Error(error.message || 'Error al agregar usuario al rol');
	}
}

// -----------------------------
// Remover usuario de un rol
// -----------------------------
export async function removeUserFromRole(userId: string, roleName: string) {
	try {
		if (!browser) throw new Error("Solo en navegador");
		
		const roleQuery = new Parse.Query(Parse.Role);
		roleQuery.equalTo('name', roleName);
		const role = await roleQuery.first();
		
		if (!role) {
			throw new Error(`Rol '${roleName}' no encontrado`);
		}
		
		const userQuery = new Parse.Query(Parse.User);
		const user = await userQuery.get(userId);
		
		const relation = role.relation('users');
		relation.remove(user);
		await role.save();
		
		console.log(`✅ Usuario removido del rol '${roleName}'`);
		return role;
	} catch (error: any) {
		throw new Error(error.message || 'Error al remover usuario del rol');
	}
}

// -----------------------------
// Crear un nuevo rol
// -----------------------------
export async function createRole(roleName: string) {
	try {
		if (!browser) throw new Error("Solo en navegador");
		
		// Verificar que el usuario actual sea admin
		const isAdmin = await hasRole('admin');
		if (!isAdmin) {
			throw new Error('No tienes permisos para crear roles');
		}
		
		const roleACL = new Parse.ACL();
		roleACL.setPublicReadAccess(true);
		roleACL.setPublicWriteAccess(false);
		
		const role = new Parse.Role(roleName, roleACL);
		await role.save();
		
		console.log(`✅ Rol '${roleName}' creado`);
		return role;
	} catch (error: any) {
		throw new Error(error.message || 'Error al crear rol');
	}
}

// -----------------------------
// Obtener todos los usuarios (solo admin)
// -----------------------------
export async function getAllUsers() {
	try {
		if (!browser) throw new Error("Solo en navegador");
		
		// Verificar que el usuario actual sea admin
		const isAdmin = await hasRole('admin');
		if (!isAdmin) {
			throw new Error('No tienes permisos para ver todos los usuarios');
		}
		
		const query = new Parse.Query(Parse.User);
		const users = await query.find();
		return users;
	} catch (error: any) {
		throw new Error(error.message || 'Error al obtener usuarios');
	}
}