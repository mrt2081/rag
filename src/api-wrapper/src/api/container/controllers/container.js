'use strict';

/**
 * container controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::container.container', ({ strapi }) => ({
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
      // const containerEndpoint = `/a/${province.code.toLowerCase()}-${serviceCategory.name.toLowerCase().replace(/\s+/g, '-')}-${activeProvider.toLowerCase()}/api/chat`;
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

      // Get auth token from query parameters
      // const authToken = ctx.request.query.Authorization;
      // if (!authToken) {
      //   return ctx.unauthorized('Missing authorization token');
      // }

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
