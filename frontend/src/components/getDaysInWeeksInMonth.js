/** Week rows for a month grid (Sun–Sat). Empty cells are 0. */
export function getDaysInWeeksInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = new Date(year, month, 1).getDay();
  const weeks = [];
  let row = Array(7).fill(0);
  let i = startPad;
  for (let d = 1; d <= daysInMonth; d++) {
    row[i++] = d;
    if (i === 7) {
      weeks.push(row);
      row = Array(7).fill(0);
      i = 0;
    }
  }
  if (i > 0) {
    weeks.push(row);
  }
  return weeks;
}

export function getWeekdays() {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

export function getShortMonthName(month) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month];
}
