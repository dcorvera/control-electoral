<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { FileText, Eye, AlertCircle, CheckCircle } from 'lucide-svelte';

  import type { ElectoralProcess, Departament, Province, Municipality } from '$lib/types/types';

  import { getElectoralProcessActive } from '$lib/services/electoralProcessService';
  import { getDepartments } from '$lib/services/departamentService';
  import { getProvincesByDepartment } from '$lib/services/provinceService';
  import { getMunicipalitiesByProvince } from '$lib/services/municipalityService';
  import { 
    previewActaGeneration, 
    generateActasForProcess,
    getActaStructure,
    regenerateActas,
    checkActasWithVotes
  } from '$lib/services/actaGenerationService';

  let loaded = false;
  let selectedProcess: ElectoralProcess | null = null;
  let selectedDepartment: Departament | null = null;
  let selectedProvince: Province | null = null;
  let selectedMunicipality: Municipality | null = null;

  let allProcesses: ElectoralProcess[] = [];
  let allDepartments: Departament[] = [];
  let availableProvinces: Province[] = [];
  let availableMunicipalities: Municipality[] = [];

  let preview: any = null;
  let isGenerating = false;
  let showPreview = false;
  let generationResult: any = null;
  let selectedTab: 'created' | 'skipped' | 'exists' | 'error' = 'created';
  let actasStatus: any = null;
  let showRegenerateWarning = false;

  onMount(async () => {
    if (!browser) return;

    try {
      allProcesses = await getElectoralProcessActive();
      allDepartments = await getDepartments();
      loaded = true;
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    }
  });

  async function onDepartmentChange() {
    if (selectedDepartment) {
      availableProvinces = await getProvincesByDepartment(selectedDepartment.id!);
    } else {
      availableProvinces = [];
    }
    selectedProvince = null;
    selectedMunicipality = null;
    availableMunicipalities = [];
    preview = null;
  }

  async function onProvinceChange() {
    if (selectedProvince) {
      availableMunicipalities = await getMunicipalitiesByProvince(selectedProvince.id!);
    } else {
      availableMunicipalities = [];
    }
    selectedMunicipality = null;
    preview = null;
  }

  async function loadPreview() {
    if (!selectedProcess) return;

    try {
      preview = await previewActaGeneration(
        selectedProcess.id!,
        selectedDepartment?.id,
        selectedProvince?.id,
        selectedMunicipality?.id
      );
      
      // Verificar estado de actas existentes
      actasStatus = await checkActasWithVotes(selectedProcess.id!);
      
      showPreview = true;
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar vista previa');
    }
  }

  async function regenerate() {
    if (!selectedProcess || !actasStatus) return;

    // Verificar si es seguro regenerar
    if (!actasStatus.safeToRegenerate) {
      const confirm = window.confirm(
        `⚠️ ADVERTENCIA: Hay ${actasStatus.withVotes} actas con votos registrados que NO se eliminarán.\n\n` +
        `Se eliminarán SOLO las ${actasStatus.byStatus.BORRADOR} actas en estado BORRADOR.\n\n` +
        `¿Desea continuar?`
      );
      
      if (!confirm) return;
    } else {
      const confirm = window.confirm(
        `¿Confirma la regeneración de actas?\n\n` +
        `Se eliminarán ${actasStatus.byStatus.BORRADOR} actas en BORRADOR y se crearán nuevas actas con la configuración actual.`
      );
      
      if (!confirm) return;
    }

    isGenerating = true;

    try {
      generationResult = await regenerateActas(
        selectedProcess.id!,
        selectedDepartment?.id,
        selectedProvince?.id,
        selectedMunicipality?.id
      );

      alert(generationResult.message);
      
      // Recargar estado
      await loadPreview();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al regenerar actas');
    } finally {
      isGenerating = false;
    }
  }

  async function generateActas() {
    if (!selectedProcess) return;

    const confirm = window.confirm(
      `¿Confirma la generación de ${preview?.totalActas || 0} actas?\n\n` +
      `Esto creará actas para todas las mesas con las franjas (cargos) correspondientes según el alcance geográfico seleccionado.`
    );

    if (!confirm) return;

    isGenerating = true;

    try {
      generationResult = await generateActasForProcess(
        selectedProcess.id!,
        selectedDepartment?.id,
        selectedProvince?.id,
        selectedMunicipality?.id
      );

      alert(
        `✅ Generación completada:\n\n` +
        `✓ ${generationResult.created} actas creadas\n` +
        `${generationResult.errors > 0 ? `⚠ ${generationResult.errors} errores` : ''}`
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar actas');
    } finally {
      isGenerating = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Generación de Actas Electorales
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Configure los parámetros y genere actas con franjas para todas las mesas
      </p>
    </div>

    {#if loaded}
      <!-- Formulario de Configuración -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <h2 class="text-xl font-bold mb-4 dark:text-white">Parámetros de Generación</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Proceso Electoral -->
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-2 dark:text-white">
              Proceso Electoral *
            </label>
            <select
              bind:value={selectedProcess}
              on:change={() => preview = null}
              class="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value={null}>Seleccione un proceso</option>
              {#each allProcesses as process}
                <option value={process}>{process.name} - {process.year}</option>
              {/each}
            </select>
          </div>

          <!-- Alcance Geográfico -->
          <div class="md:col-span-2">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div class="flex items-start gap-3">
                <AlertCircle size={20} class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div class="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Alcance Geográfico:</strong> Seleccione el alcance para generar actas. 
                  Las franjas (cargos) se incluirán automáticamente según su alcance configurado.
                </div>
              </div>
            </div>
          </div>

          <!-- Departamento -->
          <div>
            <label class="block text-sm font-medium mb-2 dark:text-white">
              Departamento (opcional)
            </label>
            <select
              bind:value={selectedDepartment}
              on:change={onDepartmentChange}
              class="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value={null}>Nacional / Todos</option>
              {#each allDepartments as dept}
                <option value={dept}>{dept.name}</option>
              {/each}
            </select>
          </div>

          <!-- Provincia -->
          <div>
            <label class="block text-sm font-medium mb-2 dark:text-white">
              Provincia (opcional)
            </label>
            <select
              bind:value={selectedProvince}
              on:change={onProvinceChange}
              disabled={!selectedDepartment}
              class="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
            >
              <option value={null}>Todas</option>
              {#each availableProvinces as prov}
                <option value={prov}>{prov.name}</option>
              {/each}
            </select>
          </div>

          <!-- Municipio -->
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-2 dark:text-white">
              Municipio (opcional)
            </label>
            <select
              bind:value={selectedMunicipality}
              on:change={() => preview = null}
              disabled={!selectedProvince}
              class="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
            >
              <option value={null}>Todos</option>
              {#each availableMunicipalities as mun}
                <option value={mun}>{mun.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="mt-6 flex gap-3">
          <button
            class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            on:click={loadPreview}
            disabled={!selectedProcess}
          >
            <Eye size={20} />
            Ver Vista Previa
          </button>
        </div>
      </div>

      <!-- Vista Previa -->
      {#if showPreview && preview}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h2 class="text-xl font-bold mb-4 dark:text-white">Vista Previa de Generación</h2>

          <!-- Advertencias -->
          {#if preview.warnings && preview.warnings.length > 0}
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div class="flex items-start gap-3 mb-3">
                <AlertCircle size={20} class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 class="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Advertencias de Configuración
                  </h3>
                  <ul class="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    {#each preview.warnings as warning}
                      <li>{warning}</li>
                    {/each}
                  </ul>
                </div>
              </div>
              <p class="text-xs text-yellow-600 dark:text-yellow-400 italic">
                Estas advertencias no impiden la generación, pero indican que algunas mesas no tendrán todas las franjas.
              </p>
            </div>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <!-- Estadísticas -->
            <div class="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center">
                  <FileText size={32} class="text-white" />
                </div>
                <div>
                  <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {preview.totalActas}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    Actas a generar
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} class="text-white" />
                </div>
                <div>
                  <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {preview.totalMesas}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    Total de mesas
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {preview.porcentajeCobertura}%
                </div>
                <div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    Cobertura
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-500">
                    {preview.mesasOmitidas} omitidas
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Detalle de Franjas -->
          <div class="mb-6">
            <h3 class="font-semibold mb-3 dark:text-white">Franjas (Cargos) por Acta:</h3>
            <div class="space-y-2">
              {#each preview.franjasSummary as franja}
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div class="font-medium dark:text-white">{franja.cargo}</div>
                    <span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      {franja.partidos} partidos
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {franja.actas} actas
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Alcance Seleccionado -->
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
            <h3 class="font-semibold mb-2 dark:text-white">Alcance Seleccionado:</h3>
            <div class="text-sm dark:text-gray-300">
              <div><strong>Proceso:</strong> {selectedProcess?.name}</div>
              {#if selectedDepartment}
                <div><strong>Departamento:</strong> {selectedDepartment.name}</div>
              {/if}
              {#if selectedProvince}
                <div><strong>Provincia:</strong> {selectedProvince.name}</div>
              {/if}
              {#if selectedMunicipality}
                <div><strong>Municipio:</strong> {selectedMunicipality.name}</div>
              {/if}
              {#if !selectedDepartment}
                <div class="text-gray-600 dark:text-gray-400 italic">Nacional / Todas las ubicaciones</div>
              {/if}
            </div>
          </div>

          <!-- Estado de Actas Existentes -->
          {#if actasStatus && actasStatus.total > 0}
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 mb-6">
              <h3 class="font-semibold mb-2 dark:text-white flex items-center gap-2">
                <AlertCircle size={18} />
                Actas Existentes
              </h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Borrador</div>
                  <div class="font-bold text-lg dark:text-white">{actasStatus.byStatus.BORRADOR}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Con Foto</div>
                  <div class="font-bold text-lg dark:text-white">{actasStatus.byStatus.CON_FOTO || 0}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Cerradas</div>
                  <div class="font-bold text-lg dark:text-white">{actasStatus.byStatus.CERRADA || 0}</div>
                </div>
                <div>
                  <div class="text-gray-600 dark:text-gray-400">Validadas</div>
                  <div class="font-bold text-lg dark:text-white">{actasStatus.byStatus.VALIDADA || 0}</div>
                </div>
              </div>
              
              {#if actasStatus.safeToRegenerate}
                <p class="text-xs text-green-600 dark:text-green-400 mt-3">
                  ✓ Seguro regenerar: Todas las actas están en BORRADOR
                </p>
              {:else}
                <p class="text-xs text-orange-600 dark:text-orange-400 mt-3">
                  ⚠️ Hay {actasStatus.withVotes} actas con votos que NO se eliminarán al regenerar
                </p>
              {/if}
            </div>
          {/if}

          <!-- Botones de Acción -->
          <div class="flex gap-3">
            {#if actasStatus && actasStatus.total > 0}
              <button
                class="flex-1 px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3"
                on:click={regenerate}
                disabled={isGenerating}
              >
                <FileText size={24} />
                {isGenerating ? 'Regenerando...' : `Regenerar Actas (${actasStatus.byStatus.BORRADOR} en borrador)`}
              </button>
            {:else}
              <button
                class="flex-1 px-6 py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3"
                on:click={generateActas}
                disabled={isGenerating || preview.totalActas === 0}
              >
                <FileText size={24} />
                {isGenerating ? 'Generando Actas...' : `Generar ${preview.totalActas} Actas`}
              </button>
            {/if}
          </div>

          <!-- Info sobre Regeneración -->
          {#if actasStatus && actasStatus.total > 0}
            <div class="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm dark:text-gray-300">
              <strong>ℹ️ Sobre la regeneración:</strong>
              <ul class="mt-2 space-y-1 ml-4 list-disc">
                <li>Solo se eliminan actas en estado <strong>BORRADOR</strong></li>
                <li>Actas con foto, cerradas o validadas <strong>NO se tocan</strong></li>
                <li>Útil cuando agregas más partidos y quieres actualizar las actas</li>
              </ul>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Resultado de Generación -->
      {#if generationResult}
        <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div class="flex items-start gap-3 mb-4">
            <CheckCircle size={24} class="text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <h3 class="font-bold text-green-800 dark:text-green-200 mb-2">
                ✅ Proceso de Generación Completado
              </h3>
              <div class="text-sm text-green-700 dark:text-green-300 space-y-1 mb-4">
                <p>✓ <strong>{generationResult.created}</strong> actas creadas exitosamente</p>
                {#if generationResult.skipped > 0}
                  <p>⏭️ <strong>{generationResult.skipped}</strong> mesas omitidas (sin partidos asignados)</p>
                {/if}
                {#if generationResult.errors > 0}
                  <p class="text-red-600">❌ <strong>{generationResult.errors}</strong> errores</p>
                {/if}
              </div>
            </div>
          </div>

          <!-- Tabs para ver diferentes estados -->
          <div class="mb-4">
            <div class="flex gap-2 border-b dark:border-gray-700">
              <button
                class="px-4 py-2 text-sm font-medium border-b-2 {selectedTab === 'created' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-600 dark:text-gray-400'}"
                on:click={() => selectedTab = 'created'}
              >
                Creadas ({generationResult.details.filter((d:any) => d.status === 'created').length})
              </button>
              {#if generationResult.skipped > 0}
                <button
                  class="px-4 py-2 text-sm font-medium border-b-2 {selectedTab === 'skipped' ? 'border-yellow-600 text-yellow-600' : 'border-transparent text-gray-600 dark:text-gray-400'}"
                  on:click={() => selectedTab = 'skipped'}
                >
                  Omitidas ({generationResult.skipped})
                </button>
              {/if}
              {#if generationResult.details.filter((d:any) => d.status === 'exists').length > 0}
                <button
                  class="px-4 py-2 text-sm font-medium border-b-2 {selectedTab === 'exists' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 dark:text-gray-400'}"
                  on:click={() => selectedTab = 'exists'}
                >
                  Ya existían ({generationResult.details.filter((d:any) => d.status === 'exists').length})
                </button>
              {/if}
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div class="space-y-1 text-sm">
              {#each generationResult.details.filter((d:any) => d.status === selectedTab) as detail}
                <div class="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                  <div class="flex items-center gap-3">
                    <span class="dark:text-gray-300">Mesa #{detail.mesa}</span>
                    {#if detail.reason}
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic">
                        {detail.reason}
                      </span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-3">
                    {#if detail.franjas > 0}
                      <span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        {detail.franjas} {detail.franjas === 1 ? 'franja' : 'franjas'}
                      </span>
                    {/if}
                    <code class="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                      {detail.code}
                    </code>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="mt-4">
            <a
              href="/actas/votacion"
              class="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              Ir a Proceso de Votación →
            </a>
          </div>
        </div>
      {/if}

      <!-- Información Adicional -->
      <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
        <h3 class="font-bold mb-3 dark:text-white">ℹ️ Cómo funciona la generación de actas</h3>
        <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li class="flex items-start gap-2">
            <span class="text-orange-600 dark:text-orange-400">1.</span>
            <span>Se crea <strong>una acta por mesa</strong> con un código único</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-600 dark:text-orange-400">2.</span>
            <span>Cada acta contiene múltiples <strong>franjas</strong> (secciones para cada cargo electoral)</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-600 dark:text-orange-400">3.</span>
            <span>Las franjas se incluyen automáticamente según el <strong>alcance del cargo</strong>:
              <ul class="ml-4 mt-1 space-y-1">
                <li>• Cargos <strong>departamentales</strong> → Solo si coincide el departamento</li>
                <li>• Cargos <strong>provinciales</strong> → Solo si coincide la provincia</li>
                <li>• Cargos <strong>municipales</strong> → Solo si coincide el municipio</li>
              </ul>
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-600 dark:text-orange-400">4.</span>
            <span>En cada franja aparecen los <strong>partidos asignados</strong> para ese cargo en orden</span>
          </li>
        </ul>

        <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Ejemplo:</strong> Un acta en Tarija puede tener 2 franjas:
            <br>• Franja 1: Gobernador (alcance departamental) → UNIR, PDC, UCS
            <br>• Franja 2: Asambleísta por Territorio (alcance provincial) → UNIR, PDC
          </p>
        </div>
      </div>
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    {/if}
  </div>
</div>