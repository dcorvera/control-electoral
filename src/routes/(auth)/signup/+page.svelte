<script lang="ts">
	import { signup } from '$lib/services/authService';
	import { goto } from '$app/navigation';

	let username = '';
	let password = '';
	let email = '';
	let error = '';
	let loading = false;

	async function handleSignup() {
		error = '';
		loading = true;
		try {
			const user = await signup(username, password, email);
			console.log('Usuario registrado:', user.getUsername());
			goto('/login'); // redirige al login
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}
</script>

<form on:submit|preventDefault={handleSignup}>
	<input type="text" placeholder="Usuario" bind:value={username} />
	<input type="email" placeholder="Email" bind:value={email} />
	<input type="password" placeholder="Contraseña" bind:value={password} />
	<button type="submit">{loading ? 'Cargando...' : 'Registrar'}</button>
	{#if error}<p>{error}</p>{/if}
</form>
