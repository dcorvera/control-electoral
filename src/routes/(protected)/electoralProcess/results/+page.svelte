<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { BarChart3, PieChart, Eye, Search, Download, Filter, RefreshCw } from 'lucide-svelte';
  
  import type { Acta } from '$lib/types/types';
  import { getCurrentUser, hasAnyRole } from '$lib/services/authService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  
  // Filtros
  let selectedPosition = '';
  let selectedProvince = '';
  let searchTerm = '';
  
  // Datos
  let positions: any[] = [];
  let provinces: any[] = [];
  let actasValidadas: Acta[] = [];
  let loading = false;
  
  // Resultados
  let resultadosPorPosicion: Record<string, any> = {};
  let totalActasValidadas = 0;
  let totalVotosEmitidos = 0;
  let totalActasComputadas = 0;
  let totalActasAnuladas = 0;
  let totalActasHabilitadas = 0;
  let totalCiudadanosHabilitados = 0;
  let ciudadanosPorActasComputadas = 0;
  
  // Vista
  let currentView: 'graficas' | 'actas' = 'graficas';
  let selectedActa: Acta | null = null;
  let showActaModal = false;

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      const hasAccess = await hasAnyRole(['superadmin', 'admin', 'validacion', 'viewer']);
      
      if (!hasAccess) {
        alert('No tienes permisos para acceder a esta sección');
        goto('/dashboard');
        return;
      }
      
      loaded = true;
      
      await loadPositions();
      await loadProvinces();
      await loadResults();
      
    } catch (error) {
      console.error('Error:', error);
      goto('/login');
    }
  });

  async function loadPositions() {
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
      const query = new Parse.Query(ElectoralPosition);
      query.ascending('order');
      
      const results = await query.find();
      positions = results.map(r => ({
        id: r.id,
        name: r.get('name'),
        order: r.get('order')
      }));
      
      if (positions.length > 0) {
        selectedPosition = positions[0].id;
      }
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function loadProvinces() {
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const Province = Parse.Object.extend('Province');
      const query = new Parse.Query(Province);
      query.ascending('name');
      
      const results = await query.find();
      provinces = results.map(r => ({
        id: r.id,
        name: r.get('name')
      }));
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function loadResults() {
    if (!selectedPosition) return;
    
    loading = true;
    resultadosPorPosicion = {};
    actasValidadas = [];
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      // Cargar actas validadas
      const ActaClass = Parse.Object.extend('Acta');
      const actaQuery = new Parse.Query(ActaClass);
      actaQuery.equalTo('status', 'VALIDADA');
      actaQuery.include([
        'pollingTable',
        'pollingTable.precinct',
        'pollingTable.precinct.locality',
        'pollingTable.precinct.locality.municipality',
        'pollingTable.precinct.locality.municipality.province'
      ]);
      
      // Filtro por provincia
      if (selectedProvince) {
        const Province = Parse.Object.extend('Province');
        const provincePointer = Province.createWithoutData(selectedProvince);
        
        actaQuery.matchesQuery('pollingTable', 
          new Parse.Query('PollingTable').matchesQuery('precinct',
            new Parse.Query('Precinct').matchesQuery('locality',
              new Parse.Query('Locality').matchesQuery('municipality',
                new Parse.Query('Municipality').equalTo('province', provincePointer)
              )
            )
          )
        );
      }
      
      actaQuery.limit(1000);
      const actasResults = await actaQuery.find();
      
      totalActasValidadas = actasResults.length;
      totalActasComputadas = actasResults.length;
      totalActasAnuladas = 0; // TODO: Contar actas anuladas si existe ese status
      
      // Calcular total de actas habilitadas y ciudadanos
      const PollingTable = Parse.Object.extend('PollingTable');
      const pollingTableQuery = new Parse.Query(PollingTable);
      
      if (selectedProvince) {
        const Province = Parse.Object.extend('Province');
        const provincePointer = Province.createWithoutData(selectedProvince);
        
        pollingTableQuery.matchesQuery('precinct',
          new Parse.Query('Precinct').matchesQuery('locality',
            new Parse.Query('Locality').matchesQuery('municipality',
              new Parse.Query('Municipality').equalTo('province', provincePointer)
            )
          )
        );
      }
      
      pollingTableQuery.limit(10000);
      const allTables = await pollingTableQuery.find();
      
      totalActasHabilitadas = allTables.length;
      totalCiudadanosHabilitados = allTables.reduce((sum, table) => {
        return sum + (table.get('inscribedCount') || 0);
      }, 0);
      
      // Ciudadanos en actas computadas
      ciudadanosPorActasComputadas = actasResults.reduce((sum, acta) => {
        return sum + (acta.get('pollingTable')?.get('inscribedCount') || 0);
      }, 0);
      
      // Calcular votos especiales ANTES de parsear actas
      let totalBlancos = 0;
      let totalNulos = 0;
      
      console.log('=== DEBUG: Calculando votos especiales ===');
      console.log('Posición seleccionada:', selectedPosition);
      console.log('Nombre de posición:', positions.find(p => p.id === selectedPosition)?.name);
      console.log('Total actas a procesar:', actasResults.length);
      
      actasResults.forEach((result, index) => {
        const specialVotes = result.get('specialVotes') || {};
        const todasLasPosiciones = Object.keys(specialVotes);
        
        console.log(`\nActa ${index + 1}:`);
        console.log('  specialVotes tiene estas posiciones:', todasLasPosiciones);
        console.log('  Posiciones en detalle:', todasLasPosiciones.map(id => ({ id, votos: specialVotes[id] })));
        console.log('  Buscamos posición:', selectedPosition);
        console.log('  ¿Coincide?', todasLasPosiciones.includes(selectedPosition));
        
        const especiales = specialVotes[selectedPosition];
        
        if (especiales) {
          const blancos = especiales.blancos || 0;
          const nulos = especiales.nulos || 0;
          console.log('  ✅ ENCONTRADO - blancos:', blancos, 'nulos:', nulos);
          totalBlancos += blancos;
          totalNulos += nulos;
        } else {
          console.log('  ❌ NO ENCONTRADO para posición:', selectedPosition);
          console.log('  Datos completos de specialVotes:', JSON.stringify(specialVotes, null, 2));
        }
      });
      
      console.log('=== TOTALES FINALES ===');
      console.log('Total Blancos:', totalBlancos);
      console.log('Total Nulos:', totalNulos);
      console.log('========================');
      
      // Parsear actas
      actasValidadas = actasResults.map(result => {
        const pollingTableObj = result.get('pollingTable');
        const precinctObj = pollingTableObj?.get('precinct');
        const localityObj = precinctObj?.get('locality');
        const municipalityObj = localityObj?.get('municipality');
        const provinceObj = municipalityObj?.get('province');
        
        return {
          id: result.id,
          code: result.get('code'),
          status: result.get('status'),
          imageUrl: result.get('imageUrl'),
          specialVotes: result.get('specialVotes') || {},
          notes: result.get('notes') || '',
          pollingTable: {
            id: pollingTableObj?.id,
            number: pollingTableObj?.get('number'),
            inscribedCount: pollingTableObj?.get('inscribedCount'),
            actCode: pollingTableObj?.get('actCode'),
            precinct: precinctObj ? {
              id: precinctObj.id,
              name: precinctObj.get('name'),
              locality: localityObj ? {
                id: localityObj.id,
                municipality: municipalityObj ? {
                  id: municipalityObj.id,
                  province: provinceObj ? {
                    id: provinceObj.id,
                    name: provinceObj.get('name')
                  } : undefined
                } : undefined
              } : undefined
            } : undefined
          }
        } as Acta;
      });
      
      // Cargar detalles de votos para la posición seleccionada
      const ActaDetail = Parse.Object.extend('ActaDetail');
      const detailQuery = new Parse.Query(ActaDetail);
      
      const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
      const positionPointer = ElectoralPosition.createWithoutData(selectedPosition);
      detailQuery.equalTo('electoralPosition', positionPointer);
      
      // Solo actas validadas
      detailQuery.containedIn('acta', actasResults.map(a => {
        const Acta = Parse.Object.extend('Acta');
        return Acta.createWithoutData(a.id);
      }));
      
      detailQuery.include(['politicalOrganization', 'acta']);
      detailQuery.limit(10000);
      
      const details = await detailQuery.find();
      
      // Agrupar por partido
      const votosPorPartido: Record<string, any> = {};
      
      details.forEach(detail => {
        const orgId = detail.get('politicalOrganization')?.id;
        const orgName = detail.get('politicalOrganization')?.get('sigla') || 'N/A';
        const orgFullName = detail.get('politicalOrganization')?.get('name') || '';
        const orgColor = detail.get('politicalOrganization')?.get('color') || '#ccc';
        const votes = detail.get('votes') || 0;
        
        if (!orgId) return;
        
        if (!votosPorPartido[orgId]) {
          votosPorPartido[orgId] = {
            name: orgName,
            fullName: orgFullName,
            color: orgColor,
            votes: 0
          };
        }
        
        votosPorPartido[orgId].votes += votes;
      });
      
      // Calcular totales
      const totalValidos = Object.values(votosPorPartido).reduce((sum: number, p: any) => sum + p.votes, 0);
      totalVotosEmitidos = totalValidos + totalBlancos + totalNulos;
      
      console.log('Totales calculados:', { 
        totalValidos, 
        totalBlancos, 
        totalNulos, 
        totalVotosEmitidos,
        selectedPosition 
      });
      
      // Ordenar por votos
      const partiesArray = Object.values(votosPorPartido).sort((a: any, b: any) => b.votes - a.votes);
      
      resultadosPorPosicion[selectedPosition] = {
        parties: partiesArray,
        totalValidos,
        totalBlancos: totalBlancos,  // Asegurar que se guarde
        totalNulos: totalNulos,      // Asegurar que se guarde
        totalGeneral: totalVotosEmitidos
      };
      
      console.log('=== OBJETO FINAL DE RESULTADOS ===');
      console.log('resultadosPorPosicion:', resultadosPorPosicion);
      console.log('results para posición actual:', resultadosPorPosicion[selectedPosition]);
      console.log('===================================');
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar resultados');
    } finally {
      loading = false;
    }
  }

  function viewActa(acta: Acta) {
    selectedActa = acta;
    showActaModal = true;
  }

  function getPercentage(votes: number, total: number): string {
    if (total === 0) return '0.00';
    return ((votes / total) * 100).toFixed(2);
  }

  function exportResults() {
    if (!resultadosPorPosicion[selectedPosition]) return;
    
    const results = resultadosPorPosicion[selectedPosition];
    const positionName = positions.find(p => p.id === selectedPosition)?.name || 'Posición';
    
    let csv = 'Partido,Votos,Porcentaje\n';
    
    results.parties.forEach((party: any) => {
      csv += `${party.name},${party.votes},${getPercentage(party.votes, results.totalValidos)}%\n`;
    });
    
    csv += `\nVotos en Blanco,${results.totalBlancos},${getPercentage(results.totalBlancos, results.totalGeneral)}%\n`;
    csv += `Votos Nulos,${results.totalNulos},${getPercentage(results.totalNulos, results.totalGeneral)}%\n`;
    csv += `\nTotal Válidos,${results.totalValidos}\n`;
    csv += `Total General,${results.totalGeneral}\n`;
    csv += `Actas Validadas,${totalActasValidadas}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados-${positionName.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
  }

  $: filteredActas = actasValidadas.filter(acta => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      acta.pollingTable.number?.toString().includes(term) ||
      acta.pollingTable.actCode?.toString().includes(term) ||
      acta.pollingTable.precinct?.name?.toLowerCase().includes(term)
    );
  });
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        📊 Resultados Electorales
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Visualización de resultados y actas validadas
      </p>
    </div>

    {#if loaded}
      <!-- Filtros -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div class="flex items-center gap-2 mb-4">
          <Filter size={20} class="text-gray-600 dark:text-gray-400" />
          <h2 class="text-lg font-bold dark:text-white">Filtros</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2 dark:text-white">Posición Electoral</label>
            <select 
              bind:value={selectedPosition}
              on:change={loadResults}
              class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {#each positions as position}
                <option value={position.id}>{position.name}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2 dark:text-white">Provincia</label>
            <select 
              bind:value={selectedProvince}
              on:change={loadResults}
              class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Todas las provincias</option>
              {#each provinces as province}
                <option value={province.id}>{province.name}</option>
              {/each}
            </select>
          </div>

          <div class="flex items-end gap-2">
            <button
              on:click={loadResults}
              disabled={loading}
              class="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
            <button
              on:click={exportResults}
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6">
        <div class="flex border-b dark:border-gray-700">
          <button
            class="flex-1 px-6 py-4 font-semibold transition {currentView === 'graficas' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600 dark:text-gray-400 hover:text-orange-600'}"
            on:click={() => currentView = 'graficas'}
          >
            <BarChart3 size={20} class="inline mr-2" />
            Gráficas y Resultados
          </button>
          <button
            class="flex-1 px-6 py-4 font-semibold transition {currentView === 'actas' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600 dark:text-gray-400 hover:text-orange-600'}"
            on:click={() => currentView = 'actas'}
          >
            <Eye size={20} class="inline mr-2" />
            Actas Validadas ({totalActasValidadas})
          </button>
        </div>
      </div>

      {#if loading}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
          <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-orange-600" />
          <p class="text-gray-600 dark:text-gray-400">Cargando resultados...</p>
        </div>
      {:else if currentView === 'graficas' && resultadosPorPosicion[selectedPosition]}
        {@const results = resultadosPorPosicion[selectedPosition]}
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Gráfico de Barras -->
          <div class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 class="text-xl font-bold mb-6 dark:text-white">Resultados Gráficos</h3>
            
            <div class="space-y-4">
              {#each results.parties as party, index}
                {@const percentage = getPercentage(party.votes, results.totalValidos)}
                
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-3">
                      <span class="font-bold dark:text-white w-20">{party.name}</span>
                    </div>
                    <div class="text-right">
                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        Votos: {party.votes.toLocaleString()} ({percentage}%)
                      </span>
                    </div>
                  </div>
                  
                  <div class="w-full bg-gray-200 dark:bg-gray-700 rounded h-12 overflow-hidden relative">
                    <div 
                      class="h-12 flex items-center justify-end pr-4 text-white font-semibold transition-all duration-500"
                      style="width: {percentage}%; background-color: {party.color}"
                    >
                      {#if parseFloat(percentage) > 5}
                        <span class="text-sm">{party.votes.toLocaleString()} ({percentage}%)</span>
                      {/if}
                    </div>
                    {#if parseFloat(percentage) <= 5}
                      <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-700 dark:text-gray-300">
                        {party.votes.toLocaleString()} ({percentage}%)
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Tabla de Estadísticas -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <!-- Header -->
            <div class="bg-red-700 text-white grid grid-cols-3 p-3 font-bold text-sm">
              <div>Detalle</div>
              <div class="text-right">Total</div>
              <div class="text-right">Porcentaje</div>
            </div>

            <!-- Datos -->
            <div class="divide-y dark:divide-gray-700">
              <!-- Votos Válidos -->
              <div class="grid grid-cols-3 p-3 text-sm">
                <div class="dark:text-white">Votos válidos</div>
                <div class="text-right font-bold dark:text-white">{results.totalValidos.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400">{getPercentage(results.totalValidos, results.totalGeneral)}%</div>
              </div>

              <!-- Votos Blancos -->
              <div class="grid grid-cols-3 p-3 text-sm bg-gray-50 dark:bg-gray-700/50">
                <div class="dark:text-white">Votos blancos</div>
                <div class="text-right font-bold dark:text-white">{results.totalBlancos.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400">{getPercentage(results.totalBlancos, results.totalGeneral)}%</div>
              </div>

              <!-- Votos Nulos -->
              <div class="grid grid-cols-3 p-3 text-sm">
                <div class="dark:text-white">Total de votos nulos</div>
                <div class="text-right font-bold dark:text-white">{results.totalNulos.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400">{getPercentage(results.totalNulos, results.totalGeneral)}%</div>
              </div>

              <!-- Votos Emitidos -->
              <div class="grid grid-cols-3 p-3 text-sm bg-gray-50 dark:bg-gray-700/50">
                <div class="font-semibold dark:text-white">Votos emitidos</div>
                <div class="text-right font-bold dark:text-white">{results.totalGeneral.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400"></div>
              </div>

              <!-- Ciudadanos por Actas Computadas -->
              <div class="grid grid-cols-3 p-3 text-sm">
                <div class="dark:text-white">Ciudadanos Habilitados por Actas Computadas</div>
                <div class="text-right font-bold dark:text-white">{ciudadanosPorActasComputadas.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400"></div>
              </div>

              <!-- Total Ciudadanos Habilitados -->
              <div class="grid grid-cols-3 p-3 text-sm bg-gray-50 dark:bg-gray-700/50">
                <div class="font-semibold dark:text-white">Total Ciudadanos Habilitados</div>
                <div class="text-right font-bold dark:text-white">{totalCiudadanosHabilitados.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400"></div>
              </div>

              <!-- Total Actas Computadas -->
              <div class="grid grid-cols-3 p-3 text-sm">
                <div class="font-semibold dark:text-white">Total Actas Computadas</div>
                <div class="text-right font-bold dark:text-white">{totalActasComputadas.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400">
                  {totalActasHabilitadas > 0 ? getPercentage(totalActasComputadas, totalActasHabilitadas) : '0.00'}%
                </div>
              </div>

              <!-- Total Actas Anuladas -->
              <div class="grid grid-cols-3 p-3 text-sm bg-gray-50 dark:bg-gray-700/50">
                <div class="dark:text-white">Total Actas Anuladas</div>
                <div class="text-right font-bold dark:text-white">{totalActasAnuladas}</div>
                <div class="text-right dark:text-gray-400">
                  {totalActasHabilitadas > 0 ? getPercentage(totalActasAnuladas, totalActasHabilitadas) : '0.00'}%
                </div>
              </div>

              <!-- Total Actas Habilitadas -->
              <div class="grid grid-cols-3 p-3 text-sm">
                <div class="font-semibold dark:text-white">Total Actas Habilitadas</div>
                <div class="text-right font-bold dark:text-white">{totalActasHabilitadas.toLocaleString()}</div>
                <div class="text-right dark:text-gray-400">100.00%</div>
              </div>
            </div>

            <!-- Footer con fecha -->
            <div class="p-3 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">
              <div>Fecha y hora del servidor:</div>
              <div>{new Date().toLocaleString('es-BO', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}</div>
            </div>
          </div>
        </div>
      {:else if currentView === 'actas'}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <!-- Búsqueda -->
          <div class="mb-6">
            <div class="relative">
              <Search size={20} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                bind:value={searchTerm}
                placeholder="Buscar por número de mesa, código o recinto..."
                class="w-full pl-10 pr-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <!-- Lista de Actas -->
          <div class="space-y-3 max-h-[600px] overflow-y-auto">
            {#each filteredActas as acta}
              <div class="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                      <span class="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full text-sm font-semibold">
                        ✓ VALIDADA
                      </span>
                      <span class="font-bold dark:text-white">Mesa #{acta.pollingTable.number}</span>
                      <span class="text-sm text-gray-500 dark:text-gray-400">Código: {acta.pollingTable.actCode}</span>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      <div>{acta.pollingTable.precinct?.name || 'N/A'}</div>
                      <div>{acta.pollingTable.precinct?.locality?.municipality?.province?.name || 'N/A'}</div>
                    </div>
                  </div>
                  <button
                    on:click={() => viewActa(acta)}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Eye size={16} />
                    Ver Detalles
                  </button>
                </div>
              </div>
            {/each}

            {#if filteredActas.length === 0}
              <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                No se encontraron actas validadas
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    {/if}
  </div>
</div>

<!-- Modal de Acta -->
{#if showActaModal && selectedActa}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold dark:text-white">
            Mesa #{selectedActa.pollingTable.number}
          </h3>
          <button
            on:click={() => showActaModal = false}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            ✕
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Info -->
          <div>
            <h4 class="font-bold mb-3 dark:text-white">Información</h4>
            <div class="space-y-2 text-sm">
              <div><strong>Código:</strong> {selectedActa.pollingTable.actCode}</div>
              <div><strong>Recinto:</strong> {selectedActa.pollingTable.precinct?.name || 'N/A'}</div>
              <div><strong>Provincia:</strong> {selectedActa.pollingTable.precinct?.locality?.municipality?.province?.name || 'N/A'}</div>
              <div><strong>Inscritos:</strong> {selectedActa.pollingTable.inscribedCount || 0}</div>
            </div>

            {#if selectedActa.notes}
              <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div class="font-bold text-sm mb-1 dark:text-white">Observaciones:</div>
                <div class="text-sm text-gray-700 dark:text-gray-300">{selectedActa.notes}</div>
              </div>
            {/if}
          </div>

          <!-- Imagen -->
          <div>
            {#if selectedActa.imageUrl}
              <h4 class="font-bold mb-3 dark:text-white">Imagen del Acta</h4>
              <img src={selectedActa.imageUrl} alt="Acta" class="w-full rounded-lg border dark:border-gray-700" />
            {/if}
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            on:click={() => showActaModal = false}
            class="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}