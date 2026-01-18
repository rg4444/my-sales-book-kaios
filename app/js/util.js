(function () {
  function nowTs() {
    return Date.now();
  }

  function formatMoney(amountCents, currencySymbol) {
    const symbol = currencySymbol || '$';
    const value = (amountCents || 0) / 100;
    return symbol + value.toFixed(2);
  }

  function parseAmount(inputString) {
    if (!inputString) return 0;
    const cleaned = String(inputString).replace(/[^0-9.]/g, '');
    if (!cleaned) return 0;
    const parts = cleaned.split('.');
    const whole = parts[0] || '0';
    const frac = (parts[1] || '').slice(0, 2).padEnd(2, '0');
    return parseInt(whole, 10) * 100 + parseInt(frac || '0', 10);
  }

  function todayKey() {
    return tsToDayKey(Date.now());
  }

  function tsToDayKey(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch (err) {
      return null;
    }
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  window.util = {
    nowTs,
    formatMoney,
    parseAmount,
    todayKey,
    tsToDayKey,
    clamp,
    safeJsonParse,
    makeId
  };
})();
