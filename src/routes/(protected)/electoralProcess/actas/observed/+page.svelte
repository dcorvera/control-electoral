<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Check, X, Eye, ZoomIn, ZoomOut, Maximize2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-svelte';
  
  import type { Acta } from '$lib/types/types';
  import { getCurrentUser, hasAnyRole } from '$lib/services/authService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  
  // Lista de actas observadas
  let actasObservadas: any[] = [];
  let loading = false;
  
  // Acta seleccionada
  let selectedActa: any | null = null;
  let actaDetails: any[] = [];
  let votosPorPosicion: Record<string, any> = {};
  
  // Visualización
  let imageZoom = 100;
  let showImage = true;
  let imagePanX = 0;
  let imagePanY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  
  // Decisión
  let deciding = false;
  let anulacionReason = '';
  let showAnulacionModal = false;
  let showRechazarModal = false;
  let rechazoReason = '';

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      const hasAccess = await hasAnyRole(['superadmin', 'admin']);
      
      if (!hasAccess) {
        alert('No tienes permisos para acceder a esta sección');
        goto('/dashboard');
        return;
      }
      
      loaded = true;
      await loadActasObservadas();
      
    } catch (error) {
      console.error('Error:', error);
      goto('/login');
    }
  });

  async function loadActasObservadas() {
    loading = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      
      const query = new Parse.Query(ActaClass);
      query.equalTo('status', 'OBSERVADA');
      query.include([
        'pollingTable',
        'pollingTable.precinct',
        'pollingTable.precinct.locality',
        'pollingTable.precinct.locality.municipality',
        'pollingTable.precinct.locality.municipality.province',
        'observedBy',
        'transcribedBy'
      ]);
      query.descending('createdAt');
      query.limit(100);
      
      const results = await query.find();
      
      actasObservadas = results.map(result => {
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
          observationReason: result.get('observationReason') || '',
          observedBy: result.get('observedBy')?.get('username') || 'N/A',
          transcribedBy: result.get('transcribedBy')?.get('username') || 'N/A',
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
        };
      });
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar actas observadas');
    } finally {
      loading = false;
    }
  }

  async function viewActa(acta: any) {
    selectedActa = acta;
    await loadActaDetails(acta.id);
    resetZoom();
  }

  async function loadActaDetails(actaId: string) {
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      const ActaDetail = Parse.Object.extend('ActaDetail');
      const query = new Parse.Query(ActaDetail);
      
      const Acta = Parse.Object.extend('Acta');
      const actaPointer = Acta.createWithoutData(actaId);
      query.equalTo('acta', actaPointer);
      query.include(['electoralPosition', 'politicalOrganization']);
      
      const results = await query.find();
      
      actaDetails = results.map(r => ({
        electoralPosition: {
          id: r.get('electoralPosition')?.id,
          name: r.get('electoralPosition')?.get('name')
        },
        politicalOrganization: {
          id: r.get('politicalOrganization')?.id,
          sigla: r.get('politicalOrganization')?.get('sigla'),
          name: r.get('politicalOrganization')?.get('name'),
          color: r.get('politicalOrganization')?.get('color')
        },
        votes: r.get('votes') || 0
      }));
      
      // Agrupar por posición
      votosPorPosicion = {};
      actaDetails.forEach(detail => {
        const posId = detail.electoralPosition?.id;
        if (!posId) return;
        
        if (!votosPorPosicion[posId]) {
          votosPorPosicion[posId] = {
            name: detail.electoralPosition?.name,
            parties: [],
            totalValidos: 0
          };
        }
        
        votosPorPosicion[posId].parties.push({
          name: detail.politicalOrganization?.sigla || 'N/A',
          fullName: detail.politicalOrganization?.name || '',
          votes: detail.votes,
          color: detail.politicalOrganization?.color || '#ccc'
        });
        
        votosPorPosicion[posId].totalValidos += detail.votes;
      });
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function aprobarActa() {
    if (!selectedActa) return;
    
    if (!confirm('¿Aprobar definitivamente esta acta como VALIDADA?')) return;
    
    deciding = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(selectedActa.id);
      
      actaObj.set('status', 'VALIDADA');
      actaObj.set('validatedBy', currentUser);
      await actaObj.save();
      
      alert('✅ Acta aprobada definitivamente');
      selectedActa = null;
      await loadActasObservadas();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aprobar acta');
    } finally {
      deciding = false;
    }
  }

  async function anularActa() {
    if (!selectedActa || !anulacionReason.trim()) {
      alert('Debe ingresar el motivo de anulación');
      return;
    }
    
    deciding = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(selectedActa.id);
      
      actaObj.set('status', 'ANULADA');
      actaObj.set('anulacionReason', anulacionReason.trim());
      actaObj.set('anuladaBy', currentUser);
      await actaObj.save();
      
      alert('❌ Acta anulada definitivamente');
      showAnulacionModal = false;
      anulacionReason = '';
      selectedActa = null;
      await loadActasObservadas();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al anular acta');
    } finally {
      deciding = false;
    }
  }

  async function rechazarActa() {
    if (!selectedActa || !rechazoReason.trim()) {
      alert('Debe ingresar el motivo del rechazo');
      return;
    }
    
    deciding = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(selectedActa.id);
      
      actaObj.set('status', 'CON_FOTO');
      actaObj.set('rejectionReason', rechazoReason.trim());
      actaObj.set('rejectedBy', currentUser);
      actaObj.unset('transcribedBy');
      actaObj.unset('observedBy');
      actaObj.unset('observationReason');
      
      await actaObj.save();
      
      alert('🔄 Acta rechazada. Volverá a transcripción.');
      showRechazarModal = false;
      rechazoReason = '';
      selectedActa = null;
      await loadActasObservadas();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al rechazar acta');
    } finally {
      deciding = false;
    }
  }

  function closeDetail() {
    selectedActa = null;
  }

  // Funciones de zoom
  function resetZoom() {
    imageZoom = 100;
    imagePanX = 0;
    imagePanY = 0;
  }

  function zoomIn() {
    if (imageZoom < 300) imageZoom += 25;
  }

  function zoomOut() {
    if (imageZoom > 50) {
      imageZoom -= 25;
      if (imageZoom <= 100) {
        imagePanX = 0;
        imagePanY = 0;
      }
    }
  }

  function toggleImage() {
    showImage = !showImage;
  }

  function handleMouseDown(e: MouseEvent) {
    if (imageZoom > 100) {
      isDragging = true;
      startX = e.clientX - imagePanX;
      startY = e.clientY - imagePanY;
      e.preventDefault();
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      imagePanX = e.clientX - startX;
      imagePanY = e.clientY - startY;
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }
</script>

<svelte:window on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        ⚠️ Análisis de Actas Observadas
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Revisión estricta para aprobar o anular actas observadas
      </p>
    </div>

    {#if loaded}
      {#if !selectedActa}
        <!-- Lista de Actas Observadas -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold dark:text-white">
              Actas Pendientes de Análisis ({actasObservadas.length})
            </h2>
            <button
              on:click={loadActasObservadas}
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          {#if loading}
            <div class="text-center py-12">
              <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-orange-600" />
              <p class="text-gray-600 dark:text-gray-400">Cargando...</p>
            </div>
          {:else if actasObservadas.length === 0}
            <div class="text-center py-12">
              <div class="text-6xl mb-4">✅</div>
              <h3 class="text-xl font-bold mb-2 dark:text-white">No hay actas observadas</h3>
              <p class="text-gray-600 dark:text-gray-400">
                Todas las actas observadas han sido procesadas
              </p>
            </div>
          {:else}
            <div class="space-y-3">
              {#each actasObservadas as acta}
                <div class="border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-3 mb-2">
                        <span class="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-semibold">
                          ⚠️ OBSERVADA
                        </span>
                        <span class="font-bold dark:text-white">Mesa #{acta.pollingTable.number}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400">Código: {acta.pollingTable.actCode}</span>
                      </div>
                      
                      <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <div>{acta.pollingTable.precinct?.name || 'N/A'}</div>
                        <div>{acta.pollingTable.precinct?.locality?.municipality?.province?.name || 'N/A'}</div>
                      </div>

                      <div class="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700 mb-2">
                        <div class="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                          Motivo de Observación:
                        </div>
                        <div class="text-sm text-yellow-700 dark:text-yellow-300">
                          {acta.observationReason}
                        </div>
                      </div>

                      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Transcrito por: {acta.transcribedBy}</span>
                        <span>Observado por: {acta.observedBy}</span>
                      </div>
                    </div>

                    <button
                      on:click={() => viewActa(acta)}
                      class="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <Eye size={16} />
                      Analizar
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Detalle del Acta -->
        <div class="space-y-6">
          <!-- Botón Volver -->
          <button
            on:click={closeDetail}
            class="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 transition flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Volver a la Lista
          </button>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Imagen -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-bold dark:text-white">📷 Imagen del Acta</h2>
                <div class="flex items-center gap-2">
                  <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" on:click={zoomOut} disabled={imageZoom <= 50}>
                    <ZoomOut size={20} />
                  </button>
                  <span class="text-sm dark:text-gray-400 min-w-[60px] text-center font-mono">{imageZoom}%</span>
                  <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" on:click={zoomIn} disabled={imageZoom >= 300}>
                    <ZoomIn size={20} />
                  </button>
                  <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" on:click={resetZoom}>
                    <Maximize2 size={20} />
                  </button>
                  <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" on:click={toggleImage}>
                    <Eye size={20} />
                  </button>
                </div>
              </div>

              <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
                <div><strong>Mesa:</strong> #{selectedActa.pollingTable.number}</div>
                <div><strong>Código:</strong> {selectedActa.pollingTable.actCode}</div>
                <div><strong>Recinto:</strong> {selectedActa.pollingTable.precinct?.name || 'N/A'}</div>
                <div><strong>Inscritos:</strong> {selectedActa.pollingTable.inscribedCount || 0}</div>
              </div>

              {#if showImage && selectedActa.imageUrl}
                <div class="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 relative select-none" 
                     style="height: 600px; cursor: {imageZoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default'}"
                     on:mousedown={handleMouseDown} role="img" tabindex="0">
                  <div class="w-full h-full flex items-center justify-center"
                       style="transform: translate({imagePanX}px, {imagePanY}px); transition: {isDragging ? 'none' : 'transform 0.1s ease'}">
                    <img src={selectedActa.imageUrl} alt="Acta" 
                         style="max-width: {imageZoom}%; max-height: {imageZoom}%; width: auto; height: auto; object-fit: contain;"
                         class="select-none pointer-events-none" draggable="false" />
                  </div>
                  {#if imageZoom > 100}
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm z-10">
                      💡 Arrastra para mover
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Información y Decisión -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 class="text-xl font-bold mb-4 dark:text-white">📊 Información del Acta</h2>

              <!-- Motivo de Observación -->
              <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg">
                <div class="flex items-start gap-2">
                  <AlertCircle size={20} class="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">
                      ⚠️ Motivo de Observación
                    </h4>
                    <p class="text-sm text-yellow-700 dark:text-yellow-300">
                      {selectedActa.observationReason}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Notas del Transcriptor -->
              {#if selectedActa.notes}
                <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <h4 class="font-bold text-blue-800 dark:text-blue-200 mb-1">
                    📝 Observaciones del Transcriptor
                  </h4>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    {selectedActa.notes}
                  </p>
                </div>
              {/if}

              <!-- Votos -->
              <div class="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
                {#each Object.entries(votosPorPosicion) as [posId, pos]}
                  <div class="border rounded-lg p-3">
                    <h3 class="font-bold mb-2 dark:text-white">{pos.name}</h3>
                    {#each pos.parties as party}
                      <div class="flex items-center justify-between text-sm mb-1">
                        <span class="dark:text-gray-300">{party.name}</span>
                        <span class="font-bold dark:text-white">{party.votes}</span>
                      </div>
                    {/each}
                    {#if selectedActa.specialVotes[posId]}
                      <div class="border-t mt-2 pt-2 text-xs space-y-1">
                        {#if selectedActa.specialVotes[posId].blancos > 0}
                          <div class="flex justify-between">
                            <span>Blancos:</span>
                            <span>{selectedActa.specialVotes[posId].blancos}</span>
                          </div>
                        {/if}
                        {#if selectedActa.specialVotes[posId].nulos > 0}
                          <div class="flex justify-between">
                            <span>Nulos:</span>
                            <span>{selectedActa.specialVotes[posId].nulos}</span>
                          </div>
                        {/if}
                      </div>
                    {/if}
                    <div class="border-t mt-2 pt-2 font-bold">
                      <div class="flex justify-between dark:text-white">
                        <span>TOTAL:</span>
                        <span>{pos.totalValidos + (selectedActa.specialVotes[posId]?.blancos || 0) + (selectedActa.specialVotes[posId]?.nulos || 0)}</span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Botones de Decisión -->
              <div class="space-y-3">
                <button
                  class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  on:click={aprobarActa}
                  disabled={deciding}
                >
                  <Check size={20} />
                  ✓ Aprobar Definitivamente
                </button>

                <button
                  class="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  on:click={() => showAnulacionModal = true}
                  disabled={deciding}
                >
                  <X size={20} />
                  ✗ Anular Acta
                </button>

                <button
                  class="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  on:click={() => showRechazarModal = true}
                  disabled={deciding}
                >
                  <ArrowLeft size={20} />
                  Rechazar (Volver a Transcripción)
                </button>
              </div>
            </div>
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

<!-- Modal de Anulación -->
{#if showAnulacionModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold mb-4 dark:text-white text-red-600">
        ✗ Anular Acta Definitivamente
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        El acta será marcada como ANULADA y NO contará en los resultados finales.
      </p>
      <textarea bind:value={anulacionReason} placeholder="Motivo de anulación..."
                rows="4" class="w-full px-4 py-3 border-2 rounded-lg dark:bg-gray-700 dark:text-white mb-4"
                maxlength="500"></textarea>
      <div class="flex gap-3">
        <button class="flex-1 px-4 py-3 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
                on:click={() => { showAnulacionModal = false; anulacionReason = ''; }}>
          Cancelar
        </button>
        <button class="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50"
                on:click={anularActa} disabled={!anulacionReason.trim() || deciding}>
          {deciding ? 'Anulando...' : 'Confirmar Anulación'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de Rechazo -->
{#if showRechazarModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold mb-4 dark:text-white text-orange-600">
        🔄 Rechazar y Volver a Transcripción
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        El acta volverá al estado CON_FOTO para ser transcrita nuevamente.
      </p>
      <textarea bind:value={rechazoReason} placeholder="Motivo del rechazo..."
                rows="4" class="w-full px-4 py-3 border-2 rounded-lg dark:bg-gray-700 dark:text-white mb-4"
                maxlength="500"></textarea>
      <div class="flex gap-3">
        <button class="flex-1 px-4 py-3 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
                on:click={() => { showRechazarModal = false; rechazoReason = ''; }}>
          Cancelar
        </button>
        <button class="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold disabled:opacity-50"
                on:click={rechazarActa} disabled={!rechazoReason.trim() || deciding}>
          {deciding ? 'Rechazando...' : 'Confirmar Rechazo'}
        </button>
      </div>
    </div>
  </div>
{/if}