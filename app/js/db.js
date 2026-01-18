(function () {
  const DB_NAME = 'my_sales_book';
  const DB_VERSION = 1;

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sales')) {
          const sales = db.createObjectStore('sales', { keyPath: 'id' });
          sales.createIndex('byTs', 'ts', { unique: false });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const expenses = db.createObjectStore('expenses', { keyPath: 'id' });
          expenses.createIndex('byTs', 'ts', { unique: false });
        }
        if (!db.objectStoreNames.contains('debts')) {
          const debts = db.createObjectStore('debts', { keyPath: 'id' });
          debts.createIndex('byStatus', 'status', { unique: false });
          debts.createIndex('byDebtorName', 'debtorName', { unique: false });
        }
        if (!db.objectStoreNames.contains('reminders')) {
          const reminders = db.createObjectStore('reminders', { keyPath: 'id' });
          reminders.createIndex('byDebtId', 'debtId', { unique: false });
          reminders.createIndex('byTs', 'ts', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  function withStore(storeName, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = fn(store, tx);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function getSettings() {
    return withStore('settings', 'readonly', (store) => new Promise((resolve) => {
      const request = store.get('settings');
      request.onsuccess = () => {
        resolve(request.result || { id: 'settings', currencySymbol: '$', schemaVersion: 1 });
      };
      request.onerror = () => resolve({ id: 'settings', currencySymbol: '$', schemaVersion: 1 });
    }));
  }

  function setSettings(partial) {
    return getSettings().then((current) => {
      const updated = Object.assign({}, current, partial, { id: 'settings' });
      return withStore('settings', 'readwrite', (store) => {
        store.put(updated);
        return updated;
      });
    });
  }

  function addSale({ amount, note, isCreditSale, debtId }) {
    const record = {
      id: util.makeId(),
      amountCents: amount,
      note: note || '',
      isCreditSale: Boolean(isCreditSale),
      debtId: debtId || null,
      ts: util.nowTs()
    };
    return withStore('sales', 'readwrite', (store) => {
      store.add(record);
      return record;
    });
  }

  function addExpense({ amount, category, note }) {
    const record = {
      id: util.makeId(),
      amountCents: amount,
      category: category || '',
      note: note || '',
      ts: util.nowTs()
    };
    return withStore('expenses', 'readwrite', (store) => {
      store.add(record);
      return record;
    });
  }

  function createDebt({ debtorName, phone, principal, dueTs, notes }) {
    const record = {
      id: util.makeId(),
      debtorName: debtorName || 'Unknown',
      phone: phone || '',
      principalCents: principal,
      balanceCents: principal,
      dueTs: dueTs || null,
      notes: notes || '',
      status: 'open',
      ts: util.nowTs()
    };
    return withStore('debts', 'readwrite', (store) => {
      store.add(record);
      return record;
    });
  }

  function applyDebtPayment({ debtId, amount }) {
    return getDebt(debtId).then((debt) => {
      if (!debt) throw new Error('Debt not found');
      const newBalance = Math.max(0, debt.balanceCents - amount);
      const updated = Object.assign({}, debt, {
        balanceCents: newBalance,
        status: newBalance === 0 ? 'closed' : 'open'
      });
      return withStore('debts', 'readwrite', (store) => {
        store.put(updated);
        return updated;
      });
    });
  }

  function listOpenDebts() {
    return withStore('debts', 'readonly', (store) => new Promise((resolve) => {
      const index = store.index('byStatus');
      const request = index.getAll('open');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    }));
  }

  function getDebt(debtId) {
    return withStore('debts', 'readonly', (store) => new Promise((resolve) => {
      const request = store.get(debtId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    }));
  }

  function addReminderLog({ debtId, phone, message, status }) {
    const record = {
      id: util.makeId(),
      debtId: debtId || null,
      phone: phone || '',
      message: message || '',
      status: status || 'unknown',
      ts: util.nowTs()
    };
    return withStore('reminders', 'readwrite', (store) => {
      store.add(record);
      return record;
    });
  }

  function listByDay(storeName, dayKey) {
    return withStore(storeName, 'readonly', (store) => new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items = (request.result || []).filter((item) => util.tsToDayKey(item.ts) === dayKey);
        resolve(items);
      };
      request.onerror = () => resolve([]);
    }));
  }

  function listSalesByDay(dayKey) {
    return listByDay('sales', dayKey);
  }

  function listExpensesByDay(dayKey) {
    return listByDay('expenses', dayKey);
  }

  function wipeDataExceptSettings() {
    const stores = ['sales', 'expenses', 'debts', 'reminders'];
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((storeName) => tx.objectStore(storeName).clear());
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function bulkImport(storeName, records) {
    return withStore(storeName, 'readwrite', (store) => {
      records.forEach((record) => store.put(record));
      return true;
    });
  }

  window.db = {
    DB_NAME,
    DB_VERSION,
    openDB,
    getSettings,
    setSettings,
    addSale,
    addExpense,
    createDebt,
    applyDebtPayment,
    listOpenDebts,
    getDebt,
    addReminderLog,
    listSalesByDay,
    listExpensesByDay,
    wipeDataExceptSettings,
    bulkImport
  };
})();
