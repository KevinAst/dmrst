// a simplistic determination of whether client is running in 
// - production  - isProd: true
// - development - isDev: true
export const  isDev  = window?.location?.hostname === '127.0.0.1' || window?.location?.hostname === 'localhost'; // ??
export const  isProd = !isDev;
