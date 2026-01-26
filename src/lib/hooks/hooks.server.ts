import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Aquí podrías verificar la sesión del lado del servidor
	// Por ahora, la protección principal estará del lado del cliente
	
	const response = await resolve(event);
	return response;
};