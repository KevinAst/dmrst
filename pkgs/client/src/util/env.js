// a simplistic determination of whether client is running in 
// - production  - isProd: true
// - development - isDev: true
export const  isDev  = window?.location?.hostname === 'localhost';
export const  isProd = !isDev;
