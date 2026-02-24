<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  import {
    getPartyParticipations,
    createPartyParticipation,
    updatePartyParticipation,
    deletePartyParticipation
  } from '$lib/services/partyParticipationService';

  import { getPoliticalOrganization } from '$lib/services/politicalOrganizationService';
  import { getElectoralPositions } from '$lib/services/electoralPositionService';
  import { getElectoralProcessActive } from '$lib/services/electoralProcessService';

  // Importar servicios de geografía
  import { getDepartments } from '$lib/services/departamentService';
  import { getProvincesByDepartment } from '$lib/services/provinceService';
  import { getMunicipalitiesByProvince } from '$lib/services/municipalityService';

  import type {
    PartyParticipation,
    PoliticalOrganization,
    ElectoralPosition,
    ElectoralProcess,
    Departament,
    Province,
    Municipality
  } from '$lib/types/types';

  import { Trash2, Pencil } from 'lucide-svelte';

  let loaded = false;
  let search = '';
  let currentPage = 1;
  const pageSize = 5;
  let isSaving = false;

  let allItems: PartyParticipation[] = [];
  let allParties: PoliticalOrganization[] = [];
  let allPositions: ElectoralPosition[] = [];
  let allProcess: ElectoralProcess[] = [];
  
  // Datos geográficos
  let allDepartments: Departament[] = [];
  let availableProvinces: Province[] = [];
  let availableMunicipalities: Municipality[] = [];

  let showModal = false;
  let modalType: 'add' | 'edit' | 'delete' = 'add';
  let selected: PartyParticipation | null = null;

  // Para modo edición (un solo partido)
  let formData = {
    politicalOrganizationId: '',
    electoralPositionId: '',
    electoralProcessId: '',
    order: 1,
    enabled: true,
    departmentId: '',
    provinceId: '',
    municipalityId: ''
  };

  // Para modo agregar múltiples partidos
  let selectedParties: Set<string> = new Set();
  let multiFormData = {
    electoralPositionId: '',
    electoralProcessId: '',
    startOrder: 1,
    enabled: true,
    departmentId: '',
    provinceId: '',
    municipalityId: ''
  };

  let errors = {
    politicalOrganizationId: '',
    electoralPositionId: '',
    electoralProcessId: '',
    order: '',
    selectedParties: '',
    departmentId: '',
    provinceId: '',
    municipalityId: ''
  };

  // Reactive: Obtener el cargo seleccionado y su alcance
  $: selectedPosition = modalType === 'add' 
    ? allPositions.find(p => p.id === multiFormData.electoralPositionId)
    : allPositions.find(p => p.id === formData.electoralPositionId);

  $: positionScope = selectedPosition?.scope || null; // 'DEPARTAMENTAL', 'PROVINCIAL', 'MUNICIPAL'

  // Los partidos políticos NO tienen restricción geográfica
  // Todos los partidos están disponibles para cualquier alcance
  $: filteredParties = allParties;

  function validateForm() {
    errors = {
      politicalOrganizationId: '',
      electoralPositionId: '',
      electoralProcessId: '',
      order: '',
      selectedParties: '',
      departmentId: '',
      provinceId: '',
      municipalityId: ''
    };

    const data = modalType === 'add' ? multiFormData : formData;

    if (modalType === 'add') {
      // Validación para modo múltiple
      if (selectedParties.size === 0) {
        errors.selectedParties = 'Debe seleccionar al menos un partido';
      }
      if (!multiFormData.electoralPositionId) {
        errors.electoralPositionId = 'Seleccione un cargo';
      }
      if (!multiFormData.electoralProcessId) {
        errors.electoralProcessId = 'Seleccione un proceso electoral';
      }
      if (multiFormData.startOrder <= 0) {
        errors.order = 'El orden debe ser mayor a 0';
      }
    } else {
      // Validación para modo edición
      if (!formData.politicalOrganizationId) {
        errors.politicalOrganizationId = 'Seleccione un partido';
      }
      if (!formData.electoralPositionId) {
        errors.electoralPositionId = 'Seleccione un cargo';
      }
      if (!formData.electoralProcessId) {
        errors.electoralProcessId = 'Seleccione un proceso electoral';
      }
      if (formData.order <= 0) {
        errors.order = 'El orden debe ser mayor a 0';
      }
    }

    // Validar alcance geográfico según el cargo
    if (positionScope === 'DEPARTAMENTAL' && !data.departmentId) {
      errors.departmentId = 'Seleccione un departamento';
    }
    if (positionScope === 'PROVINCIAL' && !data.provinceId) {
      errors.provinceId = 'Seleccione una provincia';
    }
    if (positionScope === 'MUNICIPAL' && !data.municipalityId) {
      errors.municipalityId = 'Seleccione un municipio';
    }

    return !Object.values(errors).some(Boolean);
  }

  onMount(async () => {
    if (!browser) return;

    try {
      allItems = await getPartyParticipations();
      allParties = await getPoliticalOrganization();
      allPositions = await getElectoralPositions();
      allProcess = await getElectoralProcessActive();
      allDepartments = await getDepartments();
      loaded = true;
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    }
  });

  async function reload() {
    allItems = await getPartyParticipations();
  }

  // Cargar provincias cuando se selecciona un departamento
  async function onDepartmentChange(departmentId: string, isMultiMode: boolean = false, skipReset: boolean = false) {
    if (departmentId) {
      try {
        availableProvinces = await getProvincesByDepartment(departmentId);
      } catch (error) {
        console.error('Error cargando provincias:', error);
        availableProvinces = [];
      }
    } else {
      availableProvinces = [];
    }
    
    // Resetear provincia y municipio SOLO si no es una carga inicial de edición
    if (!skipReset) {
      if (isMultiMode) {
        multiFormData.provinceId = '';
        multiFormData.municipalityId = '';
      } else {
        formData.provinceId = '';
        formData.municipalityId = '';
      }
      availableMunicipalities = [];
    }
  }

  // Cargar municipios cuando se selecciona una provincia
  async function onProvinceChange(provinceId: string, isMultiMode: boolean = false, skipReset: boolean = false) {
    if (provinceId) {
      try {
        availableMunicipalities = await getMunicipalitiesByProvince(provinceId);
      } catch (error) {
        console.error('Error cargando municipios:', error);
        availableMunicipalities = [];
      }
    } else {
      availableMunicipalities = [];
    }
    
    // Resetear municipio SOLO si no es una carga inicial de edición
    if (!skipReset) {
      if (isMultiMode) {
        multiFormData.municipalityId = '';
      } else {
        formData.municipalityId = '';
      }
    }
  }

  // Resetear selección geográfica cuando cambia el cargo
  function onPositionChange(isMultiMode: boolean = false) {
    if (isMultiMode) {
      multiFormData.departmentId = '';
      multiFormData.provinceId = '';
      multiFormData.municipalityId = '';
    } else {
      formData.departmentId = '';
      formData.provinceId = '';
      formData.municipalityId = '';
    }
    availableProvinces = [];
    availableMunicipalities = [];
    selectedParties = new Set(); // Limpiar partidos seleccionados
  }

  async function save() {
    if (!validateForm()) {
      return;
    }

    isSaving = true;

    try {
      if (modalType === 'add') {
        // Crear múltiples asignaciones
        const partiesArray = Array.from(selectedParties);
        let currentOrder = multiFormData.startOrder;

        for (const partyId of partiesArray) {
          // Construir el payload base
          const payload: any = {
            politicalOrganizationId: partyId,
            electoralPositionId: multiFormData.electoralPositionId,
            electoralProcessId: multiFormData.electoralProcessId,
            order: currentOrder,
            enabled: multiFormData.enabled
          };

          // Agregar IDs geográficos SOLO si están definidos
          if (positionScope === 'DEPARTAMENTAL' && multiFormData.departmentId) {
            payload.departmentId = multiFormData.departmentId;
          } else if (positionScope === 'PROVINCIAL' && multiFormData.provinceId) {
            payload.provinceId = multiFormData.provinceId;
            // Incluir departmentId también para provincial
            if (multiFormData.departmentId) {
              payload.departmentId = multiFormData.departmentId;
            }
          } else if (positionScope === 'MUNICIPAL' && multiFormData.municipalityId) {
            payload.municipalityId = multiFormData.municipalityId;
            // Incluir provinceId y departmentId también para municipal
            if (multiFormData.provinceId) {
              payload.provinceId = multiFormData.provinceId;
            }
            if (multiFormData.departmentId) {
              payload.departmentId = multiFormData.departmentId;
            }
          }

          console.log('Creando asignación con payload:', payload);
          await createPartyParticipation(payload);
          currentOrder++;
        }

        alert(`${partiesArray.length} partido(s) asignado(s) exitosamente`);
      } else if (selected) {
        // Editar una asignación existente
        const payload: any = {
          politicalOrganizationId: formData.politicalOrganizationId,
          electoralPositionId: formData.electoralPositionId,
          electoralProcessId: formData.electoralProcessId,
          order: formData.order,
          enabled: formData.enabled
        };
        
        // Agregar IDs geográficos SOLO si están definidos
        if (positionScope === 'DEPARTAMENTAL' && formData.departmentId) {
          payload.departmentId = formData.departmentId;
        } else if (positionScope === 'PROVINCIAL' && formData.provinceId) {
          payload.provinceId = formData.provinceId;
          if (formData.departmentId) {
            payload.departmentId = formData.departmentId;
          }
        } else if (positionScope === 'MUNICIPAL' && formData.municipalityId) {
          payload.municipalityId = formData.municipalityId;
          if (formData.provinceId) {
            payload.provinceId = formData.provinceId;
          }
          if (formData.departmentId) {
            payload.departmentId = formData.departmentId;
          }
        }

        console.log('Actualizando asignación con payload:', payload);
        await updatePartyParticipation(selected.id!, payload);
        alert('Asignación actualizada exitosamente');
      }

      await reload();
      close();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      
      // Mostrar mensaje de error más detallado
      const errorMessage = error?.message || error?.toString() || 'Error desconocido';
      alert(`Error al guardar: ${errorMessage}\n\nRevise la consola para más detalles.`);
    } finally {
      isSaving = false;
    }
  }

  async function deleteItem() {
    if (!selected) return;

    try {
      await deletePartyParticipation(selected.id!);
      await reload();
      close();
      alert('Asignación eliminada exitosamente');
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar. Por favor intente de nuevo.');
    }
  }

  async function open(type: 'add' | 'edit' | 'delete', item?: PartyParticipation) {
    modalType = type;

    if (type === 'add') {
      selectedParties = new Set();
      multiFormData = {
        electoralPositionId: '',
        electoralProcessId: '',
        startOrder: 1,
        enabled: true,
        departmentId: '',
        provinceId: '',
        municipalityId: ''
      };
      selected = null;
      availableProvinces = [];
      availableMunicipalities = [];
    } else if (item) {
      selected = item;
      formData = {
        politicalOrganizationId: item.politicalOrganization.id!,
        electoralPositionId: item.electoralPosition.id!,
        electoralProcessId: item.electoralProcess.id!,
        order: item.order,
        enabled: item.enabled,
        departmentId: item.department?.id || '',
        provinceId: item.province?.id || '',
        municipalityId: item.municipality?.id || ''
      };

      // Cargar provincias y municipios si existen - con skipReset=true para NO borrar los valores
      if (item.department?.id) {
        await onDepartmentChange(item.department.id, false, true);
      }
      if (item.province?.id) {
        await onProvinceChange(item.province.id, false, true);
      }
    }

    errors = {
      politicalOrganizationId: '',
      electoralPositionId: '',
      electoralProcessId: '',
      order: '',
      selectedParties: '',
      departmentId: '',
      provinceId: '',
      municipalityId: ''
    };
    showModal = true;
  }

  function close() {
    showModal = false;
    selected = null;
    selectedParties = new Set();
    availableProvinces = [];
    availableMunicipalities = [];
    errors = {
      politicalOrganizationId: '',
      electoralPositionId: '',
      electoralProcessId: '',
      order: '',
      selectedParties: '',
      departmentId: '',
      provinceId: '',
      municipalityId: ''
    };
  }

  function toggleParty(partyId: string) {
    if (selectedParties.has(partyId)) {
      selectedParties.delete(partyId);
    } else {
      selectedParties.add(partyId);
    }
    selectedParties = selectedParties; // Trigger reactivity
  }

  function selectAll() {
    selectedParties = new Set(filteredParties.map(p => p.id!));
  }

  function deselectAll() {
    selectedParties = new Set();
  }

  $: searchLower = search.toLowerCase();
  $: filtered = allItems.filter(i =>
    i.politicalOrganization.name.toLowerCase().includes(searchLower) ||
    i.politicalOrganization.sigla.toLowerCase().includes(searchLower)
  );

  $: paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(filtered.length / pageSize);
</script>

<section class="space-y-6 w-full max-w-full overflow-x-hidden">

  <!-- HEADER -->
  <div class="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">
    <h1 class="text-3xl font-bold dark:text-white">Asignación de Partidos</h1>
    <button
      class="flex gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-md transition"
      on:click={() => open('add')}
    >
      <span class="text-sm font-semibold">Nuevo</span>
    </button>
  </div>

  <!-- SEARCH -->
  <input
    type="text"
    placeholder="Buscar partido"
    bind:value={search}
    class="w-full px-4 py-2 rounded-xl border shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />

  {#if loaded}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto min-w-[700px]">
        <thead class="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
          <tr class="text-gray-700 dark:text-gray-300 uppercase text-xs">
            <th class="px-6 py-3 text-left">#</th>
            <th class="px-6 py-3 text-left">Partido</th>
            <th class="px-6 py-3 text-left">Cargo</th>
            <th class="px-6 py-3 text-left">Proceso</th>
            <th class="px-6 py-3 text-left">Alcance</th>
            <th class="px-6 py-3 text-left">Orden</th>
            <th class="px-6 py-3 text-left">Estado</th>
            <th class="px-6 py-3 text-right">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y dark:divide-gray-700">
          {#each paginated as row, index (row.id)}
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <td class="px-6 py-4">{(currentPage - 1) * pageSize + index + 1}</td>
              <td class="px-6 py-4 font-medium">{row.politicalOrganization.sigla}</td>
              <td class="px-6 py-4">{row.electoralPosition.name}</td>
              <td class="px-6 py-4">{row.electoralProcess.name}</td>
              <td class="px-6 py-4 text-xs">
                {#if row.department}
                  {row.department.name}
                {:else if row.province}
                  {row.province.name}
                {:else if row.municipality}
                  {row.municipality.name}
                {:else}
                  Nacional
                {/if}
              </td>
              <td class="px-6 py-4">{row.order}</td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs {row.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}">
                  {row.enabled ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td class="px-6 py-4">
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

    <!-- PAGINATION -->
    {#if totalPages > 1}
      <div class="flex justify-center gap-2 mt-4">
        <button
          class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
          disabled={currentPage === 1}
          on:click={() => currentPage--}
        >
          Anterior
        </button>
        <span class="px-3 py-1 dark:text-white">
          Página {currentPage} de {totalPages}
        </span>
        <button
          class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
          disabled={currentPage === totalPages}
          on:click={() => currentPage++}
        >
          Siguiente
        </button>
      </div>
    {/if}
  {:else}
    <div class="text-center py-8 dark:text-white">Cargando...</div>
  {/if}
</section>

<!-- MODAL -->
{#if showModal}
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div class="bg-white dark:bg-gray-900 border dark:border-gray-700 p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    {#if modalType === 'delete'}
      <h2 class="text-xl font-bold mb-4 dark:text-white">Eliminar Asignación</h2>
      <p class="mb-4 dark:text-gray-300">
        ¿Está seguro de eliminar la asignación del partido <strong>{selected?.politicalOrganization.sigla}</strong>?
      </p>
      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition"
          on:click={close}
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
          on:click={deleteItem}
        >
          Eliminar
        </button>
      </div>

    {:else if modalType === 'add'}
      <h2 class="text-xl font-bold mb-4 dark:text-white">Asignar Partidos</h2>

      <div class="space-y-4">
        <!-- Proceso Electoral -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Proceso Electoral *</label>
          <select
            bind:value={multiFormData.electoralProcessId}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.electoralProcessId ? 'border-red-500' : ''}"
          >
            <option value="">Seleccione un proceso</option>
            {#each allProcess as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          {#if errors.electoralProcessId}
            <p class="text-red-500 text-xs mt-1">{errors.electoralProcessId}</p>
          {/if}
        </div>

        <!-- Cargo Electoral -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Cargo Electoral *</label>
          <select
            bind:value={multiFormData.electoralPositionId}
            on:change={() => onPositionChange(true)}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.electoralPositionId ? 'border-red-500' : ''}"
          >
            <option value="">Seleccione un cargo</option>
            {#each allPositions as c}
              <option value={c.id}>{c.name} ({c.scope || 'Nacional'})</option>
            {/each}
          </select>
          {#if errors.electoralPositionId}
            <p class="text-red-500 text-xs mt-1">{errors.electoralPositionId}</p>
          {/if}
        </div>

        <!-- ALCANCE GEOGRÁFICO -->
        {#if positionScope}
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              📍 Alcance: {positionScope}
            </p>

            <!-- Departamento -->
            {#if positionScope === 'DEPARTAMENTAL' || positionScope === 'PROVINCIAL' || positionScope === 'MUNICIPAL'}
              <div class="mb-3">
                <label class="block text-sm font-medium mb-1 dark:text-white">Departamento *</label>
                <select
                  bind:value={multiFormData.departmentId}
                  on:change={() => onDepartmentChange(multiFormData.departmentId, true)}
                  class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.departmentId ? 'border-red-500' : ''}"
                >
                  <option value="">Seleccione un departamento</option>
                  {#each allDepartments as dept}
                    <option value={dept.id}>{dept.name}</option>
                  {/each}
                </select>
                {#if errors.departmentId}
                  <p class="text-red-500 text-xs mt-1">{errors.departmentId}</p>
                {/if}
              </div>
            {/if}

            <!-- Provincia -->
            {#if (positionScope === 'PROVINCIAL' || positionScope === 'MUNICIPAL') && multiFormData.departmentId}
              <div class="mb-3">
                <label class="block text-sm font-medium mb-1 dark:text-white">Provincia *</label>
                <select
                  bind:value={multiFormData.provinceId}
                  on:change={() => onProvinceChange(multiFormData.provinceId, true)}
                  class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.provinceId ? 'border-red-500' : ''}"
                >
                  <option value="">Seleccione una provincia</option>
                  {#each availableProvinces as prov}
                    <option value={prov.id}>{prov.name}</option>
                  {/each}
                </select>
                {#if errors.provinceId}
                  <p class="text-red-500 text-xs mt-1">{errors.provinceId}</p>
                {/if}
              </div>
            {/if}

            <!-- Municipio -->
            {#if positionScope === 'MUNICIPAL' && multiFormData.provinceId}
              <div>
                <label class="block text-sm font-medium mb-1 dark:text-white">Municipio *</label>
                <select
                  bind:value={multiFormData.municipalityId}
                  class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.municipalityId ? 'border-red-500' : ''}"
                >
                  <option value="">Seleccione un municipio</option>
                  {#each availableMunicipalities as mun}
                    <option value={mun.id}>{mun.name}</option>
                  {/each}
                </select>
                {#if errors.municipalityId}
                  <p class="text-red-500 text-xs mt-1">{errors.municipalityId}</p>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Orden Inicial -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Orden Inicial *</label>
          <input
            type="number"
            min="1"
            bind:value={multiFormData.startOrder}
            placeholder="Orden en acta (1, 2, 3...)"
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.order ? 'border-red-500' : ''}"
          />
          {#if errors.order}
            <p class="text-red-500 text-xs mt-1">{errors.order}</p>
          {/if}
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            El orden se incrementará automáticamente para cada partido seleccionado
          </p>
        </div>

        <!-- Habilitado -->
        <label class="flex items-center gap-2 text-sm dark:text-white">
          <input type="checkbox" bind:checked={multiFormData.enabled} class="rounded" />
          Habilitado
        </label>

        <!-- Selección de Partidos -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-medium dark:text-white">
              Partidos Políticos * ({selectedParties.size} seleccionados)
            </label>
            <div class="flex gap-2">
              <button
                type="button"
                class="text-xs text-blue-600 hover:underline dark:text-blue-400 disabled:opacity-50"
                on:click={selectAll}
                disabled={filteredParties.length === 0}
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                class="text-xs text-red-600 hover:underline dark:text-red-400"
                on:click={deselectAll}
              >
                Deseleccionar todos
              </button>
            </div>
          </div>
          
          <div class="border rounded-lg p-3 max-h-60 overflow-y-auto dark:border-gray-700 {errors.selectedParties ? 'border-red-500' : ''}">
            {#if filteredParties.length > 0}
              {#each filteredParties as party}
                <label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedParties.has(party.id!)}
                    on:change={() => toggleParty(party.id!)}
                    class="rounded"
                  />
                  <span class="text-sm dark:text-white">
                    <strong>{party.sigla}</strong> - {party.name}
                  </span>
                </label>
              {/each}
            {:else}
              <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No hay partidos disponibles
              </p>
            {/if}
          </div>
          {#if errors.selectedParties}
            <p class="text-red-500 text-xs mt-1">{errors.selectedParties}</p>
          {/if}
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <button
          class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition"
          on:click={close}
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-50"
          on:click={save}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

    {:else if modalType === 'edit'}
      <h2 class="text-xl font-bold mb-4 dark:text-white">Editar Asignación</h2>

      <div class="space-y-4">
        <!-- Proceso Electoral -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Proceso Electoral *</label>
          <select
            bind:value={formData.electoralProcessId}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.electoralProcessId ? 'border-red-500' : ''}"
          >
            <option value="">Seleccione un proceso</option>
            {#each allProcess as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          {#if errors.electoralProcessId}
            <p class="text-red-500 text-xs mt-1">{errors.electoralProcessId}</p>
          {/if}
        </div>

        <!-- Cargo Electoral -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Cargo Electoral *</label>
          <select
            bind:value={formData.electoralPositionId}
            on:change={() => onPositionChange(false)}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.electoralPositionId ? 'border-red-500' : ''}"
          >
            <option value="">Seleccione un cargo</option>
            {#each allPositions as c}
              <option value={c.id}>{c.name} ({c.scope || 'Nacional'})</option>
            {/each}
          </select>
          {#if errors.electoralPositionId}
            <p class="text-red-500 text-xs mt-1">{errors.electoralPositionId}</p>
          {/if}
        </div>

        <!-- ALCANCE GEOGRÁFICO (Modo Edición) -->
        {#if positionScope}
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              📍 Alcance: {positionScope}
            </p>

            <!-- Departamento -->
            {#if positionScope === 'DEPARTAMENTAL' || positionScope === 'PROVINCIAL' || positionScope === 'MUNICIPAL'}
              <div class="mb-3">
                <label class="block text-sm font-medium mb-1 dark:text-white">Departamento *</label>
                <select
                  bind:value={formData.departmentId}
                  on:change={() => onDepartmentChange(formData.departmentId, false)}
                  class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Seleccione un departamento</option>
                  {#each allDepartments as dept}
                    <option value={dept.id}>{dept.name}</option>
                  {/each}
                </select>
              </div>
            {/if}

            <!-- Provincia -->
            {#if (positionScope === 'PROVINCIAL' || positionScope === 'MUNICIPAL') && formData.departmentId}
              <div class="mb-3">
                <label class="block text-sm font-medium mb-1 dark:text-white">Provincia *</label>
                <select
                  bind:value={formData.provinceId}
                  on:change={() => onProvinceChange(formData.provinceId, false)}
                  class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Seleccione una provincia</option>
                  {#each availableProvinces as prov}
                    <option value={prov.id}>{prov.name}</option>
                  {/each}
                </select>
              </div>
            {/if}

            <!-- Municipio -->
            {#if positionScope === 'MUNICIPAL' && formData.provinceId}
              <div>
                <label class="block text-sm font-medium mb-1 dark:text-white">Municipio *</label>
                <select
                  bind:value={formData.municipalityId}
                  class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Seleccione un municipio</option>
                  {#each availableMunicipalities as mun}
                    <option value={mun.id}>{mun.name}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Partido Político -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Partido Político *</label>
          <select
            bind:value={formData.politicalOrganizationId}
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.politicalOrganizationId ? 'border-red-500' : ''}"
          >
            <option value="">Seleccione un partido</option>
            {#each filteredParties as p}
              <option value={p.id}>{p.sigla} - {p.name}</option>
            {/each}
          </select>
          {#if errors.politicalOrganizationId}
            <p class="text-red-500 text-xs mt-1">{errors.politicalOrganizationId}</p>
          {/if}
        </div>

        <!-- Orden -->
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-white">Orden *</label>
          <input
            type="number"
            min="1"
            bind:value={formData.order}
            placeholder="Orden en acta"
            class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white {errors.order ? 'border-red-500' : ''}"
          />
          {#if errors.order}
            <p class="text-red-500 text-xs mt-1">{errors.order}</p>
          {/if}
        </div>

        <!-- Habilitado -->
        <label class="flex items-center gap-2 text-sm dark:text-white">
          <input type="checkbox" bind:checked={formData.enabled} class="rounded" />
          Habilitado
        </label>
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <button
          class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition"
          on:click={close}
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-50"
          on:click={save}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    {/if}
  </div>
</div>
{/if}