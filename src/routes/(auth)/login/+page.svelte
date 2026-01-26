<script lang="ts">
	import { login } from '$lib/services/authService';
	import { goto } from '$app/navigation';
	import { initUser } from '$lib/stores/userStore';
	import { getCurrentUser } from '$lib/services/authService';

	let user = getCurrentUser();
	let username = '';
	let password = '';
	let error = '';
	let loading = false;

	async function handleLogin() {
		console.log('Intentando iniciar sesión...');
		error = '';
		loading = true;

		try {
			await login(username, password);
			
			// Inicializar usuario y rol en el store
			await initUser();
			
			goto('/dashboard', { replaceState: true });
		} catch (err) {
			error = 'Usuario o contraseña incorrectos';
		} finally {
			loading = false;
		}
	}
</script>

{#if !user}
	<div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
		<div
			class="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors duration-300"
		>
			<h1 class="text-2xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-100">
				Iniciar sesión
			</h1>

			{#if error}
				<p class="text-red-500 text-sm mb-4 text-center">{error}</p>
			{/if}

			<form on:submit|preventDefault={handleLogin} class="space-y-4">
				<!-- Usuario -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Usuario
					</label>
					<input
						type="text"
						placeholder="Tu usuario"
						bind:value={username}
						required
						disabled={loading}
						class="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
					/>
				</div>

				<!-- Contraseña -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Contraseña
					</label>
					<input
						type="password"
						placeholder="••••••••"
						bind:value={password}
						required
						disabled={loading}
						class="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
					/>
				</div>

				<!-- Botón -->
				<button
					type="submit"
					disabled={loading}
					class="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Iniciando sesión...' : 'Ingresar'}
				</button>
			</form>
		</div>
	</div>
{/if}