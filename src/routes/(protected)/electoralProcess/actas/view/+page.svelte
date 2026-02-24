<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Eye, FileText, ChevronDown, ChevronUp } from 'lucide-svelte';

  import type { ElectoralProcess } from '$lib/types/types';

  import { getElectoralProcessActive } from '$lib/services/electoralProcessService';
  import { getActasByProcess } from '$lib/services/actaService';
  import { getActaStructure } from '$lib/services/actaGenerationService';

  let loaded = false;
  let selectedProcess: ElectoralProcess | null = null;
  let allProcesses: ElectoralProcess[] = [];
  let actas: any[] = [];
  let expandedActa: string | null = null;
  let actaStructures: Map<string, any> = new Map();
  
  let searchTerm = '';
  let statusFilter: 'ALL' | 'BORRADOR' | 'CON_FOTO' | 'CERRADA' | 'VALIDADA' = 'ALL';
  let provinceFilter = '';
  let precinctFilter = '';

  onMount(async () => {
    if (!browser) return;

    try {
      allProcesses = await getElectoralProcessActive();
      loaded = true;
    } catch (error) {
      console.error('Error:', error);
    }
  });

  async function onProcessSelected() {
    if (!selectedProcess) return;
    
    try {
      actas = await getActasByProcess(selectedProcess.id!);
      console.log(`📋 Cargadas ${actas.length} actas`);
      
      // Debug: Verificar si todas apuntan a la misma mesa
      const uniqueTables = new Set(actas.map(a => a.pollingTable.id));
      console.log(`📊 Mesas únicas: ${uniqueTables.size} de ${actas.length} actas`);
      
      if (uniqueTables.size < actas.length) {
        console.warn(`⚠️ PROBLEMA: ${actas.length - uniqueTables.size} actas duplican mesas`);
        
        // Mostrar detalles
        actas.slice(0, 5).forEach((a, i) => {
          console.log(`Acta ${i + 1}:`, {
            actaCode: a.code,
            mesaNumber: a.pollingTable.number,
            mesaId: a.pollingTable.id,
            actCode: a.pollingTable.actCode
          });
        });
      }

      // Debug: Verificar información geográfica
      const actasWithProvince = actas.filter(a => a.pollingTable.precinct?.locality?.municipality?.province);
      console.log(`🌍 Actas con provincia: ${actasWithProvince.length} de ${actas.length}`);
      
      if (actasWithProvince.length > 0) {
        const provinces = new Set(actasWithProvince.map(a => 
          a.pollingTable.precinct?.locality?.municipality?.province?.name
        ));
        console.log(`📍 Provincias encontradas:`, Array.from(provinces));
      } else {
        console.warn(`⚠️ PROBLEMA: Ninguna acta tiene información de provincia`);
        console.log(`Ejemplo de acta:`, actas[0]);
      }

    } catch (error: any) {
      if (error.message?.includes('non-existent class')) {
        alert('No hay actas generadas aún. Primero genera las actas.');
        actas = [];
      } else {
        console.error('Error:', error);
        alert('Error al cargar actas');
      }
    }
  }

  async function toggleActa(actaId: string, tableId: string) {
    if (expandedActa === actaId) {
      expandedActa = null;
      return;
    }

    expandedActa = actaId;

    // Si ya tenemos la estructura cargada, no la volvemos a pedir
    if (actaStructures.has(actaId)) return;

    try {
      const structure = await getActaStructure(
        selectedProcess!.id!,
        tableId
      );
      actaStructures.set(actaId, structure);
      actaStructures = actaStructures; // Trigger reactivity
    } catch (error) {
      console.error('Error cargando estructura:', error);
    }
  }

  function getStatusBadge(status: string): string {
    const badges: Record<string, string> = {
      'BORRADOR': 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      'CON_FOTO': 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'CERRADA': 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'VALIDADA': 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    
    return badges[status] || badges['BORRADOR'];
  }

  $: filteredActas = actas
    .filter(acta => {
      const matchesSearch = 
        acta.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acta.pollingTable.number.toString().includes(searchTerm);
      
      const matchesStatus = statusFilter === 'ALL' || acta.status === statusFilter;
      
      // Filtro por provincia (usando la info geográfica de la mesa)
      const province = acta.pollingTable.precinct?.locality?.municipality?.province;
      const matchesProvince = !provinceFilter || province?.id === provinceFilter;
      
      // Filtro por recinto
      const matchesPrecinct = !precinctFilter || acta.pollingTable.precinct?.id === precinctFilter;
      
      return matchesSearch && matchesStatus && matchesProvince && matchesPrecinct;
    })
    .sort((a, b) => {
      // Primero ordenar por nombre de recinto
      const precinctA = a.pollingTable.precinct?.name || '';
      const precinctB = b.pollingTable.precinct?.name || '';
      const precinctCompare = precinctA.localeCompare(precinctB);
      
      if (precinctCompare !== 0) {
        return precinctCompare;
      }
      
      // Si están en el mismo recinto, ordenar por número de mesa
      return a.pollingTable.number - b.pollingTable.number;
    });

  // Obtener listas únicas para los selectores
  $: availableProvinces = Array.from(
    new Map(
      actas
        .map(a => a.pollingTable.precinct?.locality?.municipality?.province)
        .filter(p => p?.id)
        .map(p => [p!.id, p])
    ).values()
  ).sort((a, b) => (a!.name || '').localeCompare(b!.name || ''));

  $: availablePrecincts = Array.from(
    new Map(
      actas
        .map(a => a.pollingTable.precinct)
        .filter(p => {
          if (!p?.id) return false;
          // Si hay filtro de provincia, solo mostrar recintos de esa provincia
          if (provinceFilter) {
            return p.locality?.municipality?.province?.id === provinceFilter;
          }
          return true;
        })
        .map(p => [p!.id, p])
    ).values()
  ).sort((a, b) => (a!.name || '').localeCompare(b!.name || ''));

  $: stats = {
    total: actas.length,
    borrador: actas.filter(a => a.status === 'BORRADOR').length,
    conFoto: actas.filter(a => a.status === 'CON_FOTO').length,
    cerradas: actas.filter(a => a.status === 'CERRADA').length,
    validadas: actas.filter(a => a.status === 'VALIDADA').length
  };
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Visualizar Actas Generadas
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Revisa las actas generadas y su estructura de franjas
      </p>
    </div>

    {#if loaded}
      <!-- Selector de Proceso -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <label class="block text-sm font-medium mb-2 dark:text-white">
          Proceso Electoral
        </label>
        <select
          bind:value={selectedProcess}
          on:change={onProcessSelected}
          class="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value={null}>Seleccione un proceso</option>
          {#each allProcesses as process}
            <option value={process}>{process.name} - {process.year}</option>
          {/each}
        </select>
      </div>

      {#if selectedProcess && actas.length > 0}
        <!-- Estadísticas -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">Total</div>
          </div>
          
          <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.borrador}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">Borrador</div>
          </div>
          
          <div class="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.conFoto}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">Con Foto</div>
          </div>
          
          <div class="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-orange-800 dark:text-orange-200">{stats.cerradas}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">Cerradas</div>
          </div>
          
          <div class="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-green-800 dark:text-green-200">{stats.validadas}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">Validadas</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Búsqueda -->
            <input
              type="text"
              placeholder="Buscar por código o número..."
              bind:value={searchTerm}
              class="px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            
            <!-- Estado -->
            <select
              bind:value={statusFilter}
              class="px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="ALL">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="CON_FOTO">Con foto</option>
              <option value="CERRADA">Cerradas</option>
              <option value="VALIDADA">Validadas</option>
            </select>

            <!-- Provincia -->
            <select
              bind:value={provinceFilter}
              on:change={() => precinctFilter = ''}
              class="px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Todas las provincias</option>
              {#each availableProvinces as province}
                <option value={province.id}>{province.name}</option>
              {/each}
            </select>

            <!-- Recinto -->
            <select
              bind:value={precinctFilter}
              class="px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Todos los recintos</option>
              {#each availablePrecincts as precinct}
                <option value={precinct.id}>
                  {precinct.name || `Recinto ${precinct.code}`}
                </option>
              {/each}
            </select>
          </div>

          <!-- Contador de resultados -->
          <div class="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Mostrando {filteredActas.length} de {actas.length} actas
            {#if provinceFilter || precinctFilter || searchTerm || statusFilter !== 'ALL'}
              <button
                class="ml-2 text-orange-600 hover:underline"
                on:click={() => {
                  searchTerm = '';
                  statusFilter = 'ALL';
                  provinceFilter = '';
                  precinctFilter = '';
                }}
              >
                Limpiar filtros
              </button>
            {/if}
          </div>
        </div>

        <!-- Lista de Actas -->
        <div class="space-y-3">
          {#each filteredActas as acta, index (acta.id)}
            {@const isExpanded = expandedActa === acta.id}
            {@const structure = actaStructures.get(acta.id!)}
            {@const prevActa = index > 0 ? filteredActas[index - 1] : null}
            {@const currentPrecinct = acta.pollingTable.precinct?.name}
            {@const prevPrecinct = prevActa?.pollingTable.precinct?.name}
            {@const isNewPrecinct = currentPrecinct && currentPrecinct !== prevPrecinct}
            
            <!-- Separador de Recinto -->
            {#if isNewPrecinct}
              <div class="pt-6 pb-2">
                <div class="flex items-center gap-3">
                  <div class="h-px bg-gradient-to-r from-orange-500 to-transparent flex-1"></div>
                  <div class="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                    📍 {currentPrecinct}
                  </div>
                  <div class="h-px bg-gradient-to-l from-orange-500 to-transparent flex-1"></div>
                </div>
              </div>
            {/if}
            
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <!-- Header del Acta -->
              <button
                class="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                on:click={() => toggleActa(acta.id!, acta.pollingTable.id!)}
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                    <FileText size={24} class="text-orange-600 dark:text-orange-400" />
                  </div>
                  
                  <div class="text-left">
                    <div class="font-bold dark:text-white">
                      Mesa #{acta.pollingTable.number}
                      {#if acta.pollingTable.precinct}
                        <span class="text-sm font-normal text-gray-600 dark:text-gray-400">
                          - {acta.pollingTable.precinct.name}
                        </span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2 text-xs">
                      {#if acta.pollingTable.actCode}
                        <code class="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          Código Mesa: {acta.pollingTable.actCode}
                        </code>
                      {/if}
                      <code class="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        Acta: {acta.code}
                      </code>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span class="px-3 py-1 rounded-full text-xs font-medium {getStatusBadge(acta.status)}">
                    {acta.status}
                  </span>
                  
                  {#if isExpanded}
                    <ChevronUp size={20} class="text-gray-600 dark:text-gray-400" />
                  {:else}
                    <ChevronDown size={20} class="text-gray-600 dark:text-gray-400" />
                  {/if}
                </div>
              </button>

              <!-- Estructura del Acta (Expandible) -->
              {#if isExpanded}
                <div class="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                  {#if structure}
                    <div class="mb-3">
                      <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Inscritos: <strong>{structure.table.inscribedCount || 0}</strong>
                      </div>
                    </div>

                    <h4 class="font-semibold mb-3 dark:text-white flex items-center gap-2">
                      <FileText size={16} />
                      Franjas del Acta ({structure.franjas.length})
                    </h4>

                    <div class="space-y-4">
                      {#each structure.franjas as franja, index}
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
                          <div class="flex items-center justify-between mb-3">
                            <div>
                              <div class="font-bold text-lg dark:text-white">
                                Franja {index + 1}: {franja.position.name}
                              </div>
                              <div class="text-xs text-gray-600 dark:text-gray-400">
                                Alcance: {franja.position.scope}
                              </div>
                            </div>
                            <div class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
                              {franja.parties.length} partidos
                            </div>
                          </div>

                          <div class="space-y-2">
                            {#each franja.parties as party}
                              <div class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                     style="background-color: {party.politicalOrganization.color}">
                                  {party.order}
                                </div>
                                <div class="flex-grow">
                                  <div class="font-semibold dark:text-white">
                                    {party.politicalOrganization.sigla}
                                  </div>
                                  <div class="text-xs text-gray-600 dark:text-gray-400">
                                    {party.politicalOrganization.name}
                                  </div>
                                </div>
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                      Cargando estructura...
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        {#if filteredActas.length === 0}
          <div class="text-center py-12 text-gray-500 dark:text-gray-400">
            No se encontraron actas con los filtros aplicados
          </div>
        {/if}
      {:else if selectedProcess}
        <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800 text-center">
          <p class="text-yellow-800 dark:text-yellow-200">
            No hay actas generadas para este proceso.
          </p>
          <a
            href="/electoralProcess/actas/generation"
            class="inline-block mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            Ir a Generar Actas
          </a>
        </div>
      {/if}
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    {/if}
  </div>
</div>