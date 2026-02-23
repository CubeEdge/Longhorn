const str1 = "[[K2601-0007]](/service/inquiry-tickets/70) HDMI无信号";
const str2 = "[K2601-0007](/service/inquiry-tickets/70) HDMI无信号";
const ticketPattern = /\[?([A-Z]+-)*[A-Z]?\d{4}-\d{4}\]?(?:\s*\([^)]+\))?/g;
console.log(str1.replace(ticketPattern, '<<<REPLACED>>>'));
console.log(str2.replace(ticketPattern, '<<<REPLACED>>>'));
