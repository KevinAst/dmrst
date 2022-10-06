# Auth

**AI:** DO NOT publish anything here that would give insight to a
hacker.

This section describes the internals of **visualize-it**'s
authentication and authorization.

You are not required to sign-in to **visualize-it**.  You can build
**visualize-it** packages and run systems from file-based resources.

For "system participation" _(running a system)_ however, you must at
minimum (when not signed-in) supply a "Guest Name" (that identifies
you to other participants).

To get the full benefit of **visualize-it**, you must establish a free
account.  This allows you to perform more advanced features, like
publishing and promoting packages that you build in the cloud.

## Authentication & Authorization

[Authentication vs Authorization - What's the Difference?](https://www.freecodecamp.org/news/whats-the-difference-between-authentication-and-authorisation/)

- **Authentication** confirms that users are who they say they are.
- **Authorization** gives those users permission to access a resource (i.e. enablement).



## Work In Progress

1. **BAD** - BOTTOM LINE: If a malicious user get's access to your LocalStorage
   and copies 2 items (deviceId/token) they can steal your identity.
   
   - Risk is minimal, unless user has access to your computer.
     * Public WiFi is not an issue.
     * Shared public computer is _(unless they sign-off when done)_.

   - Need a more sophisticated process with private/public key

   - A **Partial FIX** would be to require email verification on each sign-in.
     * BIG hassle to the user
     * We could do this only on first access within the device.

   - A **Better FIX** would be to mix-in the client IP address _(in
     addition to the deviceId)).  This would greatly minimize the
     problem _(see next point)_.

   - Also could periodically check if same email is being used across
     devices.  This may be suspicious, and mark this email (in our DB)
     to require re-validation.  THIS NO NO GOOD ... once re-validated,
     then the hacker is IN again ... hmmm.

1. Along with the Virtual DeviceId - Mix in client's IP address

   ```
   ... https://stackoverflow.com/questions/6458083/get-the-clients-ip-address-in-socket-io
       - Not getting remote address while using proxy in socket.io
         ... https://stackoverflow.com/questions/11182980/not-getting-remote-address-while-using-proxy-in-socket-io
       - KJB: these posts are VERY old
              I suspect it may be problematic behind a proxy
              KEY: Need to try BOTH localhost (dev) and heroku (prod)
       - TRY: 
         >> FROM: https://stackoverflow.com/questions/11182980/not-getting-remote-address-while-using-proxy-in-socket-io
            ... SOME conn, SOME connection
         1. socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
         >> FROM: https://stackoverflow.com/questions/6458083/get-the-clients-ip-address-in-socket-io
         2. socket.handshake.address ... THINK returns the Server's IP, not the Client's IP
         3. socket.request.connection.remoteAddress
         4. const sHeaders = socket.handshake.headers; <<< this includes the port
            console.info('[%s:%s] CONNECT', sHeaders['x-forwarded-for'], sHeaders['x-forwarded-port']);
         5. socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress.split(":")[3]
         6. socket.request.connection._peername <<< NOT part of the official API
         7. socket.manager.handshaken[socket.id].address
         8. socket.conn.remoteAddress
         9. socket.handshake.headers['x-forwarded-for'].split(',')[0]
   ```

   **Here is a code snippet to play with this a bit ... need to run it in production server to see what it does**
   ```js
     // XX TEST to see if we can get the clientIP
     const clientIP1 = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress; // ... clientIP1: '::1',
     const clientIP2 = socket.handshake.address; // THINK returns the Server's IP, not the Client's IP         // ... clientIP2: '::1',
     const clientIP3 = socket.request.connection.remoteAddress;                                                // ... clientIP3: '::1',
   
     const sHeaders = socket.handshake.headers; // this includes the port
     const clientIP4 = sHeaders['x-forwarded-for'] + ':' + sHeaders['x-forwarded-port'];                        // ... clientIP4: 'undefined:undefined',
   
     const clientIP5 = socket.request.connection._peername; // NOT part of the official API                     // ... clientIP5: { address: '::1', family: 'IPv6', port: 61732 },
   //const clientIP6 = socket.manager.handshaken[socket.id].address;
     const clientIP7 = socket.conn.remoteAddress;                                                               // ... clientIP7: '::1'
   //const clientIP8 = socket.handshake.headers['x-forwarded-for'].split(',')[0];
   
     // KJB ATTEMPT: 
     const clientIP9  = socket.handshake.headers['origin'];  // KJB: more like the server name (I THINK)        // ... clientIP9: 'http://localhost:8085',
     const clientIP10 = socket.handshake.headers['referer']; // KJB: more like the server name (I THINK)        // ... clientIP10: 'http://localhost:8085/'
     log(`XX clientIP attempts: `, {clientIP1, clientIP2, clientIP3, clientIP4, clientIP5, clientIP7});
   //log(`XX clientIP headers:  `, socket.handshake.headers);
     log(`XX clientIP KJB attempts: `, {clientIP9, clientIP10});
   ```

