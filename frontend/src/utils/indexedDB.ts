/**
 * Utilitário para gerenciar IndexedDB para armazenamento seguro de dados locais
 * (anteriormente usado para E2E, mantido para compatibilidade futura)
 */

const DB_NAME = 'SimpatiaDB';
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
 * Salva chave privada e pública no IndexedDB
 */
export const savePrivateKey = async (userId: number, privateKey: CryptoKey, publicKey?: CryptoKey): Promise<void> => {
  const db = await openDB();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  
  // Exportar chave privada para formato armazenável
  const exportedPrivate = await crypto.subtle.exportKey('pkcs8', privateKey);
  const keyData = Array.from(new Uint8Array(exportedPrivate));
  
  // Exportar chave pública se fornecida
  let publicKeyBase64: string | undefined;
  if (publicKey) {
    const exportedPublic = await crypto.subtle.exportKey('spki', publicKey);
    publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)));
  }
  
  return new Promise((resolve, reject) => {
    const request = store.put({ userId, keyData, publicKeyBase64 });
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
 * Recupera chave pública do IndexedDB (se salva)
 */
export const getPublicKey = async (userId: number): Promise<string | null> => {
  try {
    const db = await openDB();
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result || !result.publicKeyBase64) {
          resolve(null);
          return;
        }
        resolve(result.publicKeyBase64);
      };
      
      request.onerror = () => reject(new Error('Falha ao recuperar chave pública'));
    });
  } catch (error) {
    console.error('[IndexedDB] Erro ao recuperar chave pública:', error);
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

