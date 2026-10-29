const _weekdays = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];
const _months = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'
];

/// "Monday, 24 June"
String formatLongDate(DateTime d) =>
    '${_weekdays[d.weekday - 1]}, ${d.day} ${_months[d.month - 1]}';

/// "14 Mar 2024"
String formatShortDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')} ${_months[d.month - 1].substring(0, 3)} ${d.year}';

String greetingFor(DateTime d) {
  if (d.hour < 12) return 'Good morning';
  if (d.hour < 17) return 'Good afternoon';
  return 'Good evening';
}
