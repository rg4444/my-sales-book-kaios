(function () {
  function getDailySummary(dayKey) {
    return Promise.all([
      db.listSalesByDay(dayKey),
      db.listExpensesByDay(dayKey)
    ]).then(([sales, expenses]) => {
      const totalSales = sales.reduce((sum, sale) => sum + sale.amountCents, 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
      return {
        dayKey,
        salesCents: totalSales,
        expensesCents: totalExpenses,
        profitCents: totalSales - totalExpenses
      };
    });
  }

  function getWeeklySummary(endingDayKey) {
    const end = new Date(endingDayKey + 'T00:00:00');
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      days.push(util.tsToDayKey(d.getTime()));
    }
    return Promise.all(days.map((day) => getDailySummary(day))).then((summaries) => ({
      days,
      summaries
    }));
  }

  window.reports = {
    getDailySummary,
    getWeeklySummary
  };
})();
