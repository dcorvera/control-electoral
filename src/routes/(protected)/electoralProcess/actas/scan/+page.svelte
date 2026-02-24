<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Camera, Upload, Search, Check, X, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Eye, Maximize2 } from 'lucide-svelte';
  
  import type { Acta } from '$lib/types/types';
  import { updateActa } from '$lib/services/actaService';
  import { getCurrentUser, getCurrentUserRole, hasAnyRole } from '$lib/services/authService';
  import { goto } from '$app/navigation';

  // Estado
  let loaded = false;
  let currentUser: any = null;
  let userRole = '';
  
  // Flujo de trabajo: upload → enter_code → validating → confirm
  let currentStep: 'upload' | 'enter_code' | 'validating' | 'confirm' = 'upload';
  
  // Upload de foto (PASO 1)
  let imageFile: File | null = null;
  let imagePreview: string | null = null;
  
  // Optimización
  let originalSize = 0;
  let optimizedSize = 0;
  let optimizing = false;
  
  // Zoom de la imagen
  let imageZoom = 100;
  let showImage = true;
  let imagePanX = 0;
  let imagePanY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  
  // Ingresar código viendo la foto (PASO 2)
  let searchCode = '';
  let searching = false;
  let foundActa: Acta | null = null;
  let notFound = false;
  
  // OCR validación (PASO 3)
  let ocrProcessing = false;
  let ocrResult: any = null;
  
  // Guardar (PASO 4)
  let uploading = false;

  onMount(async () => {
    if (!browser) return;

    try {
      currentUser = getCurrentUser();
      
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      const hasAccess = await hasAnyRole(['superadmin', 'admin', 'digitalizacion']);
      
      if (!hasAccess) {
        alert('No tienes permisos para acceder a esta sección');
        goto('/dashboard');
        return;
      }
      
      userRole = await getCurrentUserRole();
      loaded = true;
    } catch (error) {
      console.error('Error:', error);
      goto('/login');
    }
  });

  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor seleccione una imagen válida');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen es muy grande. Máximo 10MB');
        return;
      }
      
      imageFile = file;
      
      // Optimizar y mostrar preview
      optimizeAndPreviewImage(file);
    }
  }

  async function optimizeAndPreviewImage(file: File) {
    optimizing = true;
    originalSize = file.size;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Crear canvas para optimizar
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calcular nuevas dimensiones (max 1920px en el lado más grande)
        let width = img.width;
        let height = img.height;
        const maxSize = 1920;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar imagen redimensionada
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convertir a base64 con compresión (calidad 0.85)
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        
        // Calcular tamaño optimizado
        optimizedSize = Math.round((optimizedBase64.length * 3) / 4);
        const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(0);
        
        console.log(`✅ Imagen optimizada: ${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB (-${reduction}%)`);
        
        imagePreview = optimizedBase64;
        optimizing = false;
        currentStep = 'enter_code';
      };
      
      img.onerror = () => {
        alert('Error al procesar la imagen');
        optimizing = false;
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  }

  async function processOCR() {
    if (!imagePreview || !foundActa) return;
    
    ocrProcessing = true;
    ocrResult = null;
    
    try {
      const { createWorker } = await import('tesseract.js');
      
      const worker = await createWorker('spa');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789-'
      });
      
      const { data } = await worker.recognize(imagePreview);
      await worker.terminate();
      
      const textoLimpio = data.text.replace(/\s+/g, '').replace(/-/g, '');
      const codigoEsperado = foundActa.pollingTable.actCode?.toString() || '';
      
      // Buscar si el código esperado está completo en el texto
      const coincidenciaExacta = textoLimpio.includes(codigoEsperado);
      
      if (coincidenciaExacta) {
        // ✅ Código encontrado exactamente
        ocrResult = {
          codigoDetectado: codigoEsperado,
          codigoEsperado,
          similitud: 100,
          coincide: true,
          verificado: true,
          mensaje: `✓ Código ${codigoEsperado} verificado en la imagen`
        };
      } else {
        // ⚠ Código NO encontrado - pero permitir continuar
        ocrResult = {
          codigoDetectado: null,
          codigoEsperado,
          similitud: 0,
          coincide: false,
          verificado: false,
          mensaje: `⚠ No se pudo verificar el código ${codigoEsperado} automáticamente`,
          advertencia: 'Por favor verifica manualmente que la foto corresponda al código de mesa antes de guardar.'
        };
      }
      
      currentStep = 'confirm';
      
    } catch (error) {
      console.error('Error en OCR:', error);
      // Si OCR falla, permitir continuar de todas formas
      ocrResult = {
        codigoDetectado: null,
        codigoEsperado: foundActa?.pollingTable.actCode?.toString() || '',
        similitud: 0,
        coincide: false,
        verificado: false,
        mensaje: '⚠ No se pudo ejecutar la verificación OCR',
        advertencia: 'Verifica manualmente que la foto sea correcta.'
      };
      currentStep = 'confirm';
    } finally {
      ocrProcessing = false;
    }
  }

  async function searchActa() {
    if (!searchCode.trim()) {
      alert('Ingrese un código de mesa');
      return;
    }

    searching = true;
    notFound = false;
    foundActa = null;
    currentStep = 'validating';

    try {
      const Parse = (await import('$lib/parseClient')).default;
      const ActaClass = Parse.Object.extend('Acta');
      
      let query = new Parse.Query(ActaClass);
      query.equalTo('code', searchCode.trim());
      query.include([
        'pollingTable',
        'pollingTable.precinct',
        'pollingTable.precinct.locality',
        'pollingTable.precinct.locality.municipality',
        'pollingTable.precinct.locality.municipality.province',
        'electoralProcess'
      ]);
      
      let result = await query.first();
      
      if (!result) {
        const PollingTableClass = Parse.Object.extend('PollingTable');
        const tableQuery = new Parse.Query(PollingTableClass);
        tableQuery.equalTo('actCode', parseInt(searchCode.trim()));
        
        const table = await tableQuery.first();
        
        if (table) {
          const actaQuery = new Parse.Query(ActaClass);
          actaQuery.equalTo('pollingTable', table);
          actaQuery.include([
            'pollingTable',
            'pollingTable.precinct',
            'pollingTable.precinct.locality',
            'pollingTable.precinct.locality.municipality',
            'pollingTable.precinct.locality.municipality.province',
            'electoralProcess'
          ]);
          
          result = await actaQuery.first();
        }
      }
      
      if (result) {
        const pollingTableObj = result.get('pollingTable');
        const precinctObj = pollingTableObj?.get('precinct');
        const localityObj = precinctObj?.get('locality');
        const municipalityObj = localityObj?.get('municipality');
        const provinceObj = municipalityObj?.get('province');
        
        foundActa = {
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
        
        if (foundActa.status !== 'BORRADOR') {
          alert(`Esta acta ya tiene foto (estado: ${foundActa.status})`);
          foundActa = null;
          notFound = true;
          currentStep = 'enter_code';
          return;
        }
        
        // Ahora SÍ validar con OCR
        await processOCR();
        
      } else {
        notFound = true;
        currentStep = 'enter_code';
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al buscar acta');
      currentStep = 'enter_code';
    } finally {
      searching = false;
    }
  }

  function calcularSimilitud(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (!str1 || !str2) return 0;
    
    let coincidencias = 0;
    const minLength = Math.min(str1.length, str2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        coincidencias++;
      }
    }
    
    return (coincidencias / Math.max(str1.length, str2.length)) * 100;
  }

  async function uploadPhoto() {
    if (!foundActa || !imagePreview) return;

    uploading = true;

    try {
      // Usar la imagen ya optimizada (imagePreview)
      await updateActa(foundActa.id!, {
        imageUrl: imagePreview,
        status: 'CON_FOTO'
      });
      
      alert('✅ Foto cargada exitosamente');
      reset();
      uploading = false;
    } catch (error) {
      console.error('Error:', error);
      alert('Error al subir la foto');
      uploading = false;
    }
  }

  function captureFromCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => handleImageSelect(e);
    input.click();
  }

  function reset() {
    currentStep = 'upload';
    searchCode = '';
    foundActa = null;
    imageFile = null;
    imagePreview = null;
    notFound = false;
    ocrResult = null;
    imageZoom = 100;
    imagePanX = 0;
    imagePanY = 0;
  }

  function changePhoto() {
    imageFile = null;
    imagePreview = null;
    ocrResult = null;
    foundActa = null;
    notFound = false;
    currentStep = 'upload';
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
      // Resetear pan al hacer zoom out
      if (imageZoom <= 100) {
        imagePanX = 0;
        imagePanY = 0;
      }
    }
  }

  function resetZoom() {
    imageZoom = 100;
    imagePanX = 0;
    imagePanY = 0;
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
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        📸 Digitalización de Actas
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Subir fotografías de actas electorales
      </p>
      {#if userRole}
        <span class="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
          👤 Rol: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </span>
      {/if}
    </div>

    {#if loaded}
      
      <!-- PASO 1: Subir Foto -->
      {#if currentStep === 'upload'}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4 dark:text-white">
            1️⃣ Subir Fotografía del Acta
          </h2>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              💡 El sistema detectará automáticamente el código de mesa de la foto
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              class="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition flex flex-col items-center gap-3"
              on:click={captureFromCamera}
            >
              <Camera size={48} class="text-gray-600 dark:text-gray-400" />
              <div class="text-center">
                <div class="font-semibold dark:text-white text-lg">Tomar Foto</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Usar cámara del dispositivo</div>
              </div>
            </button>

            <label class="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition flex flex-col items-center gap-3 cursor-pointer">
              <Upload size={48} class="text-gray-600 dark:text-gray-400" />
              <div class="text-center">
                <div class="font-semibold dark:text-white text-lg">Subir Archivo</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Desde galería o archivos</div>
              </div>
              <input
                type="file"
                accept="image/*"
                on:change={handleImageSelect}
                class="hidden"
              />
            </label>
          </div>
        </div>
      {/if}

      <!-- PASO 1.5: Optimizando imagen -->
      {#if optimizing}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4 dark:text-white">
            🔄 Optimizando Imagen...
          </h2>

          <div class="flex items-center justify-center gap-3 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <RefreshCw size={24} class="animate-spin text-blue-600" />
            <div>
              <div class="text-blue-800 dark:text-blue-200 font-semibold">
                Procesando y comprimiendo imagen
              </div>
              <div class="text-sm text-blue-600 dark:text-blue-300">
                Tamaño original: {(originalSize / 1024).toFixed(0)} KB
              </div>
              <div class="text-xs text-blue-500 dark:text-blue-400 mt-1">
                Esto mejora la velocidad de carga y ahorra espacio
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- PASO 2: Ingresar Código (viendo la foto) -->
      {#if currentStep === 'enter_code' && !optimizing}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4 dark:text-white">
            2️⃣ Ingresar Código de Mesa
          </h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Vista previa con zoom -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold dark:text-white">Vista Previa:</h3>
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

              {#if showImage && imagePreview}
                <div 
                  class="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 relative select-none" 
                  style="height: 500px; cursor: {imageZoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default'}"
                  on:mousedown={handleMouseDown}
                  role="img"
                  tabindex="0"
                >
                  <div 
                    class="w-full h-full flex items-center justify-center"
                    style="transform: translate({imagePanX}px, {imagePanY}px); transition: {isDragging ? 'none' : 'transform 0.1s ease'}"
                  >
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
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
                
                <!-- Indicador de optimización -->
                {#if originalSize > 0 && optimizedSize > 0}
                  <div class="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs">
                    <div class="flex items-center gap-2">
                      <Check size={14} class="text-green-600 dark:text-green-400" />
                      <span class="text-green-700 dark:text-green-300">
                        Imagen optimizada: 
                        <strong>{(originalSize / 1024).toFixed(0)} KB</strong>
                        →
                        <strong>{(optimizedSize / 1024).toFixed(0)} KB</strong>
                        ({((1 - optimizedSize / originalSize) * 100).toFixed(0)}% reducción)
                      </span>
                    </div>
                  </div>
                {/if}
              {/if}

              <button
                class="w-full mt-3 px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 transition text-sm"
                on:click={changePhoto}
              >
                🔄 Cambiar Foto
              </button>
            </div>

            <!-- Formulario de código -->
            <div>
              <h3 class="font-semibold mb-3 dark:text-white">Código de Mesa:</h3>
              
              <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p class="text-sm text-blue-800 dark:text-blue-200">
                  💡 Usa el zoom para ver mejor la foto y escribe el código de mesa que aparece en el acta
                </p>
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-2 dark:text-white">
                  Código de Mesa:
                </label>
                <input
                  type="text"
                  placeholder="Ej: 6005891"
                  bind:value={searchCode}
                  on:keypress={(e) => e.key === 'Enter' && searchActa()}
                  class="w-full px-4 py-3 rounded-lg border-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg font-mono"
                  autofocus
                />
              </div>

              {#if notFound}
                <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                  <X size={20} class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div class="text-red-800 dark:text-red-200 text-sm">
                    <strong>No encontrado:</strong> No existe acta con el código "{searchCode}" o ya tiene foto
                  </div>
                </div>
              {/if}

              <button
                class="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                on:click={searchActa}
                disabled={searching || !searchCode.trim()}
              >
                <Search size={20} />
                {searching ? 'Buscando...' : 'Buscar Acta'}
              </button>

              <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 class="text-sm font-semibold mb-2 dark:text-white">💡 Consejos:</h4>
                <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Haz zoom para ver mejor los números</li>
                  <li>• El código suele estar en la parte superior del acta</li>
                  <li>• Verifica que todos los dígitos sean correctos</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- PASO 3: Validando con OCR -->
      {#if currentStep === 'validating'}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4 dark:text-white">
            3️⃣ Validando Código...
          </h2>

          {#if imagePreview}
            <div class="mb-4 border rounded-lg overflow-hidden max-h-96">
              <img src={imagePreview} alt="Preview" class="max-w-full h-auto mx-auto" />
            </div>
          {/if}

          <div class="flex items-center justify-center gap-3 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <RefreshCw size={24} class="animate-spin text-blue-600" />
            <div>
              <div class="text-blue-800 dark:text-blue-200 font-semibold">
                Verificando que el código esté en la imagen...
              </div>
              <div class="text-sm text-blue-600 dark:text-blue-300">
                Buscando: <code class="font-mono font-bold">{searchCode}</code>
              </div>
              <div class="text-xs text-blue-500 dark:text-blue-400 mt-1">
                (Esto es opcional - podrás continuar aunque no se verifique)
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- PASO 4: Confirmar y Guardar -->
      {#if currentStep === 'confirm' && foundActa}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4 dark:text-white">
            3️⃣ Confirmar y Guardar
          </h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Vista previa de la foto -->
            <div>
              <h3 class="font-semibold mb-3 dark:text-white">Foto del Acta:</h3>
              {#if imagePreview}
                <div class="border rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" class="max-w-full h-auto" />
                </div>
              {/if}
            </div>

            <!-- Información del acta encontrada -->
            <div>
              <h3 class="font-semibold mb-3 dark:text-white">Acta Encontrada:</h3>
              
              <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
                <div class="flex items-start gap-3 mb-3">
                  <Check size={20} class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <strong class="text-green-800 dark:text-green-200">✅ Acta Verificada</strong>
                  </div>
                </div>
                <div class="space-y-2 text-sm">
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Mesa:</span>
                    <strong class="ml-2 dark:text-white">#{foundActa.pollingTable.number}</strong>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Código:</span>
                    <code class="ml-2 font-mono dark:text-white">{foundActa.pollingTable.actCode}</code>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Recinto:</span>
                    <strong class="ml-2 dark:text-white">{foundActa.pollingTable.precinct?.name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Provincia:</span>
                    <strong class="ml-2 dark:text-white">{foundActa.pollingTable.precinct?.locality?.municipality?.province?.name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Inscritos:</span>
                    <strong class="ml-2 dark:text-white">{foundActa.pollingTable.inscribedCount || 0}</strong>
                  </div>
                </div>
              </div>

              <!-- Resultado del OCR -->
              {#if ocrResult}
                <div class="p-4 border rounded-lg mb-4 {
                  ocrResult.verificado
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }">
                  {#if ocrResult.verificado}
                    <!-- Verificación exitosa -->
                    <div class="flex items-start gap-3">
                      <Check size={24} class="text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                      <div class="flex-1">
                        <h4 class="font-semibold text-green-800 dark:text-green-200 mb-1">
                          Código Verificado
                        </h4>
                        <p class="text-sm text-green-700 dark:text-green-300">
                          El código <code class="font-mono font-bold">{ocrResult.codigoEsperado}</code> fue encontrado en la imagen.
                        </p>
                      </div>
                    </div>
                  {:else}
                    <!-- Verificación fallida - advertencia -->
                    <div class="flex items-start gap-3">
                      <AlertCircle size={24} class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                      <div class="flex-1">
                        <h4 class="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                          Verificación Manual Requerida
                        </h4>
                        <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                          No se pudo verificar automáticamente el código <code class="font-mono font-bold">{ocrResult.codigoEsperado}</code> en la imagen.
                        </p>
                        <div class="p-3 bg-white dark:bg-gray-800 rounded border-l-4 border-yellow-500">
                          <p class="text-xs text-gray-700 dark:text-gray-300">
                            <strong>⚠ Importante:</strong> Antes de continuar, verifica visualmente que:
                          </p>
                          <ul class="text-xs text-gray-600 dark:text-gray-400 mt-2 ml-4 space-y-1">
                            <li>• La foto corresponde a la mesa <strong>{ocrResult.codigoEsperado}</strong></li>
                            <li>• El código de mesa es visible en la foto</li>
                            <li>• La foto es clara y legible</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Botones de acción -->
              <div class="space-y-3">
                <button
                  class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  on:click={uploadPhoto}
                  disabled={uploading}
                >
                  {#if uploading}
                    <RefreshCw size={20} class="animate-spin" />
                    Guardando...
                  {:else}
                    <Check size={20} />
                    ✓ Confirmar y Guardar
                  {/if}
                </button>
                <button
                  class="w-full px-4 py-3 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={changePhoto}
                  disabled={uploading}
                >
                  🔄 Cambiar Foto
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