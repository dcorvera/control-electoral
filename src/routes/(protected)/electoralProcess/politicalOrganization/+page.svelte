<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    getPoliticalOrganization,
    createPoliticalOrganization,
    updatePoliticalOrganization,
    deletePoliticalOrganization
  } from '$lib/services/politicalOrganizationService';
  import { getElectoralProcessActive } from '$lib/services/electoralProcessService';
  import type { PoliticalOrganization, Country, GeoPointData, PolygonData, ElectoralProcess } from '$lib/types/types';
  import { Trash2, Pencil } from 'lucide-svelte';

  // Leaflet se importará dinámicamente solo en el navegador
  let L: any;
  let leafletLoaded = false;

  let allpoliticalOrganization: PoliticalOrganization[] = [];
  let allProcess: ElectoralProcess[] = [];
  let loaded = false;
  let search = '';
  let sortKey: keyof PoliticalOrganization = 'id';
  let sortAsc = true;
  let currentPage = 1;
  const pageSize = 5;

  let showModal = false;
  let modalType: 'add' | 'edit' | 'delete' = 'add';
  let selected: PoliticalOrganization | null = null;

  // Formulario
  let formData = {
    sigla: '',
    name: '',
    color: '',
    electoralProcessId:''
  };
  let errors = {
    sigla: '',
    name: '',
    color: '',
    electoralProcessId:''
  };

  // Leaflet maps
  let mapPoint: any, pointMarker: any;
  let mapPolygon: any, drawnItems: any;

  // VALIDACIÓN
  function validateForm() {
    errors = { sigla:'', name:'', color:'', electoralProcessId:''};

    if (!formData.sigla.trim()) errors.sigla = 'La sigla es obligatoria';
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!formData.color.trim()) errors.color = 'El color es obligatorio';
    if (!formData.electoralProcessId) errors.electoralProcessId = 'Debe seleccionar un proceso electoral';

    return !errors.sigla && !errors.name && !errors.color && !errors.electoralProcessId;
  }

  // CARGA INICIAL
  onMount(async () => {
   if (browser) {
      // Cargar Leaflet dinámicamente solo en el navegador
      /*try {
        L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        await import('leaflet-draw');
        await import('leaflet-draw/dist/leaflet.draw.css');
        leafletLoaded = true;
      } catch (error) {
        console.error('Error cargando Leaflet:', error);
      }*/

      allpoliticalOrganization = await getPoliticalOrganization();
      allProcess = await getElectoralProcessActive();
      loaded = true;
    }
  });

  async function reload() {
    allpoliticalOrganization = await getPoliticalOrganization();
  }

  async function save() {
    if (!validateForm() || !browser) return;
    
    try {
      if (modalType === 'add') {
        await createPoliticalOrganization(formData);
      } else if (selected) {
        await updatePoliticalOrganization(selected.id || '', formData);
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
    await deletePoliticalOrganization(selected.id || '');
    await reload();
    close();
  }

  $: searchLower = search.toLowerCase();
  $: filtered = allpoliticalOrganization
    .filter(o => o.name.toLowerCase().includes(searchLower) || 
                 String(o.sigla).includes(search))
    .sort((a, b) => {
      const aVal = a[sortKey] as string | number;
      const bVal = b[sortKey] as string | number;
      return aVal < bVal ? (sortAsc ? -1 : 1) : aVal > bVal ? (sortAsc ? 1 : -1) : 0;
    });

  $: paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(filtered.length / pageSize);

  function sort(key: keyof PoliticalOrganization) {
    sortAsc = sortKey === key ? !sortAsc : true;
    sortKey = key;
  }

  function open(type: 'add' | 'edit' | 'delete', item?: PoliticalOrganization) {
    modalType = type;
    if (type === 'add') {
      formData = { sigla:'', name:'',color:'',electoralProcessId:''};
      selected = null;
    } else if (item) {
      formData = {
        sigla: item.sigla,
        name: item.name,
        color:item.color,
        electoralProcessId: item.electoralProcess?.id || '',
      };
      selected = item;
    }
    showModal = true;
  }

  function close() {
    showModal = false;
    selected = null;
    errors = { sigla:'', name:'', color:'',electoralProcessId:'' };
  }

</script>

<section class="space-y-6 w-full max-w-full overflow-x-hidden">
  <!-- HEADER -->
  <div class="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">
    <h1 class="text-3xl font-bold dark:text-white">Organizaciones Politica</h1>
    <button
      class="flex gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-md transition"
      on:click={() => open('add')}
    >
      <span class="text-sm font-semibold">Nuevo</span>
    </button>
  </div>

  <input
    type="text"
    placeholder="Buscar organización politica"
    bind:value={search}
    class="w-full px-4 py-2 rounded-xl border shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />

  {#if loaded}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto min-w-[600px]">
        <thead class="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
          <tr class="text-gray-700 dark:text-gray-300 uppercase text-xs">
            {#each [['id','ID'],['code','Código'],['name','Nombre','Proceso Electoral'],['electoralProcess','Proceso Electoral']] as [key,label]}
              <th
                class="px-3 sm:px-6 py-2 sm:py-3 text-left cursor-pointer select-none"
                on:click={() => sort(key as keyof PoliticalOrganization)}
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
                {(currentPage - 1) * pageSize + index + 1}
              </td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.sigla}</td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.name}</td>
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
        <h2 class="text-xl font-bold mb-4 dark:text-white">Eliminar Organización Politica</h2>
        <p class="mb-4 dark:text-gray-300">
          ¿Estás seguro de eliminar <strong>{selected.name}</strong>?
        </p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 dark:text-white" on:click={close}>Cancelar</button>
          <button class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white" on:click={deleteItem}>Eliminar</button>
        </div>
      {:else}
        <h2 class="text-xl font-bold mb-4 dark:text-white">{modalType === 'add' ? 'Agregar' : 'Editar'} politicalOrganizationo</h2>

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
              placeholder="Ej: Todos Unidos"
              bind:value={formData.name}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.name}<p class="text-red-500 text-xs mt-1">{errors.name}</p>{/if}
          </div>

          <!-- Sigla -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Sigla</label>
            <input
              type="text"
              placeholder="Ej: TU"
              bind:value={formData.sigla}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.sigla}<p class="text-red-500 text-xs mt-1">{errors.sigla}</p>{/if}
          </div>
<div>
  <label class="font-semibold dark:text-white text-sm mb-1 block">Color</label>

  <div class="relative w-10 h-10">
    <input
      type="color"
      bind:value={formData.color}
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    />

    <!-- Previsualización redonda -->
    <div
      class="w-full h-full rounded-full border shadow-md"
      style="background: {formData.color}"
    ></div>
  </div>

  {#if errors.color}
    <p class="text-red-500 text-xs mt-1">{errors.color}</p>
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
