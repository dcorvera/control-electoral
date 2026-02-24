<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Check, X, Eye, ZoomIn, ZoomOut, Maximize2, AlertCircle, SkipForward, RefreshCw } from 'lucide-svelte';
  
  import type { Acta } from '$lib/types/types';
  import { getActaDetailsByActa } from '$lib/services/actaService';
  import { getCurrentUser, getCurrentUserRole, hasAnyRole } from '$lib/services/authService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  let userRole = '';
  
  // Acta actual
  let currentActa: Acta | null = null;
  let loading = false;
  let actaDetails: any[] = [];
  let specialVotes: any = null;
  let notes = '';
  
  // Agrupación de votos
  let votosPorPosicion: Record<string, any> = {};
  
  // Zoom
  let imageZoom = 100;
  let showImage = true;
  let imagePanX = 0;
  let imagePanY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  
  // Validación
  let validating = false;
  let rejectionReason = '';
  let observationReason = '';
  let showRejectionModal = false;
  let showObservationModal = false;

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      const hasAccess = await hasAnyRole(['superadmin', 'admin', 'validacion']);
      
      if (!hasAccess) {
        alert('No tienes permisos para acceder a esta sección');
        goto('/dashboard');
        return;
      }
      
      userRole = await getCurrentUserRole();
      loaded = true;
      
      await loadNextActa();
      
    } catch (error) {
      console.error('Error:', error);
      goto('/login');
    }
  });

  async function loadNextActa() {
    loading = true;
    currentActa = null;
    actaDetails = [];
    votosPorPosicion = {};
    specialVotes = null;
    notes = '';
    resetZoom();

    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      
      const query = new Parse.Query(ActaClass);
      query.equalTo('status', 'CERRADA');
      query.include([
        'pollingTable',
        'pollingTable.precinct',
        'pollingTable.precinct.locality',
        'pollingTable.precinct.locality.municipality',
        'pollingTable.precinct.locality.municipality.province',
        'electoralProcess',
        'transcribedBy'
      ]);
      query.ascending('updatedAt');
      query.limit(1);
      
      const result = await query.first();
      
      if (!result) {
        return;
      }
      
      const pollingTableObj = result.get('pollingTable');
      const precinctObj = pollingTableObj?.get('precinct');
      const localityObj = precinctObj?.get('locality');
      const municipalityObj = localityObj?.get('municipality');
      const provinceObj = municipalityObj?.get('province');
      
      currentActa = {
        id: result.id,
        code: result.get('code'),
        status: result.get('status'),
        imageUrl: result.get('imageUrl'),
        pollingTable: {
          id: pollingTableObj?.id,
          number: pollingTableObj?.get('number'),
          inscribedCount: pollingTableObj?.get('inscribedCount'),
          actCode: pollingTableObj?.get('actCode'),
          precinct: precinctObj ? {
            id: precinctObj.id,
            code: precinctObj.get('code'),
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
        },
        electoralProcess: {
          id: result.get('electoralProcess')?.id,
          name: result.get('electoralProcess')?.get('name'),
          year: result.get('electoralProcess')?.get('year')
        }
      } as Acta;
      
      specialVotes = result.get('specialVotes') || {};
      notes = result.get('notes') || '';
      
      await loadActaDetails();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar acta');
    } finally {
      loading = false;
    }
  }

  async function loadActaDetails() {
    if (!currentActa) return;
    
    try {
      actaDetails = await getActaDetailsByActa(currentActa.id!);
      
      votosPorPosicion = {};
      
      actaDetails.forEach(detail => {
        const positionId = detail.electoralPosition?.id;
        const positionName = detail.electoralPosition?.name;
        
        if (!positionId) return;
        
        if (!votosPorPosicion[positionId]) {
          votosPorPosicion[positionId] = {
            name: positionName,
            parties: [],
            totalValidos: 0
          };
        }
        
        votosPorPosicion[positionId].parties.push({
          name: detail.politicalOrganization?.sigla || 'N/A',
          fullName: detail.politicalOrganization?.name || '',
          votes: detail.votes || 0,
          color: detail.politicalOrganization?.color || '#ccc'
        });
        
        votosPorPosicion[positionId].totalValidos += (detail.votes || 0);
      });
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function approveActa() {
    if (!currentActa) return;
    
    if (!confirm('¿Aprobar esta acta como VALIDADA?')) return;
    
    validating = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(currentActa.id!);
      
      actaObj.set('status', 'VALIDADA');
      actaObj.set('validatedBy', currentUser);
      await actaObj.save();
      
      alert('✅ Acta aprobada exitosamente');
      await loadNextActa();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aprobar acta');
    } finally {
      validating = false;
    }
  }

  async function rejectActa() {
    if (!currentActa) return;
    
    if (!rejectionReason.trim()) {
      alert('Debe ingresar un motivo de rechazo');
      return;
    }
    
    validating = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(currentActa.id!);
      
      actaObj.set('status', 'CON_FOTO');
      actaObj.set('rejectionReason', rejectionReason.trim());
      actaObj.set('rejectedBy', currentUser);
      actaObj.unset('transcribedBy');
      
      await actaObj.save();
      
      alert('✅ Acta rechazada. Volverá a la cola de transcripción.');
      showRejectionModal = false;
      rejectionReason = '';
      await loadNextActa();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al rechazar acta');
    } finally {
      validating = false;
    }
  }

  async function markAsObserved() {
    if (!currentActa) return;
    
    if (!observationReason.trim()) {
      alert('Debe ingresar el motivo de la observación');
      return;
    }
    
    validating = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(currentActa.id!);
      
      actaObj.set('status', 'OBSERVADA');
      actaObj.set('observationReason', observationReason.trim());
      actaObj.set('observedBy', currentUser);
      actaObj.set('validatedBy', currentUser);
      
      await actaObj.save();
      
      alert('⚠️ Acta marcada como OBSERVADA. Requiere análisis adicional.');
      showObservationModal = false;
      observationReason = '';
      await loadNextActa();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al marcar acta como observada');
    } finally {
      validating = false;
    }
  }

  function skipActa() {
    if (confirm('¿Saltar esta acta y cargar la siguiente?')) {
      loadNextActa();
    }
  }

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
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        ✓ Validación de Actas
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Revisar y aprobar/rechazar actas transcritas
      </p>
      {#if userRole}
        <span class="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
          👤 Rol: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </span>
      {/if}
    </div>

    {#if loaded}
      {#if loading}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
          <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-orange-600" />
          <p class="text-gray-600 dark:text-gray-400">Cargando siguiente acta...</p>
        </div>
      {:else if currentActa}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Imagen -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold dark:text-white">📷 Imagen del Acta</h2>
              <div class="flex items-center gap-2">
                <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-50" on:click={zoomOut} disabled={imageZoom <= 50}>
                  <ZoomOut size={20} />
                </button>
                <span class="text-sm dark:text-gray-400 min-w-[60px] text-center font-mono">{imageZoom}%</span>
                <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-50" on:click={zoomIn} disabled={imageZoom >= 300}>
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
              <div><strong>Mesa:</strong> #{currentActa.pollingTable.number}</div>
              <div><strong>Código:</strong> {currentActa.pollingTable.actCode}</div>
              <div><strong>Recinto:</strong> {currentActa.pollingTable.precinct?.name || 'N/A'}</div>
              <div><strong>Provincia:</strong> {currentActa.pollingTable.precinct?.locality?.municipality?.province?.name || 'N/A'}</div>
              <div><strong>Inscritos:</strong> {currentActa.pollingTable.inscribedCount || 0}</div>
            </div>

            {#if showImage && currentActa.imageUrl}
              <div class="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 relative select-none" 
                   style="height: 600px; cursor: {imageZoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default'}"
                   on:mousedown={handleMouseDown} role="img" tabindex="0">
                <div class="w-full h-full flex items-center justify-center"
                     style="transform: translate({imagePanX}px, {imagePanY}px); transition: {isDragging ? 'none' : 'transform 0.1s ease'}">
                  <img src={currentActa.imageUrl} alt="Acta" 
                       style="max-width: {imageZoom}%; max-height: {imageZoom}%; width: auto; height: auto; object-fit: contain;"
                       class="select-none pointer-events-none" draggable="false" />
                </div>
                {#if imageZoom > 100}
                  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm z-10 pointer-events-none">
                    💡 Arrastra la imagen para moverla
                  </div>
                {/if}
              </div>
            {/if}

            <button class="w-full mt-4 px-4 py-3 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 transition flex items-center justify-center gap-2"
                    on:click={skipActa}>
              <SkipForward size={20} />
              Saltar esta acta
            </button>
          </div>

          <!-- Votos -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 class="text-xl font-bold mb-4 dark:text-white">📊 Votos Transcritos</h2>

            <div class="space-y-6 max-h-[700px] overflow-y-auto pr-2">
              {#each Object.entries(votosPorPosicion) as [positionId, position]}
                <div class="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 class="font-bold text-lg dark:text-white mb-3">{position.name}</h3>

                  <div class="space-y-2 mb-4">
                    {#each position.parties as party}
                      <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div class="flex items-center gap-2">
                          <div class="w-4 h-4 rounded-full" style="background-color: {party.color}"></div>
                          <span class="font-semibold dark:text-white">{party.name}</span>
                          <span class="text-xs text-gray-500 dark:text-gray-400">{party.fullName}</span>
                        </div>
                        <span class="font-bold text-lg dark:text-white">{party.votes}</span>
                      </div>
                    {/each}
                  </div>

                  {#if specialVotes[positionId]}
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                      {#if specialVotes[positionId].blancos > 0}
                        <div class="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <span class="text-sm font-medium dark:text-white">⬜ Votos en Blanco</span>
                          <span class="font-bold dark:text-white">{specialVotes[positionId].blancos}</span>
                        </div>
                      {/if}
                      {#if specialVotes[positionId].nulos > 0}
                        <div class="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <span class="text-sm font-medium dark:text-white">❌ Votos Nulos</span>
                          <span class="font-bold dark:text-white">{specialVotes[positionId].nulos}</span>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <div class="mt-3 pt-3 border-t-2 border-gray-300 dark:border-gray-600">
                    <div class="grid grid-cols-3 gap-2 text-center">
                      <div class="bg-green-50 dark:bg-green-900/20 rounded p-2">
                        <div class="text-xs text-gray-600 dark:text-gray-400">Válidos</div>
                        <div class="text-xl font-bold text-green-600 dark:text-green-400">{position.totalValidos}</div>
                      </div>
                      <div class="bg-gray-100 dark:bg-gray-700 rounded p-2">
                        <div class="text-xs text-gray-600 dark:text-gray-400">B+N</div>
                        <div class="text-xl font-bold dark:text-white">
                          {(specialVotes[positionId]?.blancos || 0) + (specialVotes[positionId]?.nulos || 0)}
                        </div>
                      </div>
                      <div class="bg-orange-50 dark:bg-orange-900/20 rounded p-2">
                        <div class="text-xs text-gray-600 dark:text-gray-400">TOTAL</div>
                        <div class="text-xl font-bold text-orange-600 dark:text-orange-400">
                          {position.totalValidos + (specialVotes[positionId]?.blancos || 0) + (specialVotes[positionId]?.nulos || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>

            <div class="mt-6 space-y-3">
              <button class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      on:click={approveActa} disabled={validating}>
                <Check size={20} />
                {validating ? 'Procesando...' : '✓ Aprobar y Validar'}
              </button>

              <button class="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      on:click={() => showObservationModal = true} disabled={validating}>
                <AlertCircle size={20} />
                ⚠ Marcar como Observada
              </button>
              
              <button class="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      on:click={() => showRejectionModal = true} disabled={validating}>
                <X size={20} />
                ✗ Rechazar
              </button>
            </div>

            <!-- Notas/Observaciones del Transcriptor -->
            {#if notes}
              <div class="mt-6 border-t-2 dark:border-gray-700 pt-4">
                <div class="border-2 border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                  <div class="flex items-start gap-2">
                    <AlertCircle size={20} class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">📝 Observaciones del Transcriptor</h4>
                      <p class="text-sm text-yellow-700 dark:text-yellow-300">{notes}</p>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
          <div class="text-6xl mb-4">✅</div>
          <h2 class="text-2xl font-bold mb-2 dark:text-white">¡Excelente trabajo!</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">No hay más actas pendientes de validación</p>
          <button on:click={loadNextActa} class="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold flex items-center justify-center gap-2 mx-auto">
            <RefreshCw size={20} />
            Buscar Nuevas Actas
          </button>
        </div>
      {/if}
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    {/if}
  </div>
</div>

{#if showRejectionModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold mb-4 dark:text-white">✗ Rechazar Acta</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Indique el motivo del rechazo. El acta volverá a la cola de transcripción.</p>
      <textarea bind:value={rejectionReason} placeholder="Ej: Votos no coinciden con la imagen, error en conteo de partido PDC, falta registrar votos nulos..."
                rows="4" class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:border-red-500 focus:outline-none resize-none mb-4"
                maxlength="500"></textarea>
      <div class="flex gap-3">
        <button class="flex-1 px-4 py-3 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 transition"
                on:click={() => { showRejectionModal = false; rejectionReason = ''; }}>
          Cancelar
        </button>
        <button class="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50"
                on:click={rejectActa} disabled={!rejectionReason.trim() || validating}>
          {validating ? 'Rechazando...' : 'Confirmar Rechazo'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de Observación -->
{#if showObservationModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold mb-4 dark:text-white flex items-center gap-2">
        <AlertCircle size={24} class="text-yellow-600" />
        ⚠ Marcar como Observada
      </h3>
      
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        El acta requiere análisis adicional más estricto para determinar si se aprueba o anula.
      </p>
      
      <textarea bind:value={observationReason}
        placeholder="Ej: Votos muy ajustados entre partidos, diferencia menor a 5 votos. Requiere verificación adicional..."
        rows="4" class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:border-yellow-500 focus:outline-none resize-none mb-4"
        maxlength="500"></textarea>
      
      <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4 text-xs text-yellow-700 dark:text-yellow-300">
        <strong>Nota:</strong> Las actas observadas irán a una cola especial donde se decide si se aprueban o anulan.
      </div>
      
      <div class="flex gap-3">
        <button class="flex-1 px-4 py-3 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 transition"
                on:click={() => { showObservationModal = false; observationReason = ''; }}>
          Cancelar
        </button>
        <button class="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold disabled:opacity-50"
                on:click={markAsObserved} disabled={!observationReason.trim() || validating}>
          {validating ? 'Procesando...' : 'Marcar como Observada'}
        </button>
      </div>
    </div>
  </div>
{/if}