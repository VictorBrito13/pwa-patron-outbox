const DB_NAME = "pwa-outbox-db";
const DB_VERSION = 1;
const STORE_NAME = "transacciones_pendientes";

// Abrir una nueva conexion con la base de datos
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(
          STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        }
        );
      }

      if (!db.objectStoreNames.contains("logs_errores")) { 
        db.createObjectStore(
          "logs_errores",
          {
            keyPath: 'id',
            autoIncrement: true
          }
        )
      }
      
    };

    request.onsuccess = event => resolve(event.target.result)
    request.onerror = event => reject(event.target.error)
  });
}

// Escritura
function guardarRegistro(datos) {
  // Abrir conexion con la base de datos
  return abrirDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const req = store.add(datos);
        let idGenerico;

        // Aun la transaccion no se completa
        req.onsuccess = event => idGenerico = event.target.result;

        // Indicara cuando la transaccion se haya completado
        tx.oncomplete = () => resolve(idGenerico);
        tx.onerror = event => reject(event.target.error);
      });
    })
}

function obtenerTodosLosRegistros() {
  return abrirDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = event => resolve(event.target.result);
        req.onerror = event => reject(event.target.error);
      });
    });
}

function eliminarRegistro(id) {
  return abrirDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);

        tx.oncomplete = event => resolve(event.target.result);
        tx.onerror = event => reject(event.target.error);
      });
    });
}

function actualizarEstadoRegistro(id, nuevoEstado) {
  return abrirDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // 1. Obtener el registro actual
        const reqGet = store.get(id);

        reqGet.onsuccess = event => {
          const registro = event.target.result;

          if (!registro) {
            reject(new Error(`No se encontro ninun registro con el id: ${id}`))
          }

          // 2. Modificar la propiedad y sobreescribir con .put
          registro.estado = nuevoEstado;
          registro.fechaSincronizacion = Date.now();
          store.put(registro);
        }

        tx.oncomplete = event => resolve(event.target.result);
        tx.onerror = event => reject(event.target.error);
      });
    });
}