(function () {
  const SCHEMA_VERSION = 1;

  function exportLedger({ days = 90 } = {}) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return Promise.all([
      db.getSettings(),
      db.listOpenDebts(),
      db.listSalesByDay(util.todayKey()),
      db.listExpensesByDay(util.todayKey())
    ]).then(([settings, debts, todaySales, todayExpenses]) => {
      return Promise.all([
        db.openDB().then((database) => new Promise((resolve) => {
          const tx = database.transaction(['sales', 'expenses', 'debts', 'reminders'], 'readonly');
          const salesReq = tx.objectStore('sales').getAll();
          const expensesReq = tx.objectStore('expenses').getAll();
          const debtsReq = tx.objectStore('debts').getAll();
          const remindersReq = tx.objectStore('reminders').getAll();
          tx.oncomplete = () => {
            resolve({
              sales: (salesReq.result || []).filter((item) => item.ts >= cutoff),
              expenses: (expensesReq.result || []).filter((item) => item.ts >= cutoff),
              debts: debtsReq.result || [],
              reminders: remindersReq.result || []
            });
          };
        }))
      ]).then(([data]) => ({
        schemaVersion: SCHEMA_VERSION,
        createdTs: Date.now(),
        settings,
        debts: data.debts,
        sales: data.sales,
        expenses: data.expenses,
        reminders: data.reminders,
        meta: {
          daysIncluded: days,
          todaySalesCount: todaySales.length,
          todayExpensesCount: todayExpenses.length
        }
      }));
    });
  }

  function encodeExport(obj) {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return computeChecksum(b64).then((checksum) => ({ b64, checksum }));
  }

  function computeChecksum(str) {
    if (window.crypto && window.crypto.subtle) {
      const data = new TextEncoder().encode(str);
      return window.crypto.subtle.digest('SHA-256', data).then((buf) => {
        const arr = Array.from(new Uint8Array(buf));
        return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
      });
    }
    let sum = 0;
    for (let i = 0; i < str.length; i += 1) {
      sum = (sum + str.charCodeAt(i)) % 1000000007;
    }
    return Promise.resolve(String(sum));
  }

  function chunkString(str, maxLen) {
    const chunks = [];
    for (let i = 0; i < str.length; i += maxLen) {
      chunks.push(str.slice(i, i + maxLen));
    }
    return chunks;
  }

  function buildSmsChunks(exportId, checksum, b64) {
    const payloadLimit = 120;
    const chunks = chunkString(b64, payloadLimit);
    const total = chunks.length;
    return chunks.map((chunk, index) => {
      const part = index + 1;
      return `MSB|${exportId}|${part}/${total}|${checksum}|${chunk}`;
    });
  }

  function sendBackupSMS(phone) {
    const exportId = util.makeId();
    return exportLedger({ days: 90 })
      .then((data) => encodeExport(data))
      .then(({ b64, checksum }) => {
        const messages = buildSmsChunks(exportId, checksum, b64);
        let chain = Promise.resolve();
        messages.forEach((message) => {
          chain = chain.then(() => sms.sendSMS(phone, message));
        });
        return chain.then(() => ({ exportId, total: messages.length }));
      });
  }

  function parseSmsText(text) {
    if (!text.startsWith('MSB|')) return null;
    const parts = text.split('|');
    if (parts.length < 5) return null;
    const exportId = parts[1];
    const partInfo = parts[2].split('/');
    const part = parseInt(partInfo[0], 10);
    const total = parseInt(partInfo[1], 10);
    const checksum = parts[3];
    const chunk = parts.slice(4).join('|');
    return { exportId, part, total, checksum, chunk };
  }

  function tryImportFromSmsTextList(texts) {
    const parsed = texts.map(parseSmsText).filter(Boolean);
    if (!parsed.length) {
      return Promise.reject(new Error('No backup messages found.'));
    }
    const grouped = parsed.reduce((acc, item) => {
      acc[item.exportId] = acc[item.exportId] || [];
      acc[item.exportId].push(item);
      return acc;
    }, {});
    const exportId = Object.keys(grouped)[0];
    const parts = grouped[exportId];
    const total = parts[0].total;
    if (parts.length < total) {
      return Promise.reject(new Error('Missing backup parts.'));
    }
    parts.sort((a, b) => a.part - b.part);
    const checksum = parts[0].checksum;
    const b64 = parts.map((p) => p.chunk).join('');
    return computeChecksum(b64).then((calc) => {
      if (calc !== checksum) {
        throw new Error('Backup checksum mismatch.');
      }
      const json = decodeURIComponent(escape(atob(b64)));
      const data = util.safeJsonParse(json);
      if (!data) throw new Error('Invalid backup payload.');
      return data;
    });
  }

  function restoreBackupData(data) {
    return db.wipeDataExceptSettings().then(() => Promise.all([
      db.bulkImport('sales', data.sales || []),
      db.bulkImport('expenses', data.expenses || []),
      db.bulkImport('debts', data.debts || []),
      db.bulkImport('reminders', data.reminders || [])
    ])).then(() => true);
  }

  window.backup = {
    exportLedger,
    encodeExport,
    chunkString,
    buildSmsChunks,
    sendBackupSMS,
    tryImportFromSmsTextList,
    restoreBackupData
  };
})();
