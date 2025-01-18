module.exports = {
  '*/1 * * * *': {
    task: async ({ strapi }) => {
      try {
        // Call the checkOpenAIStatus method from the custom service
        await strapi.service('api::custom.openai-check').checkOpenAIStatus();
        console.log('Cron job executed: OpenAI status checked.');
      } catch (error) {
        console.error('Error executing cron job:', error);
      }
    },
    options: {
      // Optional: Add any specific options for the cron task here
    },
  },

  '*/3 * * * *': {
    task: async ({ strapi }) => {
      try {
        await strapi.service('api::container.container').processUnconfiguredContainers();
        console.log('Cron job executed: Unconfigured containers processed.');
      } catch (error) {
        console.error('Error processing unconfigured containers:', error);
      }
    },
    options: {
      // Optional: Add any specific options for the cron task here
    },
  },
};
