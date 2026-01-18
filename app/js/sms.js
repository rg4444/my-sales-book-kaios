(function () {
  function canSendSMS() {
    return Boolean(navigator.mozSms || navigator.mozMobileMessage || navigator.mozSmsManager);
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\s+/g, '');
  }

  function sendSMS(phone, text) {
    if (!canSendSMS()) {
      return Promise.reject(new Error('SMS not supported on this device.'));
    }
    const target = normalizePhone(phone);
    const smsManager = navigator.mozSms || navigator.mozMobileMessage || navigator.mozSmsManager;
    return new Promise((resolve, reject) => {
      const request = smsManager.send(target, text);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to send SMS.'));
    });
  }

  window.sms = {
    canSendSMS,
    normalizePhone,
    sendSMS
  };
})();
