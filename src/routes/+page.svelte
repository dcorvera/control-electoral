<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getCurrentUser } from '$lib/services/authService';

  onMount(() => {
    const user = getCurrentUser();

    if (user) {
      // Si está logueado → al dashboard
      goto('/dashboard');
    } else {
      // Si no está logueado → al login
      goto('/login');
    }
  });
</script>

<p>Cargando...</p>
