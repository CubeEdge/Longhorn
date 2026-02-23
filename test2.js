const str = "有两张历史工单记录：\n- [K2601-0007] (/service/inquiry-tickets/70) HDMI无信号";
const ticketPattern = /\[?([A-Z]+-)*[A-Z]?\d{4}-\d{4}\]?(?:\s*\([^)]+\))?/g;
console.log(str.replace(ticketPattern, '<<<REPLACED>>>'));
