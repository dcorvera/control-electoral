<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    getElectoralPositions,
    createElectoralPosition,
    updateElectoralPosition,
    deleteElectoralPosition
  } from '$lib/services/electoralPositionService';
  import { getElectoralProcessActive } from '$lib/services/electoralProcessService';
  import type { ElectoralPosition, ElectoralProcess } from '$lib/types/types';
  import { Trash2, Pencil } from 'lucide-svelte';

  // Leaflet se importará dinámicamente solo en el navegador
  let L: any;
  let leafletLoaded = false;

  let allElectoralPosition: ElectoralPosition[] = [];
  let allProcess: ElectoralProcess[] = [];
  let loaded = false;
  let search = '';
  let sortKey: keyof ElectoralPosition = 'id';
  let sortAsc = true;
  let currentPage = 1;
  const pageSize = 5;

  let showModal = false;
  let modalType: 'add' | 'edit' | 'delete' = 'add';
  let selected: ElectoralPosition | null = null;

  // Formulario
  let formData: {
    name: string;
    scope: 'DEPARTAMENTAL' | 'PROVINCIAL' | 'MUNICIPAL' | '';
    order: number;
    electoralProcessId: string;
  } = {
    name: '',
    scope: '',
    order: 1,
    electoralProcessId:''
  };
  
  let errors = {
    name: '',
    scope: '',
    order: '',
    electoralProcessId:''
  };

  const scopes = [
    { value: 'DEPARTAMENTAL', label: 'Departamental' },
    { value: 'PROVINCIAL', label: 'Provincial' },
    { value: 'MUNICIPAL', label: 'Municipal' }
  ];


  // VALIDACIÓN
  function validateForm() {
    errors = { name:'', scope:'', order:'', electoralProcessId:''};

    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!formData.scope) errors.scope = 'El alcance es obligatorio';
    if (!formData.order || formData.order < 1) errors.order = 'El orden debe ser mayor a 0';
    if (!formData.electoralProcessId) errors.electoralProcessId = 'Debe seleccionar un proceso electoral';

    return !errors.name && !errors.scope && !errors.order && !errors.electoralProcessId;
  }

  // CARGA INICIAL
  onMount(async () => {
   if (browser) {
      allElectoralPosition = await getElectoralPositions();
      allProcess = await getElectoralProcessActive();
      loaded = true;
    }
  });

  async function reload() {
    allElectoralPosition = await getElectoralPositions();
  }

  async function save() {
    if (!validateForm() || !browser) return;
    
    try {
      console.log(formData);
      if (modalType === 'add') {
        await createElectoralPosition(formData as any);
      } else if (selected) {
        await updateElectoralPosition(selected.id || '', formData as any);
      }
      await reload();
      close();
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar: ' + (error as Error).message);
    }
  }

  async function deleteItem() {
    if (!selected || !browser) return;
    await deleteElectoralPosition(selected.id || '');
    await reload();
    close();
  }

  $: searchLower = search.toLowerCase();
  $: filtered = allElectoralPosition  
    .filter(o => o.name.toLowerCase().includes(searchLower) || 
                 String(o.scope).includes(search))
    .sort((a, b) => {
      const aVal = a[sortKey] as string | number | undefined || '';
      const bVal = b[sortKey] as string | number | undefined || '';
      return aVal < bVal ? (sortAsc ? -1 : 1) : aVal > bVal ? (sortAsc ? 1 : -1) : 0;
    });

  $: paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(filtered.length / pageSize);

  function sort(key: keyof ElectoralPosition) {
    sortAsc = sortKey === key ? !sortAsc : true;
    sortKey = key;
  }

  function open(type: 'add' | 'edit' | 'delete', item?: ElectoralPosition) {
    modalType = type;
    if (type === 'add') {
      formData = { name:'', scope:'', order:1, electoralProcessId:''};
      selected = null;
    } else if (item) {
      formData = {
        name: item.name,
        scope: item.scope,
        order:item.order,
        electoralProcessId: item.electoralProcess?.id || '',
      };
      selected = item;
    }
    showModal = true;
  }

  function close() {
    showModal = false;
    selected = null;
    errors = { name:'', scope:'', order:'',electoralProcessId:'' };
  }

</script>

<section class="space-y-6 w-full max-w-full overflow-x-hidden">
  <!-- HEADER --> 
  <div class="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">
    <h1 class="text-3xl font-bold dark:text-white">Cargos Electorales</h1>
    <button
      class="flex gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-md transition"
      on:click={() => open('add')}
    >
      <span class="text-sm font-semibold">Nuevo Cargo</span>
    </button>
  </div>

  <input
    type="text"
    placeholder="Buscar cargo electoral..."
    bind:value={search}
    class="w-full px-4 py-2 rounded-xl border shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />

  {#if loaded}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto min-w-[600px]">
        <thead class="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
          <tr class="text-gray-700 dark:text-gray-300 uppercase text-xs">
            {#each [['order','Orden'],['name','Nombre'],['scope','Alcance'],['electoralProcess','Proceso Electoral']] as [key,label]}
              <th
                class="px-3 sm:px-6 py-2 sm:py-3 text-left cursor-pointer select-none"
                on:click={() => sort(key as keyof ElectoralPosition)}
              >
                {label} <span class="ml-1">{sortKey === key ? (sortAsc ? '▲' : '▼') : ''}</span>
              </th>
            {/each}
            <th class="px-3 sm:px-6 py-2 sm:py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-gray-700">
          {#each paginated as row, index (row.id)}
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200 font-medium">
                {row.order}
              </td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200 font-semibold">{row.name}</td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">
                <span class="px-2 py-1 rounded-full text-xs font-semibold 
                  {row.scope === 'DEPARTAMENTAL' ? 'bg-blue-100 text-blue-800' : 
                   row.scope === 'PROVINCIAL' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}">
                  {row.scope}
                </span>
              </td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.electoralProcess.name}</td>
              <td class="px-3 sm:px-6 py-2 sm:py-4">
                <div class="flex justify-end gap-3">
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition"
                    on:click={() => open('edit', row)}
                  >
                    <Pencil size={16} /><span class="text-xs">Editar</span>
                  </button>
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition"
                    on:click={() => open('delete', row)}
                  >
                    <Trash2 size={16} /><span class="text-xs">Borrar</span>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- PAGINACIÓN -->
    <div class="flex flex-wrap justify-center gap-2 sm:gap-3 mt-4">
      <button
        on:click={() => currentPage > 1 && currentPage--}
        class="px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow hover:shadow-md transition disabled:opacity-30"
        disabled={currentPage === 1}
      >⟵</button>

      <span class="px-2 sm:px-5 py-1 sm:py-2 rounded-full bg-orange-600 text-white shadow-md font-semibold text-xs sm:text-sm">
        {currentPage} / {totalPages}
      </span>

      <button
        on:click={() => currentPage < totalPages && currentPage++}
        class="px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow hover:shadow-md transition disabled:opacity-30"
        disabled={currentPage === totalPages}
      >⟶</button>
    </div>
  {:else}
    <div class="flex flex-wrap justify-center gap-3 mt-4">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    </div>
  {/if}
</section>

<!-- MODAL -->
{#if showModal}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-900 border dark:border-gray-700 p-6 rounded-xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
      {#if modalType === 'delete' && selected}
        <h2 class="text-xl font-bold mb-4 dark:text-white">Eliminar Cargo Electoral</h2>
        <p class="mb-4 dark:text-gray-300">
          ¿Estás seguro de eliminar <strong>{selected.name}</strong>?
        </p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 dark:text-white" on:click={close}>Cancelar</button>
          <button class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white" on:click={deleteItem}>Eliminar</button>
        </div>
      {:else}
        <h2 class="text-xl font-bold mb-4 dark:text-white">{modalType === 'add' ? 'Agregar' : 'Editar'} Cargo Electoral</h2>

        <div class="space-y-4">
          <!-- COUNTRY SELECT -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Proceso Electoral</label>
            <select bind:value={formData.electoralProcessId} class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="" disabled selected>Seleccione un proceso electoral</option>
              {#each allProcess as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
            {#if errors.electoralProcessId}<p class="text-red-500 text-xs mt-1">{errors.electoralProcessId}</p>{/if}
          </div>

          <!-- NAME -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Gobernador, Alcalde..."
              bind:value={formData.name}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.name}<p class="text-red-500 text-xs mt-1">{errors.name}</p>{/if}
          </div>

          <!-- SCOPE -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Alcance</label>
             <select bind:value={formData.scope} class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="">Seleccione un alcance</option>
              {#each scopes as s}
                <option value={s.value}>{s.label}</option>
              {/each}
            </select>
            {#if errors.scope}<p class="text-red-500 text-xs mt-1">{errors.scope}</p>{/if}
          </div>

          <!-- ORDER -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Orden (Prioridad en actas)</label>
            <input
              type="number"
              min="1"
              placeholder="Ej: 1"
              bind:value={formData.order}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.order}
              <p class="text-red-500 text-xs mt-1">{errors.order}</p>
            {/if}
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 dark:text-white hover:bg-gray-400 dark:hover:bg-gray-600 transition" on:click={close}>Cancelar</button>
          <button class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition" on:click={save}>Guardar</button>
        </div>
      {/if}
    </div>
  </div>
{/if}
