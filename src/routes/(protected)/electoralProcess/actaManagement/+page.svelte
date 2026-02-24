<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { FileText, Plus, Check, X } from 'lucide-svelte';

  import type {
    Acta,
    ActaDetail,
    PollingTable,
    ElectoralProcess,
    ElectoralPosition,
    PartyParticipation
  } from '$lib/types/types';

  // Importar servicios (deberás crearlos)
  import { 
    getActasByProcess, 
    createActa,
    updateActa 
  } from '$lib/services/actaService';
  
  import { getPollingTables } from '$lib/services/pollingTableService';
  import { getElectoralProcessActive } from '$lib/services/electoralProcessService';
  import { getElectoralPositions } from '$lib/services/electoralPositionService';
  import { getPartyParticipations } from '$lib/services/partyParticipationService';

  // Estado general
  let loaded = false;
  let selectedProcess: ElectoralProcess | null = null;
  let selectedPosition: ElectoralPosition | null = null;
  let selectedTable: PollingTable | null = null;

  // Datos
  let allProcesses: ElectoralProcess[] = [];
  let allPositions: ElectoralPosition[] = [];
  let allTables: PollingTable[] = [];
  let availableParticipations: PartyParticipation[] = [];
  
  // Actas
  let currentActa: Acta | null = null;
  let actaDetails: { [key: string]: number } = {}; // partyParticipationId -> votes

  // UI
  let step: 'select-process' | 'select-position' | 'select-table' | 'fill-acta' = 'select-process';
  let isSaving = false;

  onMount(async () => {
    if (!browser) return;

    try {
      allProcesses = await getElectoralProcessActive();
      loaded = true;
    } catch (error) {
      console.error('Error cargando procesos:', error);
      alert('Error al cargar los datos');
    }
  });

  async function onProcessSelected() {
    if (!selectedProcess) return;
    
    try {
      // Cargar cargos del proceso seleccionado
      allPositions = await getElectoralPositions();
      allPositions = allPositions.filter(p => 
        p.electoralProcess.id === selectedProcess!.id
      );
      
      step = 'select-position';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar cargos');
    }
  }

  async function onPositionSelected() {
    if (!selectedPosition) return;
    
    try {
      // Cargar mesas de votación
      allTables = await getPollingTables();
      
      // Filtrar por alcance geográfico si es necesario
      // TODO: filtrar según departamento/provincia/municipio
      
      step = 'select-table';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar mesas');
    }
  }

  async function onTableSelected() {
    if (!selectedTable || !selectedProcess || !selectedPosition) return;
    
    try {
      // Buscar si ya existe un acta para esta mesa/cargo/proceso
      const existingActas = await getActasByProcess(selectedProcess.id!);
      currentActa = existingActas.find(a => 
        a.pollingTable.id === selectedTable!.id &&
        // Agregar más filtros según tus necesidades
        true
      ) || null;

      // Cargar participaciones de partidos para este cargo
      const allParticipations = await getPartyParticipations();
      availableParticipations = allParticipations.filter(p => 
        p.electoralPosition.id === selectedPosition!.id &&
        p.electoralProcess.id === selectedProcess!.id &&
        p.enabled &&
        // Filtrar por alcance geográfico
        matchesGeographicScope(p, selectedTable!)
      );

      // Ordenar por orden
      availableParticipations.sort((a, b) => a.order - b.order);

      // Inicializar votos en 0
      actaDetails = {};
      availableParticipations.forEach(p => {
        actaDetails[p.id!] = 0;
      });

      step = 'fill-acta';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al preparar el acta');
    }
  }

  function matchesGeographicScope(participation: PartyParticipation, table: PollingTable): boolean {
    // TODO: Implementar lógica según el alcance geográfico
    // Por ahora, acepta todos
    return true;
  }

  async function saveActa(status: 'BORRADOR' | 'CERRADA' | 'VALIDADA') {
    if (!selectedProcess || !selectedPosition || !selectedTable) return;

    isSaving = true;

    try {
      // Crear o actualizar el acta
      const actaData = {
        code: `MESA-${selectedTable.number}-${selectedTable.actCode || 'SIN-CODIGO'}`,
        pollingTableId: selectedTable.id!,
        electoralProcessId: selectedProcess.id!,
        status: status
      };

      let actaId: string;
      
      if (currentActa?.id) {
        await updateActa(currentActa.id, actaData);
        actaId = currentActa.id;
      } else {
        const newActa = await createActa(actaData);
        actaId = newActa.id!;
      }

      // Guardar detalles del acta (votos por partido)
      // TODO: Implementar guardado de ActaDetail
      
      alert('Acta guardada exitosamente');
      
      if (status === 'CERRADA' || status === 'VALIDADA') {
        // Resetear y volver al inicio
        resetForm();
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar el acta');
    } finally {
      isSaving = false;
    }
  }

  function resetForm() {
    selectedProcess = null;
    selectedPosition = null;
    selectedTable = null;
    currentActa = null;
    actaDetails = {};
    availableParticipations = [];
    step = 'select-process';
  }

  // Calcular totales
  $: totalVotes = Object.values(actaDetails).reduce((sum, votes) => sum + votes, 0);
  $: registeredVoters = selectedTable?.inscribedCount || 0;
  $: participationRate = registeredVoters > 0 
    ? ((totalVotes / registeredVoters) * 100).toFixed(2)
    : '0';
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Gestión de Actas Electorales
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Registre los resultados de votación por mesa
      </p>
    </div>

    {#if loaded}
      <!-- Breadcrumb / Stepper -->
      <div class="mb-8 flex items-center gap-4">
        <div class="flex items-center gap-2 {step === 'select-process' ? 'text-orange-600' : 'text-gray-400'}">
          <div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            1
          </div>
          <span class="font-medium">Proceso</span>
        </div>
        
        <div class="w-12 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
        
        <div class="flex items-center gap-2 {step === 'select-position' ? 'text-orange-600' : 'text-gray-400'}">
          <div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            2
          </div>
          <span class="font-medium">Cargo</span>
        </div>
        
        <div class="w-12 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
        
        <div class="flex items-center gap-2 {step === 'select-table' ? 'text-orange-600' : 'text-gray-400'}">
          <div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            3
          </div>
          <span class="font-medium">Mesa</span>
        </div>
        
        <div class="w-12 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
        
        <div class="flex items-center gap-2 {step === 'fill-acta' ? 'text-orange-600' : 'text-gray-400'}">
          <div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            4
          </div>
          <span class="font-medium">Votos</span>
        </div>
      </div>

      <!-- Content -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {#if step === 'select-process'}
          <div>
            <h2 class="text-xl font-bold mb-4 dark:text-white">Seleccione el Proceso Electoral</h2>
            <div class="grid gap-4">
              {#each allProcesses as process}
                <button
                  class="p-4 border-2 rounded-lg text-left hover:border-orange-500 transition {selectedProcess?.id === process.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700'}"
                  on:click={() => selectedProcess = process}
                >
                  <div class="font-semibold dark:text-white">{process.name}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {process.year} - {process.type}
                  </div>
                </button>
              {/each}
            </div>
            
            <div class="mt-6 flex justify-end">
              <button
                class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
                disabled={!selectedProcess}
                on:click={onProcessSelected}
              >
                Continuar
              </button>
            </div>
          </div>

        {:else if step === 'select-position'}
          <div>
            <h2 class="text-xl font-bold mb-4 dark:text-white">Seleccione el Cargo Electoral</h2>
            <div class="grid gap-4">
              {#each allPositions as position}
                <button
                  class="p-4 border-2 rounded-lg text-left hover:border-orange-500 transition {selectedPosition?.id === position.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700'}"
                  on:click={() => selectedPosition = position}
                >
                  <div class="font-semibold dark:text-white">{position.name}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    Alcance: {position.scope}
                  </div>
                </button>
              {/each}
            </div>
            
            <div class="mt-6 flex justify-between">
              <button
                class="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 transition"
                on:click={() => step = 'select-process'}
              >
                Atrás
              </button>
              <button
                class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
                disabled={!selectedPosition}
                on:click={onPositionSelected}
              >
                Continuar
              </button>
            </div>
          </div>

        {:else if step === 'select-table'}
          <div>
            <h2 class="text-xl font-bold mb-4 dark:text-white">Seleccione la Mesa de Votación</h2>
            
            <div class="mb-4">
              <input
                type="text"
                placeholder="Buscar mesa por número..."
                class="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div class="max-h-96 overflow-y-auto">
              <div class="grid gap-3">
                {#each allTables as table}
                  <button
                    class="p-4 border-2 rounded-lg text-left hover:border-orange-500 transition {selectedTable?.id === table.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700'}"
                    on:click={() => selectedTable = table}
                  >
                    <div class="flex justify-between items-start">
                      <div>
                        <div class="font-semibold dark:text-white">Mesa #{table.number}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">
                          Código: {table.actCode || 'Sin código'}
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                          {table.inscribedCount || 0} inscritos
                        </div>
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
            
            <div class="mt-6 flex justify-between">
              <button
                class="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 transition"
                on:click={() => step = 'select-position'}
              >
                Atrás
              </button>
              <button
                class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
                disabled={!selectedTable}
                on:click={onTableSelected}
              >
                Continuar
              </button>
            </div>
          </div>

        {:else if step === 'fill-acta'}
          <div>
            <!-- Info Header -->
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6 border border-blue-200 dark:border-blue-800">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Proceso</div>
                  <div class="font-semibold dark:text-white">{selectedProcess?.name}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Cargo</div>
                  <div class="font-semibold dark:text-white">{selectedPosition?.name}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Mesa</div>
                  <div class="font-semibold dark:text-white">#{selectedTable?.number}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Inscritos</div>
                  <div class="font-semibold dark:text-white">{registeredVoters}</div>
                </div>
              </div>
            </div>

            <h2 class="text-xl font-bold mb-4 dark:text-white">Registro de Votos</h2>

            <!-- Tabla de votos -->
            <div class="space-y-3 mb-6">
              {#each availableParticipations as participation}
                <div class="flex items-center gap-4 p-4 border rounded-lg dark:border-gray-700">
                  <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                       style="background-color: {participation.politicalOrganization.color}">
                    {participation.order}
                  </div>
                  
                  <div class="flex-grow">
                    <div class="font-semibold dark:text-white">
                      {participation.politicalOrganization.sigla}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      {participation.politicalOrganization.name}
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <button
                      class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                      on:click={() => actaDetails[participation.id!] = Math.max(0, actaDetails[participation.id!] - 1)}
                    >
                      −
                    </button>
                    
                    <input
                      type="number"
                      min="0"
                      bind:value={actaDetails[participation.id!]}
                      class="w-24 px-3 py-2 text-center border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    
                    <button
                      class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                      on:click={() => actaDetails[participation.id!] = (actaDetails[participation.id!] || 0) + 1}
                    >
                      +
                    </button>
                  </div>
                </div>
              {/each}

              <!-- Votos adicionales (blancos, nulos, etc.) -->
              <div class="border-t-2 border-gray-300 dark:border-gray-600 pt-3 mt-6">
                <div class="flex items-center gap-4 p-4 border rounded-lg dark:border-gray-700">
                  <div class="flex-grow">
                    <div class="font-semibold dark:text-white">Votos en Blanco</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value="0"
                    class="w-24 px-3 py-2 text-center border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                
                <div class="flex items-center gap-4 p-4 border rounded-lg dark:border-gray-700 mt-3">
                  <div class="flex-grow">
                    <div class="font-semibold dark:text-white">Votos Nulos</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value="0"
                    class="w-24 px-3 py-2 text-center border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <!-- Resumen -->
            <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-6">
              <div class="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div class="text-gray-600 dark:text-gray-400 text-sm">Total Votos</div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">{totalVotes}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400 text-sm">Inscritos</div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">{registeredVoters}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400 text-sm">Participación</div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">{participationRate}%</div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-between gap-3">
              <button
                class="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 transition"
                on:click={() => step = 'select-table'}
              >
                Atrás
              </button>
              
              <div class="flex gap-3">
                <button
                  class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                  disabled={isSaving}
                  on:click={() => saveActa('BORRADOR')}
                >
                  Guardar Borrador
                </button>
                
                <button
                  class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                  disabled={isSaving || totalVotes === 0}
                  on:click={() => saveActa('CERRADA')}
                >
                  Cerrar Acta
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    {/if}
  </div>
</div>