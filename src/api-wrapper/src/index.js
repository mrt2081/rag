'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Initialize Socket.IO after Strapi server is running
    const { Server } = require('socket.io');

    console.log('Bootstrapping Socket.IO...');
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('HTTP Server:', strapi.server.httpServer ? 'Available' : 'Not Available');

    // Wait for the HTTP server to be ready
    if (!strapi.server.httpServer) {
      console.log('Waiting for HTTP server...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: [/^http:\/\/localhost:\d+$/, /^https?:\/\/([a-zA-Z0-9-]+\.)?lawvo\.com$/],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Attach Socket.IO instance to strapi
    strapi.io = io;

    // Handle socket connections
    io.on('connection', socket => {
      console.log('a user connected', socket.id);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
      });

      // Handle errors
      socket.on('error', error => {
        console.error('Socket error:', error);
      });
    });

    console.log('Socket.IO initialized successfully');
  },
};
