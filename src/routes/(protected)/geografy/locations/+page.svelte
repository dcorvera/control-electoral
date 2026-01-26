<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    getLocalitys,
    createLocality,
    updateLocality,
    deleteLocality
  } from '$lib/services/localityService';
  import { getCountry } from '$lib/services/countryService';
  import type { Municipality,Locality, Country, GeoPointData, PolygonData, Departament, Province } from '$lib/types/types';
  import { Trash2, Pencil } from 'lucide-svelte';
  import { getDepartaments } from '$lib/services/departamentService';
  import { getprovinces } from '$lib/services/provinceService';
	import { getmunicipalitys } from '$lib/services/municipalityService';


  // Leaflet se importará dinámicamente solo en el navegador
  let L: any;
  let leafletLoaded = false;

  let alllocalitys: Locality[] = [];
  let allCountries: Country[] = [];
  let allDepartaments: Departament[] = [];
  let allProvincies: Province[] = [];
   let allMunicipalities: Municipality[] = [];
  let loaded = false;
  let search = '';
  let sortKey: keyof Locality = 'id';
  let sortAsc = true;
  let currentPage = 1;
  const pageSize = 5;

  let showModal = false;
  let modalType: 'add' | 'edit' | 'delete' = 'add';
  let selected: Locality | null = null;

  // Formulario
  let formData = {
    code: 0,
    name: '',
    countryId: '', // Para filtrar departamentos
    departamentId: '', // Para filtrar provincias
    provinceId: '', 
    municipalityId: '', 
    location: undefined as GeoPointData | undefined
  };
  let errors = {
    code: '',
    name: '',
    countryId: '',
    departamentId: '',
    provinceId: '',
    municipalityId: '',
    location: ''
  };

  // Leaflet maps
  let mapPoint: any, pointMarker: any;


  // Departamentos filtrados por país seleccionado
  $: filteredDepartaments = formData.countryId 
    ? allDepartaments.filter(d => d.country?.id === formData.countryId)
    : [];

  // Cuando cambia el país, resetear el departamento seleccionado
  $: if (formData.countryId) {
    // Si el departamento actual no pertenece al país seleccionado, resetear
    const currentDept = allDepartaments.find(d => d.id === formData.departamentId);
    if (currentDept && currentDept.country?.id !== formData.countryId) {
      formData.departamentId = '';
    }
  }


    // Provincias filtrados por país departamento
  $: filteredProvincies= formData.departamentId
    ? allProvincies.filter(d => d.departament?.id === formData.departamentId)
    : [];

  // Cuando cambia el departamento, resetear la provincia seleccionada
  $: if (formData.departamentId) {
    // Si la provincia actual no pertenece al departamento seleccionado, resetear
    const currentProv = allProvincies.find(d => d.id === formData.provinceId);
    if (currentProv && currentProv.departament?.id !== formData.departamentId) {
      formData.provinceId = '';
    }
  }

      // Provincias filtrados por país departamento
  $: filteredMunicipalities= formData.provinceId
    ? allMunicipalities.filter(d => d.province?.id === formData.provinceId)
    : [];

  // Cuando cambia el departamento, resetear la provincia seleccionada
  $: if (formData.provinceId) {
    // Si la provincia actual no pertenece al departamento seleccionado, resetear
    const currentMun = allMunicipalities.find(d => d.id === formData.municipalityId);
    if (currentMun && currentMun.province?.id !== formData.provinceId) {
      formData.municipalityId = '';
    }
  }

  // VALIDACIÓN
  function validateForm() {
    errors = { code:'', name:'', countryId:'', departamentId:'',provinceId:'',municipalityId:'', location:'' };

    if (formData.code <=0) errors.code = 'El código es obligatorio';
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!formData.countryId) errors.countryId = 'Debe seleccionar un país';
    if (!formData.departamentId) errors.departamentId = 'Debe seleccionar un departamento';
    if (!formData.provinceId) errors.provinceId = 'Debe seleccionar una provincia';
    if (!formData.municipalityId) errors.municipalityId = 'Debe seleccionar un municipio';
    if (!formData.location) errors.location = 'Debe seleccionar una ubicación en el mapa';

    return !errors.code && !errors.name && !errors.countryId && !errors.departamentId && !errors.location 
  }

  // CARGA INICIAL
  onMount(async () => {
    if (browser) {
      // Cargar Leaflet dinámicamente solo en el navegador
      try {
        L = (await import('leaflet')).default;
        const link1 = document.createElement('link');
        link1.rel = 'stylesheet';
        link1.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link1);
        
        const link2 = document.createElement('link');
        link2.rel = 'stylesheet';
        link2.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
        document.head.appendChild(link2);
        
        //await import('leaflet-draw');
        leafletLoaded = true;
      } catch (error) {
        console.error('Error cargando Leaflet:', error);
      }

      alllocalitys = await getLocalitys();
      allCountries = await getCountry();
      allDepartaments = await getDepartaments();
      allProvincies = await getprovinces();
      allMunicipalities = await getmunicipalitys();
      loaded = true;
    }
  });

  async function reload() {
    alllocalitys = await getLocalitys();
  }

  async function save() {
    if (!validateForm() || !browser) return;
    
    try {
      // No enviamos countryId, solo departamentId
      const dataToSave = {
        code: formData.code,
        name: formData.name,
        municipalityId: formData.provinceId,
        location: formData.location
      };

      if (modalType === 'add') {
        await createLocality(dataToSave);
      } else if (selected) {
        await updateLocality(selected.id || '', dataToSave);
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
    await deleteLocality(selected.id || '');
    await reload();
    close();
  }

  $: searchLower = search.toLowerCase();
  $: filtered = alllocalitys
    .filter(o => o.name.toLowerCase().includes(searchLower) || 
                 String(o.code).includes(search) || o.municipality.name.toLowerCase().includes(searchLower) )
    .sort((a, b) => {
      const aVal = a[sortKey] as string | number;
      const bVal = b[sortKey] as string | number;
      return aVal < bVal ? (sortAsc ? -1 : 1) : aVal > bVal ? (sortAsc ? 1 : -1) : 0;
    });

  $: paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(filtered.length / pageSize);

  function sort(key: keyof Locality) {
    sortAsc = sortKey === key ? !sortAsc : true;
    sortKey = key;
  }

  function open(type: 'add' | 'edit' | 'delete', item?: Locality) {
    console.log(item);
    modalType = type;
    if (type === 'add') {
      formData = { code:0, name:'', countryId:'', departamentId:'',provinceId:'',municipalityId:'', location: undefined};
      selected = null;
    } else if (item) {
      // Al editar, cargar el país del departamento
      const mun = allMunicipalities.find(m => m.id === item.municipality?.id);
      console.log(mun);
      formData = {
        code: item.code,
        name: item.name,
        countryId:mun?.province?.departament?.country?.id || '',
        departamentId: mun?.province?.departament?.id || '',
        provinceId: mun?.province?.id || '',
        municipalityId: item.municipality.id || '',
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
    errors = { code:'', name:'', countryId:'', departamentId:'',provinceId:'',municipalityId:'', location:''};
  }

  // --- Leaflet POINT MAP ---
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
  <!-- HEADER -->
  <div class="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">
    <h1 class="text-3xl font-bold dark:text-white">Localidades</h1>
    <button
      class="flex gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-md transition"
      on:click={() => open('add')}
    >
      <span class="text-sm font-semibold">Nuevo</span>
    </button>
  </div>

  <input
    type="text"
    placeholder="Buscar localidad..."
    bind:value={search}
    class="w-full px-4 py-2 rounded-xl border shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />
  

  {#if loaded}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto min-w-[600px]">
        <thead class="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
          <tr class="text-gray-700 dark:text-gray-300 uppercase text-xs">
            {#each [['id','ID'],['code','Código'],['name','Nombre'],['municipality','Municipio']] as [key,label]}
              <th
                class="px-3 sm:px-6 py-2 sm:py-3 text-left cursor-pointer select-none"
                on:click={() => sort(key as keyof Locality)}
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
              <td class="px-3 sm:px-6 py-2 sm:py-4 dark:text-gray-200">{row.municipality.name}</td>
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
        <h2 class="text-xl font-bold mb-4 dark:text-white">Eliminar Localidad</h2>
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

