<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { RefreshCw, Eye, Save, ZoomIn, ZoomOut, SkipForward, BarChart3, Maximize2, AlertCircle } from 'lucide-svelte';
  
  import type { Acta, ElectoralPosition, PartyParticipation } from '$lib/types/types';
  import { createActaDetail, getActaDetailsByActa } from '$lib/services/actaService';
  import { getElectoralPositions } from '$lib/services/electoralPositionService';
  import { getPartyParticipations } from '$lib/services/partyParticipationService';
  import { getCurrentUser, getCurrentUserRole, hasAnyRole } from '$lib/services/authService';
  import { getNextActaForTranscription, releaseActa, getQueueStatistics } from '$lib/services/actaQueueService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  let userRole = '';
  let isAdmin = false;
  
  // Acta actual
  let currentActa: Acta | null = null;
  let loading = false;
  
  // Estructura del acta
  let actaStructure: {
    franjas: Array<{
      position: ElectoralPosition;
      parties: PartyParticipation[];
    }>;
  } | null = null;
  
  // Votos capturados
  let votes: Record<string, Record<string, number>> = {}; // {positionId: {partyId: votes}}
  let votosEspeciales: Record<string, { blancos: number; nulos: number }> = {}; // {positionId: {blancos, nulos}}
  let notes = ''; // Notas/observaciones del acta
  let saving = false;
  
  // Visualización de imagen mejorada con pan/drag
  let imageZoom = 100;
  let showImage = true;
  let imagePanX = 0;
  let imagePanY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // Estadísticas (solo admin)
  let statistics: any = null;
  let showStatistics = false;

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      const hasAccess = await hasAnyRole(['superadmin', 'admin', 'transcripcion']);
      
      if (!hasAccess) {
        alert('No tienes permisos para acceder a esta sección');
        goto('/dashboard');
        return;
      }
      
      userRole = await getCurrentUserRole();
      isAdmin = await hasAnyRole(['superadmin', 'admin']);
      
      loaded = true;
      
      if (isAdmin) {
        loadStatistics();
      }
      
      await loadNextActa();
      
    } catch (error) {
      console.error('Error:', error);
      goto('/login');
    }
  });

  async function loadNextActa() {
    if (!currentUser) return;
    
    loading = true;
    currentActa = null;
    actaStructure = null;
    votes = {};
    votosEspeciales = {};
    notes = '';
    resetZoom();

    try {
      const acta = await getNextActaForTranscription(currentUser.id, isAdmin);
      
      if (!acta) {
        alert('✅ ¡Excelente! No hay más actas pendientes de transcripción.');
        return;
      }
      
      currentActa = acta;
      await loadActaStructure();
      await loadExistingVotes();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar acta');
    } finally {
      loading = false;
    }
  }

  async function loadStatistics() {
    try {
      statistics = await getQueueStatistics();
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  async function skipActa() {
    if (!currentActa) return;
    
    if (confirm('¿Desea liberar esta acta y tomar otra?')) {
      await releaseActa(currentActa.id!);
      await loadNextActa();
      
      if (isAdmin) {
        loadStatistics();
      }
    }
  }

  async function loadActaStructure() {
    if (!currentActa) return;
    
    try {
      const allPositions = await getElectoralPositions();
      const processPositions = allPositions.filter(
        p => p.electoralProcess.id === currentActa!.electoralProcess.id
      );
      
      const allParticipations = await getPartyParticipations();
      
      const tableDepartmentId = currentActa.pollingTable.precinct?.locality?.municipality?.province?.departament?.id;
      const tableProvinceId = currentActa.pollingTable.precinct?.locality?.municipality?.province?.id;
      const tableMunicipalityId = currentActa.pollingTable.precinct?.locality?.municipality?.id;
      
      const franjas: Array<{
        position: ElectoralPosition;
        parties: PartyParticipation[];
      }> = [];
      
      for (const position of processPositions) {
        let partiesForPosition = allParticipations.filter(
          p => p.electoralPosition.id === position.id && p.enabled
        );
        
        if (position.scope === 'DEPARTAMENTAL' && tableDepartmentId) {
          partiesForPosition = partiesForPosition.filter(
            p => p.department?.id === tableDepartmentId
          );
        } else if (position.scope === 'PROVINCIAL' && tableProvinceId) {
          partiesForPosition = partiesForPosition.filter(
            p => p.province?.id === tableProvinceId
          );
        } else if (position.scope === 'MUNICIPAL' && tableMunicipalityId) {
          partiesForPosition = partiesForPosition.filter(
            p => p.municipality?.id === tableMunicipalityId
          );
        }
        
        if (partiesForPosition.length > 0) {
          franjas.push({
            position,
            parties: partiesForPosition.sort((a, b) => a.order - b.order)
          });
        }
      }
      
      actaStructure = {
        franjas: franjas.sort((a, b) => (a.position.order || 0) - (b.position.order || 0))
      };
      
      // Inicializar votos
      actaStructure.franjas.forEach(franja => {
        votes[franja.position.id!] = {};
        votosEspeciales[franja.position.id!] = { blancos: 0, nulos: 0 };
        
        franja.parties.forEach(party => {
          votes[franja.position.id!][party.politicalOrganization.id!] = 0;
        });
      });
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar estructura del acta');
    }
  }

  async function loadExistingVotes() {
    if (!currentActa) return;
    
    try {
      const existingDetails = await getActaDetailsByActa(currentActa.id!);
      
      existingDetails.forEach(detail => {
        const positionId = detail.electoralPosition?.id;
        const orgId = detail.politicalOrganization?.id;
        
        if (positionId && orgId) {
          if (!votes[positionId]) votes[positionId] = {};
          votes[positionId][orgId] = detail.votes || 0;
        }
      });
      
      votes = { ...votes };
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function saveVotes() {
    if (!currentActa || !actaStructure) return;
    
    // Validar que haya al menos un voto en alguna franja
    let hayVotos = false;
    const errores: string[] = [];
    const advertenciasExceso: string[] = [];
    
    const ciudadanosHabilitados = currentActa.pollingTable.inscribedCount || 0;
    
    for (const franja of actaStructure.franjas) {
      let totalFranja = 0;
      
      // Contar votos de partidos
      for (const party of franja.parties) {
        const voto = votes[franja.position.id!]?.[party.politicalOrganization.id!] || 0;
        totalFranja += voto;
      }
      
      // Contar votos especiales
      const especiales = votosEspeciales[franja.position.id!];
      if (especiales) {
        totalFranja += (especiales.blancos || 0) + (especiales.nulos || 0);
      }
      
      if (totalFranja > 0) {
        hayVotos = true;
      } else {
        errores.push(`${franja.position.name}: 0 votos`);
      }
      
      // Validar que no exceda ciudadanos habilitados
      if (totalFranja > ciudadanosHabilitados) {
        advertenciasExceso.push(
          `${franja.position.name}: ${totalFranja} votos excede a ${ciudadanosHabilitados} inscritos (${totalFranja - ciudadanosHabilitados} votos de más)`
        );
      }
    }
    
    if (!hayVotos) {
      alert('❌ Error: No hay ningún voto registrado en el acta.\n\nPor favor ingrese los votos antes de guardar.');
      return;
    }
    
    // Validación crítica: votos exceden inscritos
    if (advertenciasExceso.length > 0) {
      alert(
        `❌ ERROR CRÍTICO: Los votos exceden a los ciudadanos habilitados\n\n` +
        `Ciudadanos inscritos en esta mesa: ${ciudadanosHabilitados}\n\n` +
        advertenciasExceso.join('\n') +
        `\n\nNo se puede guardar el acta. Verifique los números.`
      );
      return;
    }
    
    // Si hay franjas sin votos, advertir
    if (errores.length > 0) {
      const confirmar = confirm(
        `⚠️ Advertencia: Las siguientes posiciones tienen 0 votos:\n\n${errores.join('\n')}\n\n¿Está seguro que desea continuar?`
      );
      
      if (!confirmar) {
        return;
      }
    }
    
    saving = true;
    
    try {
      const Parse = (await import('$lib/parseClient')).default;
      
      // Guardar votos de partidos
      for (const franja of actaStructure.franjas) {
        for (const party of franja.parties) {
          const voto = votes[franja.position.id!]?.[party.politicalOrganization.id!] || 0;
          
          await createActaDetail({
            actaId: currentActa.id!,
            electoralPositionId: franja.position.id!,
            politicalOrganizationId: party.politicalOrganization.id!,
            votes: voto
          });
        }
      }
      
      // Preparar votos especiales (blancos y nulos) por posición
      const specialVotesData: Record<string, { blancos: number; nulos: number }> = {};
      actaStructure.franjas.forEach(franja => {
        const especiales = votosEspeciales[franja.position.id!];
        if (especiales && (especiales.blancos > 0 || especiales.nulos > 0)) {
          specialVotesData[franja.position.id!] = {
            blancos: especiales.blancos || 0,
            nulos: especiales.nulos || 0
          };
        }
      });
      
      // Actualizar el acta
      const ActaClass = Parse.Object.extend('Acta');
      const actaObj = await new Parse.Query(ActaClass).get(currentActa.id!);
      
      // Guardar votos especiales si hay
      if (Object.keys(specialVotesData).length > 0) {
        actaObj.set('specialVotes', specialVotesData);
      }
      
      // Guardar notas/observaciones si hay
      if (notes.trim()) {
        actaObj.set('notes', notes.trim());
      }
      
      actaObj.set('status', 'CERRADA');
      actaObj.set('transcribedBy', currentUser);
      await actaObj.save();
      
      if (isAdmin) {
        loadStatistics();
      }
      
      alert('✅ Votos guardados exitosamente');
      await loadNextActa();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar votos');
    } finally {
      saving = false;
    }
  }

  // Funciones de zoom y pan
  function resetZoom() {
    imageZoom = 100;
    imagePanX = 0;
    imagePanY = 0;
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

  // Funciones de cálculo
  function getTotalVotosPartidos(positionId: string): number {
    let total = 0;
    if (votes[positionId]) {
      Object.values(votes[positionId]).forEach(v => total += (v || 0));
    }
    return total;
  }

  function getTotalVotosEspeciales(positionId: string): number {
    const especiales = votosEspeciales[positionId] || { blancos: 0, nulos: 0 };
    return (especiales.blancos || 0) + (especiales.nulos || 0);
  }

  function getTotalGeneral(positionId: string): number {
    return getTotalVotosPartidos(positionId) + getTotalVotosEspeciales(positionId);
  }
  
  // Verificar si hay al menos un voto en todo el acta
  function haySuficientesVotos(): boolean {
    if (!actaStructure) return false;
    
    for (const franja of actaStructure.franjas) {
      const total = getTotalGeneral(franja.position.id!);
      if (total > 0) {
        return true;
      }
    }
    return false;
  }
  
  // Obtener lista de franjas sin votos
  function getFranjasSinVotos(): string[] {
    if (!actaStructure) return [];
    
    const sinVotos: string[] = [];
    for (const franja of actaStructure.franjas) {
      const total = getTotalGeneral(franja.position.id!);
      if (total === 0) {
        sinVotos.push(franja.position.name);
      }
    }
    return sinVotos;
  }

  // Obtener lista de franjas donde votos exceden inscritos
  function getFranjasConExceso(): string[] {
    if (!actaStructure || !currentActa) return [];
    
    const ciudadanosHabilitados = currentActa.pollingTable.inscribedCount || 0;
    const excesos: string[] = [];
    
    for (const franja of actaStructure.franjas) {
      const total = getTotalGeneral(franja.position.id!);
      if (total > ciudadanosHabilitados) {
        const diferencia = total - ciudadanosHabilitados;
        excesos.push(`${franja.position.name}: ${total} votos (${diferencia} votos de más)`);
      }
    }
    return excesos;
  }
</script>

<svelte:window on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        ✍️ Transcripción de Actas
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Sistema de cola automática - Captura de votos
      </p>
      {#if userRole}
        <span class="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
          👤 Rol: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </span>
      {/if}
    </div>

    {#if loaded}
      <!-- Estadísticas (solo admin) -->
      {#if isAdmin && statistics}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold dark:text-white flex items-center gap-2">
              <BarChart3 size={24} />
              Cola de Trabajo
            </h2>
            <div class="flex gap-2">
              <button
                on:click={async () => { await loadStatistics(); await loadNextActa(); }}
                class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
                Cargar Nueva Acta
              </button>
              <button
                on:click={loadStatistics}
                class="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Actualizar Stats
              </button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">{statistics.total}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Total</div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
              <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">{statistics.assigned}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Asignadas</div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <div class="text-3xl font-bold text-green-600 dark:text-green-400">{statistics.available}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Disponibles</div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Cargando -->
      {#if loading}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
          <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-orange-600" />
          <p class="text-gray-600 dark:text-gray-400">Cargando siguiente acta...</p>
        </div>
      {:else if currentActa && actaStructure}
        <!-- Acta Actual -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Imagen con Zoom Avanzado -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold dark:text-white">📷 Imagen del Acta</h2>
              <div class="flex items-center gap-2">
                <button
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-50"
                  on:click={zoomOut}
                  disabled={imageZoom <= 50}
                  title="Alejar"
                >
                  <ZoomOut size={20} />
                </button>
                <span class="text-sm dark:text-gray-400 min-w-[60px] text-center font-mono">{imageZoom}%</span>
                <button
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-50"
                  on:click={zoomIn}
                  disabled={imageZoom >= 300}
                  title="Acercar"
                >
                  <ZoomIn size={20} />
                </button>
                <button
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                  on:click={resetZoom}
                  title="Restablecer"
                >
                  <Maximize2 size={20} />
                </button>
                <button
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                  on:click={toggleImage}
                  title={showImage ? 'Ocultar' : 'Mostrar'}
                >
                  <Eye size={20} />
                </button>
              </div>
            </div>

            <!-- Info del Acta -->
            <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800 space-y-2">
              <div class="text-sm"><strong>Mesa:</strong> #{currentActa.pollingTable.number}</div>
              <div class="text-sm"><strong>Código:</strong> {currentActa.pollingTable.actCode}</div>
              <div class="text-sm"><strong>Recinto:</strong> {currentActa.pollingTable.precinct?.name || 'N/A'}</div>
              <div class="text-sm"><strong>Provincia:</strong> {currentActa.pollingTable.precinct?.locality?.municipality?.province?.name || 'N/A'}</div>
              
              <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded border-2 border-orange-400 dark:border-orange-600 mt-3">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">👥</span>
                  <div class="flex-1">
                    <div class="text-xs text-orange-700 dark:text-orange-300 font-semibold">CIUDADANOS HABILITADOS:</div>
                    <div class="text-2xl font-bold text-orange-800 dark:text-orange-200">
                      {currentActa.pollingTable.inscribedCount || 0}
                    </div>
                  </div>
                </div>
                <div class="text-xs text-orange-600 dark:text-orange-400 mt-2">
                  ⚠️ Los votos totales NO pueden exceder este número
                </div>
              </div>
            </div>

            {#if showImage}
              <div 
                class="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-auto bg-gray-100 dark:bg-gray-900 relative select-none"
                style="height: 600px; cursor: {imageZoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default'}"
                on:mousedown={handleMouseDown}
                role="img"
                tabindex="0"
              >
                <div 
                  class="w-full h-full flex items-center justify-center"
                  style="transform: translate({imagePanX}px, {imagePanY}px); transition: {isDragging ? 'none' : 'transform 0.1s ease'}"
                >
                  <img 
                    src={currentActa.imageUrl} 
                    alt="Acta" 
                    style="max-width: {imageZoom}%; max-height: {imageZoom}%; width: auto; height: auto; object-fit: contain;"
                    class="select-none pointer-events-none"
                    draggable="false"
                  />
                </div>
                
                {#if imageZoom > 100}
                  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm z-10 pointer-events-none">
                    💡 Arrastra la imagen para moverla
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Botón Saltar -->
            <button
              class="w-full mt-4 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center justify-center gap-2"
              on:click={skipActa}
            >
              <SkipForward size={20} />
              Saltar esta acta
            </button>
          </div>

          <!-- Formulario de Captura -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 class="text-xl font-bold mb-4 dark:text-white">
              ✍️ Capturar Votos
            </h2>

            <div class="space-y-6 max-h-[700px] overflow-y-auto pr-2">
              {#each actaStructure.franjas as franja, franjaIndex}
                <div class="border-2 border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <h3 class="font-bold text-lg dark:text-white">
                        Franja {franjaIndex + 1}: {franja.position.name}
                      </h3>
                      <p class="text-xs text-gray-600 dark:text-gray-400">
                        {franja.position.scope} • {franja.parties.length} partidos
                      </p>
                    </div>
                  </div>

                  <!-- Votos por Partido -->
                  <div class="space-y-3 mb-4">
                    {#each franja.parties as party}
                      <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div 
                          class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style="background-color: {party.politicalOrganization.color}"
                        >
                          {party.order}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-semibold dark:text-white truncate">
                            {party.politicalOrganization.sigla}
                          </div>
                          <div class="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {party.politicalOrganization.name}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          bind:value={votes[franja.position.id!][party.politicalOrganization.id!]}
                          class="w-24 px-3 py-2 text-center text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:border-orange-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    {/each}
                  </div>

                  <!-- Votos Blancos y Nulos -->
                  <div class="border-t-2 border-gray-200 dark:border-gray-700 pt-4 space-y-3 mb-4">
                    <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 text-white font-bold text-xl flex-shrink-0">
                        ⬜
                      </div>
                      <div class="flex-1">
                        <div class="font-semibold dark:text-white">Votos en Blanco</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">Papeletas sin marcar</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        bind:value={votosEspeciales[franja.position.id!].blancos}
                        class="w-24 px-3 py-2 text-center text-lg font-bold border-2 border-blue-300 dark:border-blue-600 rounded-lg dark:bg-gray-800 dark:text-white focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div class="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white font-bold text-xl flex-shrink-0">
                        ❌
                      </div>
                      <div class="flex-1">
                        <div class="font-semibold dark:text-white">Votos Nulos</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">Papeletas mal marcadas</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        bind:value={votosEspeciales[franja.position.id!].nulos}
                        class="w-24 px-3 py-2 text-center text-lg font-bold border-2 border-red-300 dark:border-red-600 rounded-lg dark:bg-gray-800 dark:text-white focus:border-red-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <!-- Resumen de Totales -->
                  <div class="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                    <div class="grid grid-cols-3 gap-3 text-center">
                      <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Votos Válidos</div>
                        <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                          {getTotalVotosPartidos(franja.position.id!)}
                        </div>
                      </div>
                      <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                        <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Blancos + Nulos</div>
                        <div class="text-2xl font-bold text-gray-600 dark:text-gray-300">
                          {getTotalVotosEspeciales(franja.position.id!)}
                        </div>
                      </div>
                      <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                        <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">TOTAL GENERAL</div>
                        <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {getTotalGeneral(franja.position.id!)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Campo de Observaciones -->
            <div class="mt-6 border-t-2 border-gray-200 dark:border-gray-700 pt-6">
              <label class="block mb-3">
                <div class="flex items-center gap-2 mb-2">
                  <span class="font-semibold dark:text-white">📝 Observaciones (Opcional)</span>
                </div>
                <textarea
                  bind:value={notes}
                  placeholder="Ej: Acta presenta manchas de humedad en la esquina inferior derecha, pero los números son legibles..."
                  rows="3"
                  maxlength="500"
                  class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:border-orange-500 focus:outline-none resize-none"
                ></textarea>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    Anote cualquier irregularidad, daño en el acta, correcciones, etc.
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {notes.length}/500
                  </span>
                </div>
              </label>
            </div>

            <!-- Advertencia si no hay votos -->
            {#if actaStructure && !haySuficientesVotos()}
              <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div class="flex items-start gap-3">
                  <AlertCircle size={20} class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <strong class="text-red-800 dark:text-red-200">⚠ Sin votos registrados</strong>
                    <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                      Debe ingresar al menos un voto antes de guardar
                    </p>
                  </div>
                </div>
              </div>
            {:else if actaStructure && getFranjasSinVotos().length > 0}
              <div class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div class="flex items-start gap-3">
                  <AlertCircle size={20} class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <strong class="text-yellow-800 dark:text-yellow-200">⚠ Posiciones sin votos</strong>
                    <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      {getFranjasSinVotos().join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Advertencia si votos exceden inscritos -->
            {#if actaStructure && currentActa}
              {@const excesos = getFranjasConExceso()}
              {#if excesos.length > 0}
                <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-600 rounded-lg">
                  <div class="flex items-start gap-3">
                    <AlertCircle size={24} class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div class="flex-1">
                      <strong class="text-red-800 dark:text-red-200 text-lg">🚫 ERROR: Votos exceden inscritos</strong>
                      <p class="text-sm text-red-700 dark:text-red-300 mt-2">
                        <strong>Inscritos en esta mesa: {currentActa.pollingTable.inscribedCount || 0}</strong>
                      </p>
                      <ul class="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
                        {#each excesos as exceso}
                          <li class="font-semibold">• {exceso}</li>
                        {/each}
                      </ul>
                      <p class="text-xs text-red-600 dark:text-red-400 mt-2">
                        No se puede guardar hasta corregir los números
                      </p>
                    </div>
                  </div>
                </div>
              {/if}
            {/if}

            <!-- Botón Guardar -->
            <button
              class="w-full mt-6 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              on:click={saveVotes}
              disabled={saving}
            >
              <Save size={20} />
              {saving ? 'Guardando...' : 'Guardar y Continuar →'}
            </button>
          </div>
        </div>
      {:else}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
          <div class="text-6xl mb-4">✅</div>
          <h2 class="text-2xl font-bold mb-2 dark:text-white">¡Excelente trabajo!</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            No hay más actas pendientes de transcripción
          </p>
          <button
            on:click={async () => { if (isAdmin) await loadStatistics(); await loadNextActa(); }}
            class="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold flex items-center justify-center gap-2 mx-auto"
            disabled={loading}
          >
            <RefreshCw size={20} class={loading ? 'animate-spin' : ''} />
            {loading ? 'Buscando...' : 'Buscar Nuevas Actas'}
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