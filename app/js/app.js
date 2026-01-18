(function () {
  let settings = null;

  function refreshSettings() {
    return db.getSettings().then((data) => {
      settings = data;
      return data;
    });
  }

  function formatMoney(cents) {
    return util.formatMoney(cents, settings ? settings.currencySymbol : '$');
  }

  function screenHome() {
    return reports.getDailySummary(util.todayKey()).then((summary) => {
      return {
        title: 'My Sales Book',
        render: () => `
          <div class="card">
            <div class="hint">Today sales</div>
            <div class="value">${formatMoney(summary.salesCents)}</div>
            <div class="hint">Today expenses</div>
            <div class="value">${formatMoney(summary.expensesCents)}</div>
            <div class="hint">Profit</div>
            <div class="value">${formatMoney(summary.profitCents)}</div>
          </div>
        `,
        items: [
          { label: 'Add Sale', action: () => showScreen(screenAddSale()) },
          { label: 'Add Expense', action: () => showScreen(screenAddExpense()) },
          { label: 'Debts', action: () => showScreen(screenDebtsList()) },
          { label: 'Weekly Summary', action: () => showScreen(screenWeeklySummary()) },
          { label: 'Backup / Restore', action: () => showScreen(screenBackup()) }
        ],
        softkeys: {
          left: 'Add',
          center: 'Select',
          right: ''
        }
      };
    });
  }

  function screenAddSale() {
    return Promise.resolve({
      title: 'Add Sale',
      render: () => `
        <div class="card">
          <label>Amount
            <input id="sale-amount" type="number" inputmode="decimal" placeholder="0.00">
          </label>
          <label>Note
            <input id="sale-note" type="text" placeholder="Optional">
          </label>
          <label class="hint">
            <input id="sale-credit" type="checkbox"> Credit sale
          </label>
        </div>
      `,
      softkeys: {
        left: 'Back',
        center: 'Save',
        right: '',
        onLeft: () => showScreen(screenHome()),
        onCenter: () => {
          const amount = util.parseAmount(document.getElementById('sale-amount').value);
          const note = document.getElementById('sale-note').value;
          const isCreditSale = document.getElementById('sale-credit').checked;
          db.addSale({ amount, note, isCreditSale, debtId: null })
            .then(() => {
              ui.showMessage('Sale saved');
              return showScreen(screenHome());
            })
            .catch((err) => ui.showMessage(err.message, true));
        }
      }
    });
  }

  function screenAddExpense() {
    return Promise.resolve({
      title: 'Add Expense',
      render: () => `
        <div class="card">
          <label>Amount
            <input id="expense-amount" type="number" inputmode="decimal" placeholder="0.00">
          </label>
          <label>Category
            <input id="expense-category" type="text" placeholder="Optional">
          </label>
          <label>Note
            <input id="expense-note" type="text" placeholder="Optional">
          </label>
        </div>
      `,
      softkeys: {
        left: 'Back',
        center: 'Save',
        right: '',
        onLeft: () => showScreen(screenHome()),
        onCenter: () => {
          const amount = util.parseAmount(document.getElementById('expense-amount').value);
          const category = document.getElementById('expense-category').value;
          const note = document.getElementById('expense-note').value;
          db.addExpense({ amount, category, note })
            .then(() => showScreen(screenHome()))
            .catch((err) => ui.showMessage(err.message, true));
        }
      }
    });
  }

  function screenAddDebt() {
    return Promise.resolve({
      title: 'New Debt',
      render: () => `
        <div class="card">
          <label>Debtor name
            <input id="debt-name" type="text" placeholder="Name">
          </label>
          <label>Phone
            <input id="debt-phone" type="tel" placeholder="Optional">
          </label>
          <label>Amount owed
            <input id="debt-amount" type="number" inputmode="decimal" placeholder="0.00">
          </label>
          <label>Notes
            <input id="debt-notes" type="text" placeholder="Optional">
          </label>
        </div>
      `,
      softkeys: {
        left: 'Back',
        center: 'Save',
        right: '',
        onLeft: () => showScreen(screenDebtsList()),
        onCenter: () => {
          const debtorName = document.getElementById('debt-name').value;
          const phone = document.getElementById('debt-phone').value;
          const principal = util.parseAmount(document.getElementById('debt-amount').value);
          const notes = document.getElementById('debt-notes').value;
          db.createDebt({ debtorName, phone, principal, dueTs: null, notes })
            .then(() => showScreen(screenDebtsList()))
            .catch((err) => ui.showMessage(err.message, true));
        }
      }
    });
  }

  function screenDebtsList() {
    return db.listOpenDebts().then((debts) => ({
      title: 'Debts',
      render: () => `
        <div class="card">
          <div class="hint">Open debts: ${debts.length}</div>
        </div>
      `,
      items: [
        { label: 'Add Debt', action: () => showScreen(screenAddDebt()) },
        ...debts.map((debt) => ({
          label: `${debt.debtorName} - ${formatMoney(debt.balanceCents)}`,
          action: () => showScreen(screenDebtDetail(debt.id))
        }))
      ],
      softkeys: {
        left: 'Back',
        center: 'Select',
        right: '',
        onLeft: () => showScreen(screenHome())
      }
    }));
  }

  function screenDebtDetail(debtId) {
    return db.getDebt(debtId).then((debt) => ({
      title: 'Debt Detail',
      render: () => `
        <div class="card">
          <div class="value">${debt.debtorName}</div>
          <div class="hint">Balance</div>
          <div class="value">${formatMoney(debt.balanceCents)}</div>
          <div class="hint">Phone</div>
          <div>${debt.phone || 'None'}</div>
        </div>
        <div class="card">
          <label>Payment amount
            <input id="payment-amount" type="number" inputmode="decimal" placeholder="0.00">
          </label>
        </div>
      `,
      items: [
        { label: 'Send Reminder SMS', action: () => sendDebtReminder(debt) },
        { label: 'Record Payment', action: () => recordDebtPayment(debt) }
      ],
      softkeys: {
        left: 'Back',
        center: 'Select',
        right: '',
        onLeft: () => showScreen(screenDebtsList())
      }
    }));
  }

  function sendDebtReminder(debt) {
    if (!debt.phone) {
      ui.showMessage('No phone for this debtor.', true);
      return;
    }
    const message = `Reminder: balance ${formatMoney(debt.balanceCents)} due. Thank you.`;
    sms.sendSMS(debt.phone, message)
      .then(() => db.addReminderLog({ debtId: debt.id, phone: debt.phone, message, status: 'sent' }))
      .then(() => ui.showMessage('Reminder sent'))
      .catch((err) => db.addReminderLog({ debtId: debt.id, phone: debt.phone, message, status: 'failed' })
        .then(() => ui.showMessage(err.message, true)));
  }

  function recordDebtPayment(debt) {
    const amount = util.parseAmount(document.getElementById('payment-amount').value);
    if (!amount) {
      ui.showMessage('Enter payment amount.', true);
      return;
    }
    db.applyDebtPayment({ debtId: debt.id, amount })
      .then(() => showScreen(screenDebtsList()))
      .catch((err) => ui.showMessage(err.message, true));
  }

  function screenWeeklySummary() {
    return reports.getWeeklySummary(util.todayKey()).then(({ days, summaries }) => ({
      title: 'Weekly Summary',
      render: () => {
        const rows = summaries.map((summary, idx) => `
          <div class="row">
            <div class="col">${days[idx]}</div>
            <div class="col">${formatMoney(summary.profitCents)}</div>
          </div>
        `).join('');
        return `<div class="card">${rows}</div>`;
      },
      softkeys: {
        left: 'Back',
        center: '',
        right: '',
        onLeft: () => showScreen(screenHome())
      }
    }));
  }

  function screenBackup() {
    return Promise.resolve({
      title: 'Backup / Restore',
      render: () => `
        <div class="card">
          <label>Backup phone
            <input id="backup-phone" type="tel" placeholder="Your number">
          </label>
        </div>
        <div class="card">
          <label>Paste backup text
            <textarea id="backup-text" rows="4" placeholder="Paste SMS parts"></textarea>
          </label>
        </div>
      `,
      items: [
        { label: 'Send Backup SMS', action: () => sendBackup() },
        { label: 'Restore from Text', action: () => restoreFromText() }
      ],
      softkeys: {
        left: 'Back',
        center: 'Select',
        right: '',
        onLeft: () => showScreen(screenHome())
      }
    });
  }

  function sendBackup() {
    const phone = document.getElementById('backup-phone').value;
    if (!phone) {
      ui.showMessage('Enter a phone number.', true);
      return;
    }
    backup.sendBackupSMS(phone)
      .then((result) => ui.showMessage(`Backup sent (${result.total} parts)`))
      .catch((err) => ui.showMessage(err.message, true));
  }

  function restoreFromText() {
    const text = document.getElementById('backup-text').value.trim();
    if (!text) {
      ui.showMessage('Paste backup text.', true);
      return;
    }
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    backup.tryImportFromSmsTextList(lines)
      .then((data) => {
        if (!confirm('This will overwrite local data. Continue?')) {
          throw new Error('Restore cancelled.');
        }
        return backup.restoreBackupData(data);
      })
      .then(() => {
        ui.showMessage('Restore complete');
        return showScreen(screenHome());
      })
      .catch((err) => ui.showMessage(err.message, true));
  }

  function showScreen(screenPromise) {
    return Promise.resolve(screenPromise)
      .then((screen) => {
        ui.render(screen);
        return screen;
      });
  }

  function showErrorScreen(err) {
    ui.render({
      title: 'Error',
      render: () => `<div class="card error">${err.message || err}</div>`,
      softkeys: {
        left: 'Home',
        center: '',
        right: '',
        onLeft: () => showScreen(screenHome())
      }
    });
  }

  function init() {
    return db.openDB()
      .then(() => refreshSettings())
      .then(() => showScreen(screenHome()));
  }

  window.addEventListener('keydown', ui.handleKey);

  init().catch(showErrorScreen);

  window.app = {
    refreshSettings,
    showScreen
  };
})();
