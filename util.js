module.exports = {
  insertString: (haystack, index, needle) => {
    return haystack.substr(0, index) + needle + haystack.substr(index)
  },
  trimText: (text, target_length) => {
    if (text.length <= target_length) return text;
    const trimmedText = text.substring(0, target_length);
    const lastPeriodIndex = trimmedText.lastIndexOf('.');

    if (lastPeriodIndex !== -1) {
      return trimmedText.substring(0, lastPeriodIndex + 1);
    } else {
      return trimmedText;
    }
  },
  generateRandomNeedle(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
  }
}