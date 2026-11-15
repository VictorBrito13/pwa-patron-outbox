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
    return renderizarColaOutbox();
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
renderizarColaOutbox();

const formIncidencia = document.getElementById('form-incidencia');

if (formIncidencia) {
  formIncidencia.addEventListener('submit', (e) => {
    e.preventDefault();

    const titulo = document.getElementById('titulo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();

    procesarEnvioReporte({ titulo, descripcion }).then(() => {
      formIncidencia.reset();
    });
  });
}

const btnPurgar = document.getElementById('btn-purgar');

if (btnPurgar) {
  btnPurgar.addEventListener('click', () => {
    obtenerTodosLosRegistros()
      .then((registros) => {
        const sincronizados = registros.filter((item) => item.estado === 'sincronizado');
        return Promise.all(sincronizados.map((item) => eliminarRegistro(item.id)));
      })
      .then(() => renderizarColaOutbox())
      .catch((error) => {
        console.error('[Outbox] Error al purgar registros sincronizados:', error);
      });
  });
}
  sincronizarPendientes();
});

window.addEventListener('offline', actualizarIndicadorRed);

function renderizarColaOutbox() {
  return obtenerTodosLosRegistros()
    .then((registros) => {
      const lista = document.getElementById('lista-outbox');
      if (!lista) return;

      lista.innerHTML = '';

      registros.forEach((registro) => {
        const item = document.createElement('li');
        item.classList.add('item-outbox', registro.estado);

        const titulo = document.createElement('span');
        titulo.className = 'titulo';
        titulo.textContent = registro.titulo || 'Sin título';

        const estado = document.createElement('span');
        estado.className = `estado ${registro.estado}`;
        estado.textContent = registro.estado === 'pendiente' ? 'Pendiente' : 'Sincronizado';

        const hora = document.createElement('span');
        hora.className = 'hora';
        const fecha = new Date(registro.fechaCreacion);
        hora.textContent = Number.isNaN(fecha.getTime())
          ? '--:--'
          : fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        item.append(titulo, estado, hora);
        lista.appendChild(item);
      });
    })
    .catch((error) => {
      console.error('[Outbox] Error al renderizar la cola:', error);
    });
}

function actualizarIndicadorRed() {
  const badge = document.getElementById('badge-red');
  if (!badge) return;

  const enLinea = navigator.onLine;

  badge.textContent = enLinea ? 'En Línea' : 'Sin Conexión';
  badge.classList.toggle('online', enLinea);
  badge.classList.toggle('offline', !enLinea);
}

actualizarIndicadorRed();
