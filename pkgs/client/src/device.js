const DEVICE_ID = 'DeviceId';

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
 * initiated through a server directive, when it detects first usage
 * of a device (i.e. the first app instance for a given browser
 * instance).
 * 
 * In essance this minimizes hacker re-use, because the deviceId
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

// NOTE: Encryption of this item would not aleviate hacker use
//       BECAUSE a hacker can still use he encrypted value "as is".
