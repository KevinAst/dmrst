// promote a determination of whether server is running in 
// - production  - isProd: true
// - development - isDev: true

// MUST explicitly set to 'production" (i.e. make it hard to be in a production mode)
// ... using same context that is common to all node.js modules
export const  isProd = process.env.NODE_ENV === 'production';
export const  isDev  = !isProd;
