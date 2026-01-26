<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    getPrecincts,
    createPrecinct,
    updatePrecinct,
    deletePrecinct
  } from '$lib/services/precintService';
  import {
    getPollingTablesByPrecinct,
    createPollingTable,
    //deletePollingTable
  } from '$lib/services/pollingTableService';
  import { getCountry } from '$lib/services/countryService';
  import type { Precinct, PollingTable, Country, GeoPointData, Departament, Province, Locality, Municipality } from '$lib/types/types';
  import { Trash2, Pencil, Table, Upload } from 'lucide-svelte';
  import { getDepartaments } from '$lib/services/departamentService';
  import { getprovinces } from '$lib/services/provinceService';
  import { getLocalitys } from '$lib/services/localityService';
  import { getmunicipalitys } from '$lib/services/municipalityService';

    // Agregar al inicio del componente de Recintos
import { importGeographyFromExcel } from '$lib/services/geographyImportService';

// Agregar estas variables
let showImportModal = false;
let importFile: File | null = null;
let importing = false;
let importResult = null;

// Agregar estas funciones
async function handleImport() {
  if (!importFile) return;
  
  importing = true;
  try {
    importResult = await importGeographyFromExcel(importFile);
    await reload(); // Recargar recintos
    alert(`✅ Importación completada: ${importResult.tables} mesas creadas`);
  } catch (error:any) {
    alert('Error en la importación: ' + error.message);
  } finally {
    importing = false;
  }
}

  let L: any;
  let leafletLoaded = false;

  let allPrecincts: Precinct[] = [];
  let allCountries: Country[] = [];
  let allDepartaments: Departament[] = [];
  let allProvincies: Province[] = [];
  let allMunicipalities: Municipality[] = [];
  let allLocalitys: Locality[] = [];

  let loaded = false;
  let search = '';
  let sortKey: keyof Precinct = 'id';
  let sortAsc = true;
  let currentPage = 1;
  const pageSize = 5;

  let showModal = false;
  let modalType: 'add' | 'edit' | 'delete' = 'add';
  let selected: Precinct | null = null;

  // Modal de Mesas
  let showTablesModal = false;
  let selectedPrecinctForTables: Precinct | null = null;
  let pollingTables: PollingTable[] = [];
  let loadingTables = false;
  
  // Formulario para nueva mesa individual
  let newTableNumber = 0;
  let newTableType = '';
  let newTableInscribed = 0;
  let newTableActCode = 0;
  
  // Generación automática de mesas
  let showAutoGenerateModal = false;
  let autoGenerateCount = 0;
  let autoGenerateType = 'Normal';
  let autoGenerateStartNumber = 1;
  let autoGenerateInscribedPerTable = 0;

  let formData = {
    code: 0,
    name: '',
    localityId:'',
    countryId: '',
    departamentId: '',
    provinceId: '', 
    municipalityId: '',
    location: undefined as GeoPointData | undefined
  };

  let errors = {
    code: '',
    name: '',
    localityId:'',
    countryId: '',
    departamentId: '',
    provinceId: '',
    municipalityId: '',
    location: ''
  };

  let mapPoint: any, pointMarker: any;

  $: filteredDepartaments = formData.countryId 
    ? allDepartaments.filter(d => d.country?.id === formData.countryId)
    : [];

  $: if (formData.countryId) {
    const currentDept = allDepartaments.find(d => d.id === formData.departamentId);
    if (currentDept && currentDept.country?.id !== formData.countryId) {
      formData.departamentId = '';
    }
  }

  $: filteredProvincies= formData.departamentId
    ? allProvincies.filter(d => d.departament?.id === formData.departamentId)
    : [];

  $: if (formData.departamentId) {
    const currentProv = allProvincies.find(d => d.id === formData.provinceId);
    if (currentProv && currentProv.departament?.id !== formData.departamentId) {
      formData.provinceId = '';
    }
  }

  $: filteredMunicipalities= formData.provinceId
    ? allMunicipalities.filter(d => d.province?.id === formData.provinceId)
    : [];

  $: if (formData.provinceId) {
    const currentMun = allMunicipalities.find(d => d.id === formData.municipalityId);
    if (currentMun && currentMun.province?.id !== formData.provinceId) {
      formData.municipalityId= '';
    }
  }

  $: filteredLocalitys= formData.municipalityId
    ? allLocalitys.filter(d => d.municipality?.id === formData.municipalityId)
    : [];

  $: if (formData.municipalityId) {
    const currentLoc = allLocalitys.find(d => d.id === formData.localityId);
    if (currentLoc && currentLoc.municipality?.id !== formData.municipalityId) {
      formData.localityId = '';
    }
  }

  function validateForm() {
    errors = { code:'', name:'', localityId:'',countryId:'', departamentId:'',provinceId:'',municipalityId: '', location:'' };

    if (formData.code <=0) errors.code = 'El código es obligatorio';
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!formData.countryId) errors.countryId = 'Debe seleccionar un país';
    if (!formData.departamentId) errors.departamentId = 'Debe seleccionar un departamento';
    if (!formData.provinceId) errors.provinceId = 'Debe seleccionar una provincia';
    if (!formData.municipalityId) errors.municipalityId = 'Debe seleccionar un municipio';
    if (!formData.localityId) errors.localityId = 'Debe seleccionar una localidad';
    if (!formData.location) errors.location = 'Debe seleccionar una ubicación en el mapa';

    return !errors.code && !errors.name && !errors.countryId && !errors.departamentId && !errors.location;
  }

  onMount(async () => {
    if (browser) {
      try {
        L = (await import('leaflet')).default;
        const link1 = document.createElement('link');
        link1.rel = 'stylesheet';
        link1.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link1);
        leafletLoaded = true;
      } catch (error) {
        console.error('Error cargando Leaflet:', error);
      }
      allPrecincts = await getPrecincts();
      allLocalitys= await getLocalitys();
      allCountries = await getCountry();
      allDepartaments = await getDepartaments();
      allProvincies = await getprovinces();
      allMunicipalities= await getmunicipalitys();
      loaded = true;
    }
  });

  async function reload() {
    allPrecincts = await getPrecincts();
  }

  async function save() {
    if (!validateForm() || !browser) return;
    
    try {
      const dataToSave = {
        code: formData.code,
        name: formData.name,
        localityId: formData.localityId,
        location: formData.location
      };

      if (modalType === 'add') {
        await createPrecinct(dataToSave);
      } else if (selected) {
        await updatePrecinct(selected.id || '', dataToSave);
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
    await deletePrecinct(selected.id || '');
    await reload();
    close();
  }

  // FUNCIONES PARA MESAS
  async function openTablesModal(precinct: Precinct) {
    selectedPrecinctForTables = precinct;
    showTablesModal = true;
    loadingTables = true;
    
    try {
      pollingTables = await getPollingTablesByPrecinct(precinct.id || '');
    } catch (error) {
      console.error('Error cargando mesas:', error);
      pollingTables = [];
    } finally {
      loadingTables = false;
    }
    
    newTableNumber = 0;
    newTableType = '';
  }

  async function addTable() {
    if (!selectedPrecinctForTables || newTableNumber <= 0 || !newTableType || newTableInscribed < 0) {
      alert('Complete todos los campos obligatorios');
      return;
    }

    try {
      await createPollingTable({
        number: newTableNumber,
        inscribedCount: newTableInscribed,
        actCode: newTableActCode || undefined,
        precinctId: selectedPrecinctForTables.id || ''
      });
      
      // Recargar mesas
      pollingTables = await getPollingTablesByPrecinct(selectedPrecinctForTables.id || '');
      
      // Resetear formulario
      newTableNumber = 0;
      newTableType = '';
      newTableInscribed = 0;
      newTableActCode = 0;
    } catch (error) {
      console.error('Error al agregar mesa:', error);
      alert('Error al agregar mesa');
    }
  }

  async function autoGenerateTables() {
    if (!selectedPrecinctForTables || autoGenerateCount <= 0 || autoGenerateStartNumber < 1) {
      alert('Complete todos los campos');
      return;
    }

    if (!confirm(`¿Generar ${autoGenerateCount} mesas automáticamente?`)) {
      return;
    }

    try {
      const promises = [];
      
      for (let i = 0; i < autoGenerateCount; i++) {
        const tableNumber = autoGenerateStartNumber + i;
        const actCode = tableNumber;
        
        promises.push(
          createPollingTable({
            number: tableNumber,
            inscribedCount: autoGenerateInscribedPerTable,
            actCode: actCode,
            precinctId: selectedPrecinctForTables.id || ''
          })
        );
      }
      
      await Promise.all(promises);
      
      // Recargar mesas
      pollingTables = await getPollingTablesByPrecinct(selectedPrecinctForTables.id || '');
      
      // Cerrar modal y resetear
      showAutoGenerateModal = false;
      autoGenerateCount = 0;
      autoGenerateStartNumber = 1;
      autoGenerateInscribedPerTable = 0;
      
      alert(`${autoGenerateCount} mesas generadas exitosamente`);
    } catch (error) {
      console.error('Error al generar mesas:', error);
      alert('Error al generar mesas automáticamente');
    }
  }

  async function removeTable(tableId: string) {
    if (!confirm('¿Eliminar esta mesa?')) return;
    
    try {
      //await deletePollingTable(tableId);
      pollingTables = await getPollingTablesByPrecinct(selectedPrecinctForTables?.id || '');
    } catch (error) {
      console.error('Error al eliminar mesa:', error);
      alert('Error al eliminar mesa');
    }
  }

  function closeTablesModal() {
    showTablesModal = false;
    selectedPrecinctForTables = null;
    pollingTables = [];
  }

  $: searchLower = search.toLowerCase();
  $: filtered = allPrecincts
    .filter(o => o.name.toLowerCase().includes(searchLower) || 
                 String(o.code).includes(search) || o.locality.name.toLowerCase().includes(searchLower)) 
    .sort((a, b) => {
      const aVal = a[sortKey] as string | number;
      const bVal = b[sortKey] as string | number;
      return aVal < bVal ? (sortAsc ? -1 : 1) : aVal > bVal ? (sortAsc ? 1 : -1) : 0;
    });

  $: paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(filtered.length / pageSize);

  function sort(key: keyof Precinct) {
    sortAsc = sortKey === key ? !sortAsc : true;
    sortKey = key;
  }

  function open(type: 'add' | 'edit' | 'delete', item?: Precinct) {
    modalType = type;
    if (type === 'add') {
      formData = { code:0, name:'', localityId:'',countryId:'', departamentId:'',provinceId:'', municipalityId:'',location: undefined};
      selected = null;
    } else if (item) {
      formData = {
        code: item.code,
        name: item.name,
        countryId:item.locality?.municipality?.province?.departament?.country?.id || '',
        departamentId: item.locality?.municipality?.province?.departament?.id || '',
        provinceId: item.locality?.municipality?.province?.id || '',
        municipalityId: item.locality?.municipality?.id || '',
        localityId: item.locality?.id || '',
        location: item.location,
      };
      selected = item;
    }
    showModal = true;

    if (type !== 'delete') {
      setTimeout(() => {
        initPointMap();
      }, 500);
    }
  }

  function close() {
    showModal = false;
    selected = null;
    errors = { code:'', name:'', countryId:'', departamentId:'',provinceId:'',localityId:'',municipalityId:'', location:''};
  }

  function initPointMap() {
    if (!browser || !leafletLoaded) return;
    
    if (mapPoint) {
      mapPoint.remove();
      mapPoint = null as any;
      pointMarker = null as any;
    }
    
    mapPoint = L.map("mapPoint").setView([-21.533, -64.731], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapPoint);

    if (formData.location && formData.location.latitude && formData.location.longitude) {
      pointMarker = L.marker([formData.location.latitude, formData.location.longitude]).addTo(mapPoint);
      mapPoint.setView([formData.location.latitude, formData.location.longitude], 12);
    }

    mapPoint.on("click", (e:any) => {
      if (pointMarker) mapPoint.removeLayer(pointMarker);
      pointMarker = L.marker(e.latlng).addTo(mapPoint);

      formData.location = {
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      };
      
      errors.location = '';
    });
  }
</script>

<section class="space-y-6 w-full max-w-full overflow-x-hidden">
  <div class="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">
    <h1 class="text-3xl font-bold dark:text-white">Recintos</h1>
<button
  class="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-2"
  on:click={() => showImportModal = true}
>
  <Upload size="18" />
  Importar Geografía
</button>
    <button
      class="flex gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-md transition"
      on:click={() => open('add')}
    >
      <span class="text-sm font-semibold">Nuevo</span>
    </button>
  </div>

  <input
    type="text"
    placeholder="Buscar recinto..."
    bind:value={search}
    class="w-full px-4 py-2 rounded-xl border shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />

  {#if loaded}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto min-w-[600px]">
        <thead class="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
          <tr class="text-gray-700 dark:text-gray-300 uppercase text-xs">
            {#each [['id','ID'],['code','Código'],['name','Nombre'],['locality','Localidad']] as [key,label]}
              <th
                class="px-3 sm:px-6 py-2 sm:py-3 text-left cursor-pointer select-none"
                on:click={() => sort(key as keyof Precinct)}
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
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.code}</td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.name}</td>
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row?.locality?.name}</td>
              <td class="px-3 sm:px-6 py-2 sm:py-4">
                <div class="flex justify-end gap-2">
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 transition"
                    on:click={() => openTablesModal(row)}
                    title="Ver mesas"
                  >
                    <Table size={16} /><span class="text-xs">Mesas</span>
                  </button>
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

<!-- MODAL MESAS -->
{#if showTablesModal && selectedPrecinctForTables}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-900 border dark:border-gray-700 p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold dark:text-white">
          Mesas de: {selectedPrecinctForTables.name}
        </h2>
        <button
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          on:click={closeTablesModal}
        >
          ✕
        </button>
      </div>

      <!-- Botones de acción -->
      <div class="flex gap-3 mb-4">
        <button
          on:click={() => showAutoGenerateModal = !showAutoGenerateModal}
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
        >
          <span>⚡</span> Generar Automáticamente
        </button>
      </div>

      <!-- Panel de generación automática -->
      {#if showAutoGenerateModal}
        <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg mb-4 border-2 border-purple-200 dark:border-purple-800">
          <h3 class="font-semibold dark:text-white mb-3 flex items-center gap-2">
            <span>⚡</span> Generación Automática de Mesas
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label class="text-sm dark:text-gray-300 block mb-1">Cantidad de Mesas</label>
              <input
                type="number"
                min="1"
                placeholder="Ej: 10"
                bind:value={autoGenerateCount}
                class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label class="text-sm dark:text-gray-300 block mb-1">Número Inicial</label>
              <input
                type="number"
                min="1"
                placeholder="Ej: 1"
                bind:value={autoGenerateStartNumber}
                class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label class="text-sm dark:text-gray-300 block mb-1">Inscritos por Mesa</label>
              <input
                type="number"
                min="0"
                placeholder="Ej: 200"
                bind:value={autoGenerateInscribedPerTable}
                class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div class="flex gap-2">
            <button
              on:click={autoGenerateTables}
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Generar {autoGenerateCount || 0} Mesas
            </button>
            <button
              on:click={() => showAutoGenerateModal = false}
              class="px-4 py-2 bg-gray-300 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-400 transition"
            >
              Cancelar
            </button>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
            💡 Los códigos de acta se generarán automáticamente: ACT-{selectedPrecinctForTables.code}-001, ACT-{selectedPrecinctForTables.code}-002, etc.
          </p>
        </div>
      {/if}

      <!-- Agregar nueva mesa individual -->
      <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
        <h3 class="font-semibold dark:text-white mb-3">Agregar Mesa Individual</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label class="text-xs dark:text-gray-300 block mb-1">Número *</label>
            <input
              type="number"
              placeholder="Número"
              bind:value={newTableNumber}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs dark:text-gray-300 block mb-1">Inscritos *</label>
            <input
              type="number"
              placeholder="Cantidad"
              bind:value={newTableInscribed}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs dark:text-gray-300 block mb-1">Código Acta</label>
            <input
              type="text"
              placeholder="Opcional"
              bind:value={newTableActCode}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
          <div class="flex items-end">
            <button
              on:click={addTable}
              class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              + Agregar
            </button>
          </div>
        </div>
      </div>

      <!-- Lista de mesas -->
      {#if loadingTables}
        <div class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          <p class="text-gray-600 dark:text-gray-400 mt-2">Cargando mesas...</p>
        </div>
      {:else if pollingTables.length === 0}
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <Table size={48} class="mx-auto mb-2 opacity-50" />
          <p>No hay mesas registradas para este recinto</p>
          <p class="text-sm mt-2">Usa la generación automática o agrega mesas manualmente</p>
        </div>
      {:else}
        <div class="space-y-2">
          <h3 class="font-semibold dark:text-white mb-2 flex justify-between items-center">
            <span>Mesas Registradas ({pollingTables.length})</span>
            <span class="text-sm font-normal text-gray-600 dark:text-gray-400">
              Total Inscritos: {pollingTables.reduce((sum, t) => sum + (t.inscribedCount || 0), 0)}
            </span>
          </h3>
          
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th class="px-3 py-2 text-left">Mesa</th>
                  <th class="px-3 py-2 text-left">Inscritos</th>
                  <th class="px-3 py-2 text-left">Código Acta</th>
                  <th class="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {#each pollingTables as table}
                  <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td class="px-3 py-2">
                      <span class="font-semibold dark:text-white">#{table.number}</span>
                    </td>
                    <td class="px-3 py-2 dark:text-gray-300">
                      {table.inscribedCount || 0}
                    </td>
                    <td class="px-3 py-2 text-xs dark:text-gray-400 font-mono">
                      {table.actCode || '-'}
                    </td>
                    <td class="px-3 py-2 text-right">
                      <button
                        on:click={() => removeTable(table.id || '')}
                        class="text-red-600 hover:text-red-700 dark:text-red-400 transition"
                        title="Eliminar mesa"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <div class="mt-6 flex justify-end">
        <button
          on:click={closeTablesModal}
          class="px-4 py-2 bg-gray-300 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-400 transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL RECINTO (add/edit/delete) - mantener tu código existente -->
{#if showModal}
  <!-- Tu modal existente aquí -->
     <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-900 border dark:border-gray-700 p-6 rounded-xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
      {#if modalType === 'delete' && selected}
        <h2 class="text-xl font-bold mb-4 dark:text-white">Eliminar Recintos</h2>
        <p class="mb-4 dark:text-gray-300">
          ¿Estás seguro de eliminar <strong>{selected.name}</strong>?
        </p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 dark:text-white" on:click={close}>Cancelar</button>
          <button class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white" on:click={deleteItem}>Eliminar</button>
        </div>
      {:else}
        <h2 class="text-xl font-bold mb-4 dark:text-white">{modalType === 'add' ? 'Agregar' : 'Editar'} Localidad</h2>

        <div class="space-y-4">
          <!-- COUNTRY SELECT (solo para filtrar) -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">País</label>
            <select bind:value={formData.countryId} class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="" disabled>Seleccione un país primero</option>
              {#each allCountries as c}
                <option value={c.id}>{c.name}</option>
              {/each}
            </select>
            {#if errors.countryId}<p class="text-red-500 text-xs mt-1">{errors.countryId}</p>{/if}
          </div>

          <!-- DEPARTAMENT SELECT (filtrado por país) -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Departamento</label>
            <select 
              bind:value={formData.departamentId} 
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              disabled={!formData.countryId}
            >
              <option value="" disabled>
                {formData.countryId ? 'Seleccione un departamento' : 'Primero seleccione un país'}
              </option>
              {#each filteredDepartaments as d}
                <option value={d.id}>{d.name}</option>
              {/each}
            </select>
            {#if filteredDepartaments.length === 0 && formData.countryId}
              <p class="text-yellow-600 text-xs mt-1">⚠️ No hay departamentos para este país</p>
            {/if}
            {#if errors.departamentId}<p class="text-red-500 text-xs mt-1">{errors.departamentId}</p>{/if}
          </div>

          <!-- PROVINCIA SELECT (filtrado por departamento) -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Provincia</label>
            <select 
              bind:value={formData.provinceId} 
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              disabled={!formData.departamentId}
            >
              <option value="" disabled>
                {formData.departamentId ? 'Seleccione una provincia' : 'Primero seleccione un departamento'}
              </option>
              {#each filteredProvincies as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
            {#if filteredProvincies.length === 0 && formData.departamentId}
              <p class="text-yellow-600 text-xs mt-1">⚠️ No hay provincias para este departamento</p>
            {/if}
            {#if errors.provinceId}<p class="text-red-500 text-xs mt-1">{errors.provinceId}</p>{/if}
          </div>

                 <!-- MUNICIPIO SELECT (filtrado por provincia) -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Municipio</label>
            <select 
              bind:value={formData.municipalityId} 
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              disabled={!formData.provinceId}
            >
              <option value="" disabled>
                {formData.provinceId ? 'Seleccione un municipio' : 'Primero seleccione una provincia'}
              </option>
              {#each filteredMunicipalities as m}
                <option value={m.id}>{m.name}</option>
              {/each}
            </select>
            {#if filteredMunicipalities.length === 0 && formData.provinceId}
              <p class="text-yellow-600 text-xs mt-1">⚠️ No hay municipios para esta provincia</p>
            {/if}
            {#if errors.municipalityId}<p class="text-red-500 text-xs mt-1">{errors.municipalityId}</p>{/if}
          </div>

                           <!-- Localidad SELECT (filtrado por provincia) -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Localidad</label>
            <select 
              bind:value={formData.localityId} 
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              disabled={!formData.municipalityId}
            >
              <option value="" disabled>
                {formData.municipalityId ? 'Seleccione una localidad' : 'Primero seleccione un municipio'}
              </option>
              {#each filteredLocalitys as l}
                <option value={l.id}>{l.name}</option>
              {/each}
            </select>
            {#if filteredLocalitys.length === 0 && formData.municipalityId}
              <p class="text-yellow-600 text-xs mt-1">⚠️ No hay localidades para este municipio</p>
            {/if}
            {#if errors.localityId}<p class="text-red-500 text-xs mt-1">{errors.localityId}</p>{/if}
          </div>
          <!-- NAME -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Tolomosita"
              bind:value={formData.name}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.name}<p class="text-red-500 text-xs mt-1">{errors.name}</p>{/if}
          </div>

          <!-- CODE -->
          <div>
            <label class="font-semibold dark:text-white text-sm mb-1 block">Código</label>
            <input
              type="number"
              placeholder="Ej: 1"
              bind:value={formData.code}
              class="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {#if errors.code}<p class="text-red-500 text-xs mt-1">{errors.code}</p>{/if}
          </div>

          <!-- MAP POINT -->
          <div>
            <label class="font-semibold dark:text-white text-sm">Ubicación (GeoPoint)</label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Haz clic en el mapa para seleccionar un punto</p>
            <div id="mapPoint" class="w-full h-52 rounded-lg border dark:border-gray-700"></div>
            {#if errors.location}<p class="text-red-500 text-xs mt-1">{errors.location}</p>{/if}
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

{#if showImportModal}
     <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-900 border dark:border-gray-700 p-6 rounded-xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
      <h2>Importar Geografía desde Excel</h2>

      <input 
        type="file" 
        accept=".xlsx,.xls"
        on:change={(e: any) => importFile = e.target.files?.[0] ?? null}
      />

      <div class="flex gap-3 mt-4">
        <button
          class="bg-green-600 text-white px-3 py-1 rounded"
          disabled={importing}
          on:click={handleImport}
        >
          {importing ? 'Importando...' : 'Importar'}
        </button>

        <button
          class="bg-gray-400 text-black px-3 py-1 rounded"
          on:click={() => showImportModal = false}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
{/if}
