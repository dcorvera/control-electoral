<script lang="ts">
  import { getCurrentUser } from '$lib/services/authService';

  let user = getCurrentUser();

</script>
{#if user}
<h1 class="text-2xl font-bold mb-4">Bienvenido, {user?.get('username')}</h1>
<p>Esta página solo es accesible si estás logueado.</p>
{/if}