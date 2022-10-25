/**
 * Configure our process.env via .env files.
 *
 * NOTE: This is used in DEV only (PROD uses standard heroku configuration)
 *
 * NOTE: This module should be imported VERY EARLY in our startup process.
 */

import * as dotenv from 'dotenv';

dotenv.config();
