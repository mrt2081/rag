'use strict';

/**
 * container controller
 */

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
      const { messageHistory, currentQuestion, serviceCategoryId, provinceId } =
        ctx.request.body;

      // Validate required fields
      if (!serviceCategoryId || !provinceId || !currentQuestion) {
        return ctx.badRequest('Missing required fields');
      }

      // Get service category and province
      const serviceCategory = await strapi.db
        .query('api::service-category.service-category')
        .findOne({ where: { id: serviceCategoryId } });
      const province = await strapi.db
        .query('api::province.province')
        .findOne({ where: { id: provinceId } });

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
        return ctx.badRequest('Missing configuration settings');
      }

      // Construct the container endpoint
      // const containerEndpoint = `/a/${province.code.toLowerCase()}-${serviceCategory.name
      //   .toLowerCase()
      //   .replace(/\s+/g, '-')}-${activeProvider.toLowerCase()}/api/chat`;
      const containerEndpoint = '/a/test/api/chat'; // TODO: Remove this line and restore the previous line once the container is configured

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

      // Make request to RAG API
      const response = await strapi
        .service('api::custom.rag-api')
        .postRAGApi(formattedPayload, containerEndpoint, token);

      return response.data;
    } catch (error) {
      console.error('Error in container chat:', error);
      return ctx.internalServerError('An error occurred while processing your request');
    }
  },
}));
