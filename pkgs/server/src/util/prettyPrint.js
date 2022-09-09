// pretty print the supplied JSON object
// NOTE: cannot get the debug logger formatter (%O) to work
//       - it does NOT format on multiple lines
//       - it does NOT recurse into structure more than one level
export function prettyPrint(jsonObj) {
  return JSON.stringify(jsonObj, null, 2);
}
