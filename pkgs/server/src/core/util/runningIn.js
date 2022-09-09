// taken from: https://github.com/flexdinesh/browser-or-node
const inBrowser =
  typeof window !== "undefined" &&
  typeof window.document !== "undefined";

const inNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

export {inBrowser, inNode};
