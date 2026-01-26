<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/userStore';
  import { goto } from '$app/navigation';
  import '../../app.css';

  let checked = false;      // ✅ Controla si ya verificamos al usuario
  let redirecting = false;  // ✅ Evita mostrar el login mientras redirige

  onMount(() => {
    const unsubscribe = currentUser.subscribe((u) => {
      if (u) {
        redirecting = true;
        goto('/dashboard', { replaceState: true }); // 🔁 Redirige sin mostrar login
      } else {
        checked = true; // ✅ Solo muestra el login si NO hay usuario
      }
    });

    return unsubscribe;
  });
</script>

{#if checked && !redirecting}
  <slot /> <!-- 🔹 Muestra el login solo cuando se confirmó que no hay sesión -->
{/if}
