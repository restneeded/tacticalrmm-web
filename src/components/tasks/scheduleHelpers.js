// Phase N — schedule rendering + bit-mask helpers.
//
// AutomatedTask.task_type drives which fields matter; the model uses
// Windows-Task-Scheduler bit masks for weekdays, weeks-of-month, months,
// and days-of-month. Helpers below mirror the Python upstream
// (tacticalrmm/utils.py + tacticalrmm/constants.py) so we can render
// human-readable strings client-side without a round trip.

export const WEEK_DAYS = [
  { name: "Sunday",    short: "Sun", bit: 0x1 },
  { name: "Monday",    short: "Mon", bit: 0x2 },
  { name: "Tuesday",   short: "Tue", bit: 0x4 },
  { name: "Wednesday", short: "Wed", bit: 0x8 },
  { name: "Thursday",  short: "Thu", bit: 0x10 },
  { name: "Friday",    short: "Fri", bit: 0x20 },
  { name: "Saturday",  short: "Sat", bit: 0x40 },
];

export const MONTHS = [
  { name: "January",   short: "Jan", bit: 0x1 },
  { name: "February",  short: "Feb", bit: 0x2 },
  { name: "March",     short: "Mar", bit: 0x4 },
  { name: "April",     short: "Apr", bit: 0x8 },
  { name: "May",       short: "May", bit: 0x10 },
  { name: "June",      short: "Jun", bit: 0x20 },
  { name: "July",      short: "Jul", bit: 0x40 },
  { name: "August",    short: "Aug", bit: 0x80 },
  { name: "September", short: "Sep", bit: 0x100 },
  { name: "October",   short: "Oct", bit: 0x200 },
  { name: "November",  short: "Nov", bit: 0x400 },
  { name: "December",  short: "Dec", bit: 0x800 },
];

export const WEEKS_OF_MONTH = [
  { name: "First Week",  bit: 0x1 },
  { name: "Second Week", bit: 0x2 },
  { name: "Third Week",  bit: 0x4 },
  { name: "Fourth Week", bit: 0x8 },
  { name: "Last Week",   bit: 0x10 },
];

// Days of month: bit n = day n (1..31). 0x80000000 = Last Day.
export const MONTH_DAYS_LAST = 0x80000000;
export const MONTH_DAYS_ALL_31 = 0x7fffffff; // bits 1..31

export function daysToString(bits) {
  if (!bits && bits !== 0) return "";
  if (bits === 0x7f /* 127 */) return "Every day";
  return WEEK_DAYS.filter((d) => bits & d.bit).map((d) => d.short).join(", ");
}
export function monthsToString(bits) {
  if (!bits && bits !== 0) return "";
  if (bits === 0xfff /* 4095 */) return "Every month";
  return MONTHS.filter((m) => bits & m.bit).map((m) => m.short).join(", ");
}
export function weeksToString(bits) {
  if (!bits && bits !== 0) return "";
  if (bits === 0x1f /* 31 */) return "Every week";
  return WEEKS_OF_MONTH.filter((w) => bits & w.bit).map((w) => w.name).join(", ");
}
export function monthDaysToString(bits) {
  if (bits == null) return "";
  if (bits === MONTH_DAYS_LAST) return "Last day";
  if (bits === 0x7fffffff || bits === 0xffffffff) return "Every day";
  // strip the "last day" flag if present so we can list the rest
  const last = (bits & MONTH_DAYS_LAST) !== 0;
  let rest = bits & ~MONTH_DAYS_LAST;
  const out = [];
  for (let i = 0; i < 31; i++) {
    if (rest & (0x1 << i)) out.push(String(i + 1));
  }
  if (last) out.push("Last");
  return out.join(", ");
}

function fmtTimeFromIso(iso) {
  if (!iso) return "00:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Human-readable schedule string. Pure mirror of the model's `schedule`
// property — kept client-side so the Library table doesn't depend on the
// serialiser including it (it does, but we want it for unsaved drafts too).
export function formatSchedule(task) {
  if (!task) return "";
  const t = task.task_type;
  if (t === "manual")        return "Manual";
  if (t === "checkfailure")  return "Every time check fails";
  if (t === "onboarding")    return "Onboarding (one-shot at create)";
  if (t === "runonce") {
    if (!task.run_time_date) return "Run once";
    return `Run once on ${new Date(task.run_time_date).toLocaleString()}`;
  }
  const when = fmtTimeFromIso(task.run_time_date);
  if (t === "daily") {
    return task.daily_interval && task.daily_interval > 1
      ? `Every ${task.daily_interval} days at ${when}`
      : `Daily at ${when}`;
  }
  if (t === "weekly") {
    const days = daysToString(task.run_time_bit_weekdays || 0);
    if (task.weekly_interval && task.weekly_interval !== 1) {
      return `${days || "—"} at ${when} every ${task.weekly_interval} weeks`;
    }
    return `${days || "—"} at ${when}`;
  }
  if (t === "monthly") {
    return `Runs ${monthsToString(task.monthly_months_of_year || 0)} on days ` +
           `${monthDaysToString(task.monthly_days_of_month || 0)} at ${when}`;
  }
  if (t === "monthlydow") {
    return `Runs ${monthsToString(task.monthly_months_of_year || 0)} on ` +
           `${weeksToString(task.monthly_weeks_of_month || 0)} on ` +
           `${daysToString(task.run_time_bit_weekdays || 0)} at ${when}`;
  }
  if (t === "scheduled") return "Scheduled (deprecated)";
  return t || "—";
}

export const TASK_TYPE_OPTIONS = [
  { value: "manual",       label: "Manual (only when triggered)" },
  { value: "runonce",      label: "Run once at a specific time" },
  { value: "daily",        label: "Daily" },
  { value: "weekly",       label: "Weekly" },
  { value: "monthly",      label: "Monthly (on specific days)" },
  { value: "monthlydow",   label: "Monthly (on specific weekdays)" },
  { value: "checkfailure", label: "On check failure" },
];

export const TASK_TYPE_LABELS = TASK_TYPE_OPTIONS.reduce((m, o) => { m[o.value] = o.label; return m; }, {
  onboarding: "Onboarding",
  scheduled:  "Scheduled (deprecated)",
});
