if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(registration => {
    console.log('Service Worker registrado con éxito', registration);
  })
} else {
  console.error("Service worker no disponible")
}

const nuevaOrden = {
  cliente: 'Empresa Logística SA',
  monto: 14500,
  fecha: Date.now()
}

function procesarEnvioReporte(datosFormulario) {
  const ENDPOINT = "https://jsonplaceholder.typicode.com/posts";
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datosFormulario)
  })
  .then(res => {
    if (!res.ok) throw new Error("Error HTTP del servidor");
    return res.json()
  })
  .then(() => {
    guardarRegistro({
      ...datosFormulario,
      estado: 'sincronizado',
      fechaCreacion: Date.now()
    });
  })
  .catch(() => {
    console.warn('[Outbox] Sin conexión. Encolando transacción localmente...');
    // Falla de red: guardar en IndexedDB como pendiente para reenvío posterior
    return guardarRegistro({
      ...datosFormulario,
      estado: 'pendiente',
      fechaCreacion: Date.now()
    });
  })
  .then(() => {
    return renderizarColaOutlook();
  })
}

function sincronizarPendientes(){
  console.log('[Outbox] Conexión detectada. Buscando registros pendientes...');

  return obtenerTodosLosRegistros()
    .then((registros) => {
      const pendientes = registros.filter((item) => item.estado === 'pendiente');

      if (pendientes.length === 0) {
        console.log('[Outbox] No hay transacciones pendientes por sincronizar.');
        return;
      }

      // Convertir cada registro pendiente en una promesa de envío + actualización
      const promesasDeEnvio = pendientes.map((item) => {
        return fetch('https://jsonplaceholder.typicode.com/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.titulo, body: item.descripcion })
        })
          .then((res) => {
            if (!res.ok) throw new Error('Falla al reintentar envío');
            // Actualizar estado en IndexedDB de 'pendiente' a 'sincronizado'
            return actualizarEstadoRegistro(item.id, 'sincronizado');
          });
      });

      // Esperar a que todos los reenvíos concluyan
      return Promise.all(promesasDeEnvio);
    })
    .then(() => {
      return renderizarColaOutbox();
    })
    .catch((error) => {
      console.error('[Outbox] Error durante la sincronización masiva:', error);
    });
}

// Escuchar el regreso de la conectividad
window.addEventListener('online', () => {
  actualizarIndicadorRed();
  sincronizarPendientes();
});

window.addEventListener('offline', actualizarIndicadorRed);

function actualizarIndicadorRed() {
  const badge = document.getElementById('badge-red');
  if (!badge) return;

  const enLinea = navigator.onLine;

  badge.textContent = enLinea ? 'En Línea' : 'Sin Conexión';
  badge.classList.toggle('online', enLinea);
  badge.classList.toggle('offline', !enLinea);
}

actualizarIndicadorRed();
