# Auth

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

* Along with the Virtual DeviceId - Mix in client's IP address

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
