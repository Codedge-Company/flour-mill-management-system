// src/utils/saleDate.js
const TZ = 'Asia/Colombo';

const colomboYMD = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const colomboHMS = (d) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(d);

// A date-only input arrives as exactly midnight UTC.
const isDateOnly = (d) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
  d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

// New sale: keep the calendar date the user picked, use the real current Colombo time.
const resolveSaleDatetime = (input, now = new Date()) => {
  if (!input) return now;
  const picked = new Date(input);
  if (isNaN(picked)) return now;
  if (!isDateOnly(picked)) return picked;
  const ymd = picked.toISOString().slice(0, 10);
  return new Date(`${ymd}T${colomboHMS(now)}+05:30`);
};

// Edit sale: if the date didn't change, keep the original time; if it did, keep the original time-of-day.
const resolveEditedSaleDatetime = (existing, input) => {
  if (!input) return existing;
  const picked = new Date(input);
  if (isNaN(picked)) return existing;
  if (!isDateOnly(picked)) return picked;
  const ymd = picked.toISOString().slice(0, 10);
  if (existing && colomboYMD(existing) === ymd) return existing;
  return new Date(`${ymd}T${colomboHMS(existing || new Date())}+05:30`);
};

module.exports = { resolveSaleDatetime, resolveEditedSaleDatetime };