<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    getElectoralProcess,
    createElectoralProcess,
    updateElectoralProcess,
    deleteElectoralProcess
  } from '$lib/services/electoralProcessService';
  import type { ElectoralProcess } from '$lib/types/types';
  import { Trash2, Pencil } from 'lucide-svelte';

  let allElectoralProcess: ElectoralProcess[] = [];
  let loaded = false;
  let search = '';
  let sortKey: keyof ElectoralProcess = 'id';
  let sortAsc = true;
  let currentPage = 1;
  const pageSize = 5;

  let showModal = false;
  let modalType: 'add' | 'edit' | 'delete' = 'add';
  let selected: ElectoralProcess | null = null;
  let formData = { name: '', year: new Date().getFullYear(), type:'Nacional', state: 'Activo' };
  let errors = { name: '', year: '' };

  function validateForm() {
    errors = { name: '', year: '' };
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio';
    const yearNum = Number(formData.year);
    if (!formData.year || yearNum < 1900 || yearNum > 2100) errors.year = 'Año válido (1900-2100)';
    return !errors.name && !errors.year;
  }

  onMount(async () => {
    if (browser) {
      allElectoralProcess = await getElectoralProcess();
      loaded = true;
    }
  });

  async function reload() {
    allElectoralProcess = await getElectoralProcess();
  }

  async function save() {
    if (!validateForm() || !browser) return;
    if (modalType === 'add') {
      await createElectoralProcess(formData);
    } else if (selected) {
      await updateElectoralProcess(selected.id || '', formData);
    }
    await reload();
    close();
  }

  async function deleteItem() {
    if (!selected || !browser) return;
    await deleteElectoralProcess(selected.id || '');
    await reload();
    close();
  }

  $: searchLower = search.toLowerCase();
  $: filtered = allElectoralProcess
    .filter(o => o.name.toLowerCase().includes(searchLower) || 
                 o.state.toLowerCase().includes(searchLower) || 
                 String(o.year).includes(search))
    .sort((a, b) => {
      const aVal = a[sortKey] as string | number;
      const bVal = b[sortKey] as string | number;
      return aVal < bVal ? (sortAsc ? -1 : 1) : aVal > bVal ? (sortAsc ? 1 : -1) : 0;
    });

  $: paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(filtered.length / pageSize);

  function sort(key: keyof ElectoralProcess) {
    sortAsc = sortKey === key ? !sortAsc : true;
    sortKey = key;
  }

  function open(type: 'add' | 'edit' | 'delete', item?: ElectoralProcess) {
    modalType = type;
    if (type === 'add') {
      formData = { name: '', year: new Date().getFullYear(), type:'Nacional', state: 'Activo' };
      selected = null;
    } else if (item) {
      formData = { name: item.name, year: item.year, type: item.type, state: item.state };
      selected = item;
    }
    showModal = true;
  }

  function close() {
    showModal = false;
    selected = null;
    errors = { name: '', year: '' };
  }
</script>

<section class="space-y-6 w-full max-w-full overflow-x-hidden">

  <!-- HEADER 100% RESPONSIVE -->
  <div class="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">  <!-- <-- añadido responsive -->
    <h1 class="text-3xl font-bold dark:text-white">Procesos Electorales</h1>
    <button
      class="flex gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-md transition"
      on:click={() => open('add')}
    >
      <span class="text-sm font-semibold">Nuevo</span>
    </button>
  </div>

  <input
    type="text"
    placeholder="Buscar proceso..."
    bind:value={search}
    class="w-full px-4 py-2 rounded-xl border shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />

  {#if loaded}
 <div class="overflow-x-auto w-full">
    <table class="w-full table-auto min-w-[600px]"> <!-- ancho mínimo opcional -->
 <!-- <-- añadido responsive -->
      <thead class="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
        <tr class="text-gray-700 dark:text-gray-300 uppercase text-xs">
          {#each [['id','ID'],['name','Nombre'],['year','Año'],['type','Tipo'],['state','Estado']] as [key,label]}
            <th 
              class="px-3 sm:px-6 py-2 sm:py-3 text-left cursor-pointer select-none"  
              on:click={() => sort(key as keyof ElectoralProcess)}
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

            <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.name}</td>
            <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.year}</td>
            <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.type}</td>

            <td class="px-3 sm:px-6 py-2 sm:py-4">
              <span class="px-3 py-1 rounded-full text-xs font-semibold 
                {row.state === 'Activo' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}">
                {row.state}
              </span>
            </td>

            <td class="px-3 sm:px-6 py-2 sm:py-4">
              <div class="flex justify-end gap-3">
                <button
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition"
                  on:click={() => open('edit', row)}
                >
                  <Pencil size={16} />
                  <span class="text-xs">Editar</span>
                </button>
                <button
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition"
                  on:click={() => open('delete', row)}
                >
                  <Trash2 size={16} />
                  <span class="text-xs">Borrar</span>
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

  </div>
  {:else}
    <div class="flex flex-wrap justify-center gap-3">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    </div>
  {/if}

  {#if loaded}
<!-- PAGINACIÓN RESPONSIVE -->
<div class="flex flex-wrap justify-center gap-2 sm:gap-3"> <!-- <- menos espacio en móviles -->
  <button
    on:click={() => currentPage > 1 && currentPage--}
    class="px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow hover:shadow-md transition disabled:opacity-30"
    disabled={currentPage === 1}
  >
    ⟵
  </button>

  <span class="px-2 sm:px-5 py-1 sm:py-2 rounded-full bg-orange-600 text-white shadow-md font-semibold text-xs sm:text-sm">
    {currentPage} / {totalPages}
  </span>

  <button
    on:click={() => currentPage < totalPages && currentPage++}
    class="px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow hover:shadow-md transition disabled:opacity-30"
    disabled={currentPage === totalPages}
  >
    ⟶
  </button>
</div>

  {/if}
</section>

<!-- MODAL RESPONSIVE -->
{#if showModal}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 border dark:border-gray-700 p-6 rounded-xl shadow-xl w-full max-w-sm sm:max-w-md"> <!-- <-- responsive -->
      
      {#if modalType === 'delete' && selected}
        <h2 class="text-xl font-bold mb-4 dark:text-white">Eliminar Proceso Electoral</h2>
        <p class="mb-4 dark:text-gray-300">
          ¿Estás seguro de eliminar <strong>{selected.name}</strong>?
        </p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 dark:text-white" on:click={close}>
            Cancelar
          </button>
          <button class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white" on:click={deleteItem}>
            Eliminar
          </button>
        </div>

      {:else}

        <h2 class="text-xl font-bold mb-4 dark:text-white">
          {modalType === 'add' ? 'Agregar' : 'Editar'} Proceso Electoral
        </h2>

        <div class="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Nombre"
              bind:value={formData.name}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.name}<p class="text-red-500 text-xs mt-1">{errors.name}</p>{/if}
          </div>

          <div>
            <input
              type="number"
              placeholder="Año"
              bind:value={formData.year}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.year}<p class="text-red-500 text-xs mt-1">{errors.year}</p>{/if}
          </div>

          <select
            bind:value={formData.type}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="Nacional">Nacional</option>
            <option value="Departamental">Departamental</option>
            <option value="Municipal">Municipal</option>
          </select>

          <select
            bind:value={formData.state}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <button class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 dark:text-white" on:click={close}>
            Cancelar
          </button>
          <button class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white" on:click={save}>
            Guardar
          </button>
        </div>

      {/if}

    </div>
  </div>
{/if}
