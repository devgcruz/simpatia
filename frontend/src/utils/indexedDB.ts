/**
 * Utilitário para gerenciar IndexedDB para armazenamento seguro de chaves privadas
 */

const DB_NAME = 'SimpatiaE2E';
const DB_VERSION = 1;
const STORE_NAME = 'privateKeys';

interface DBInstance {
  db: IDBDatabase | null;
}

let dbInstance: DBInstance = { db: null };

/**
 * Abre conexão com IndexedDB
 */
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance.db) {
      resolve(dbInstance.db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Falha ao abrir IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance.db = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
  });
};

/**
 * Salva chave privada no IndexedDB
 */
export const savePrivateKey = async (userId: number, privateKey: CryptoKey): Promise<void> => {
  const db = await openDB();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  
  // Exportar chave para formato armazenável
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const keyData = Array.from(new Uint8Array(exported));
  
  return new Promise((resolve, reject) => {
    const request = store.put({ userId, keyData });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Falha ao salvar chave privada'));
  });
};

/**
 * Recupera chave privada do IndexedDB
 */
export const getPrivateKey = async (userId: number): Promise<CryptoKey | null> => {
  try {
    const db = await openDB();
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result || !result.keyData) {
          resolve(null);
          return;
        }
        
        // Importar chave do formato armazenado
        const keyData = new Uint8Array(result.keyData);
        crypto.subtle
          .importKey(
            'pkcs8',
            keyData,
            {
              name: 'ECDH',
              namedCurve: 'P-256',
            },
            true,
            ['deriveKey', 'deriveBits']
          )
          .then(resolve)
          .catch(reject);
      };
      
      request.onerror = () => reject(new Error('Falha ao recuperar chave privada'));
    });
  } catch (error) {
    console.error('[IndexedDB] Erro ao recuperar chave privada:', error);
    return null;
  }
};

/**
 * Remove chave privada do IndexedDB
 */
export const deletePrivateKey = async (userId: number): Promise<void> => {
  const db = await openDB();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(userId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Falha ao deletar chave privada'));
  });
};

