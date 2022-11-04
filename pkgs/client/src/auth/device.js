const DEVICE_ID = 'deviceId';

/********************************************************************************
 * Return a "simulated" deviceId for this client app.  This is a
 * persistent hash, retained in localStorage.  As a result, this same
 * deviceId is shared across all instances of the visualize-it app
 * running in the same browser instance (i.e. multiple browser
 * windows).
 *
 * RETURN: deviceId
 *********************************************************************************/
export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID, deviceId);
  }
  return deviceId;
}

/********************************************************************************
 * Reset the "simulated" deviceId for this client app.  This is
 * initiated through a server directive in the sign-out process,
 * as a preventative measure to safeguard ID theft.
 * 
 * In essence this minimizes deviceId theft, because the deviceId
 * changes constantly.
 *
 * RETURN: deviceId (newly generated)
 *********************************************************************************/
export function resetDeviceId() {
  localStorage.removeItem(DEVICE_ID);
  return getDeviceId();
}

// NOTE: If a user should clear this localStorage item, any prior app
//       instances will be considered to be running on a different
//       device.  It technically still works, with that caveat.

// NOTE: Encryption of this item would not alleviate hacker use
//       BECAUSE a hacker can still use the encrypted value "as is".
