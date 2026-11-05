export const bookingToday = (now = new Date()) => {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export const bookingDateError = (value, now = new Date()) => {
  if(typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Choose a valid date.";
  const date=new Date(`${value}T00:00:00Z`);
  if(Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value)return "Choose a valid date.";
  return value < bookingToday(now) ? "Choose today or a future date in Bangladesh time." : "";
};
