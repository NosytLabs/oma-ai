export function getExpiryDate(daysFromNow: number = 365): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}
