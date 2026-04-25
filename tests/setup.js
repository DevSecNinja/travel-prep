const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock matchMedia for JSDOM (not natively supported)
if (typeof window !== 'undefined') {
  window.matchMedia = window.matchMedia || function (query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function () {},
      removeListener: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () { return false; },
    };
  };
}

// Suppress console.debug output during tests to keep output clean
console.debug = () => {};
