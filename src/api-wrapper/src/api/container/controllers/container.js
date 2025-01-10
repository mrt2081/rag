'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::container.container', ({ strapi }) => ({
  /**
   * Handles chat interactions with the RAG API
   * @async
   * @function chat
   * @description
   * Processes chat requests by:
   * 1. Validating required fields (service category, province, question)
   * 2. Retrieving service category and province details
   * 3. Getting RAG configuration settings
   * 4. Formatting message history and current question for the API
   * 5. Making an authenticated request to the RAG chat endpoint
   * Returns the RAG API response or appropriate error messages.
   */
  async chat(ctx) {
    try {
      // Validate request body
      if (!ctx.request.body) {
        return ctx.badRequest('Request body is missing');
      }

      const { messageHistory, currentQuestion, serviceCategoryId, provinceId, socketId } =
        ctx.request.body;

      // Validate required fields
      if (!serviceCategoryId || !provinceId) {
        return ctx.badRequest('Missing required fields');
      }

      // Get service category and province
      const serviceCategory = await strapi.db
        .query('api::service-category.service-category')
        .findOne({ where: { externalId: serviceCategoryId } });
      const province = await strapi.db
        .query('api::province.province')
        .findOne({ where: { externalId: provinceId } });

      if (!serviceCategory || !province) {
        return ctx.badRequest('Invalid service category or province');
      }

      // Get RAG URL and active provider from settings
      const ragUrl = JSON.parse(
        await strapi.service('api::setting.setting').getSetting('RAG_APP_URL')
      );
      const activeProvider = JSON.parse(
        await strapi.service('api::setting.setting').getSetting('ACTIVE_MODEL_PROVIDER')
      );

      if (!ragUrl || !activeProvider) {
        return ctx.badRequest('Missing configuration settings(activeProvider)');
      }

      // Use static endpoint if environment variable is set
      const staticEndpoint = process.env.STATIC_CONTAINER_ENDPOINT;
      const containerEndpoint =
        staticEndpoint ||
        `/a/${province.code.toLowerCase()}-${serviceCategory.name
          .toLowerCase()
          .replace(/\s+/g, '-')}-${activeProvider.toLowerCase()}/api/chat`;

      // Format payload for OpenAI
      const formattedPayload = {
        messages: [
          ...(messageHistory || []).map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: 'user',
            content: currentQuestion,
          },
        ],
      };

      // Get valid token from RAG auth service
      const token = await strapi.service('api::custom.rag-auth').getValidToken();
      // Ensure endpoint starts with a slash

      // Make request to RAG API
      const response = await strapi
        .service('api::custom.rag-api')
        .postRAGApi(formattedPayload, containerEndpoint, token, true);

      //  console.log(response);

      // Check if response is valid
      if (!response) {
        console.error('Invalid response');
        return ctx.internalServerError('Failed to get a valid response from the API');
      }

      // Emit data to the specific user using Socket.IO
      const io = strapi.io; // Assuming you have set up Socket.IO and attached it to Strapi
      response.data.on('data', chunk => {
        io.to(socketId).emit('chatData', chunk); // Emit data to the specific socket ID
      });

      response.data.on('end', () => {
        io.to(socketId).emit('chatEnd'); // Notify the client that the stream has ended
      });

      response.data.on('error', err => {
        console.error('Streaming error:', err);
        io.to(socketId).emit('chatError', { error: 'Streaming error occurred' });
      });

      // Return 200 immediately
      ctx.status = 200;
      ctx.body = { message: 'Streaming started', messageHistory: formattedPayload };
    } catch (error) {
      console.error('Error in container chat:', error);
      return ctx.internalServerError('An error occurred while processing your request');
    }
  },
}));
