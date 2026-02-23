const text = `[K2601-0019](/service/inquiry-tickets/82) HDMI色彩偏色`;
const ticketPattern = /\[?([A-Z]+-)*[A-Z]?\d{4}-\d{4}\]?(?:\s*\([^)]+\))?/g;
console.log(text.replace(ticketPattern, 'REPLACED'));
