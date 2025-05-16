'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const axios = require('axios');

module.exports = createCoreController('api::assistant.assistant', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;
    const {
      primaryModel,
      secondaryModel,
      temperature,
      instruction,
      searchFile,
      description,
      provinceId,
      serviceCategoryId,
      isGeneral = false,
    } = data.metaData || {};

    // Validate required fields
    if (!isGeneral && (!provinceId || !serviceCategoryId)) {
      return ctx.badRequest(
        'Province and service category are required for non-general assistants.'
      );
    }

    // Check if instruction is provided and not empty
    if (!instruction || instruction.trim() === '') {
      return ctx.badRequest('Instruction is required.');
    }

    let province, serviceCategory, assistantName;

    if (!isGeneral) {
      // Fetch province and service category
      const provinces = await strapi.documents('api::province.province').findMany({
        filters: { externalId: provinceId.toString() },
      });
      province = provinces[0];
      const serviceCategories = await strapi
        .documents('api::service-category.service-category')
        .findMany({
          filters: { externalId: serviceCategoryId.toString() },
        });
      serviceCategory = serviceCategories[0];

      if (!province || !serviceCategory) {
        return ctx.badRequest('Invalid province or service category.');
      }

      // Generate assistant name for specific assistant
      assistantName = `${province.code.toLowerCase()}-${serviceCategory.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}`;
    } else {
      // Generate assistant name for general assistant
      assistantName = `general-assistant`;
    }

    // Check for duplicate assistant name
    const existingAssistant = await strapi
      .documents('api::assistant.assistant')
      .findMany({
        filters: { name: assistantName },
      });

    if (existingAssistant.length > 0) {
      return ctx.badRequest('Assistant name must be unique.');
    }

    let createdAssistant;
    try {
      // Get valid RAG token
      const token = await strapi.service('api::custom.rag-auth').getValidToken();

      // Check existing containers in RAG app
      const ragResponse = await strapi
        .service('api::custom.rag-api')
        .getRAGContainers(token);

      // Get allowed types from schema
      const allowedTypes =
        strapi.contentTypes['api::container.container'].attributes.assistantType.enum;
      const providers = allowedTypes;

      for (const provider of providers) {
        const containerName = `${assistantName}-${provider}`.toLowerCase();
        if (ragResponse.data.some(container => container.name === containerName)) {
          return ctx.badRequest(`Container ${containerName} already exists in RAG app.`);
        }
      }

      // Create assistant with generated name
      const assistantData = {
        ...data,
        name: assistantName,
        provinceId: province?.id,
        serviceCategoryId: serviceCategory?.id,
      };

      createdAssistant = await strapi.service('api::assistant.assistant').create({
        data: assistantData,
      });

      // Create containers
      const containers = await Promise.all(
        providers.map(provider =>
          strapi.documents('api::container.container').create({
            data: {
              name: `${assistantName}-${provider}`.toLowerCase(),
              assistantId: createdAssistant.id,
              assistantType: provider,
              configured: false,
              metaData: {
                primaryModel: primaryModel || '',
                secondaryModel: secondaryModel || '',
                temperature: temperature || '',
                instruction: instruction || '',
                searchFile: searchFile || '',
                description: description || '',
                isGeneral: isGeneral || false,
              },
            },
          })
        )
      );

      // Create containers in RAG app
      const s3Settings = await this.getS3Settings();
      const ragServicePayloads = providers.map(provider => ({
        name: `${assistantName}-${provider}`.toLowerCase(),
        connectToExternalData: true,
        ...s3Settings,
      }));

      const ragContainers = await Promise.all(
        ragServicePayloads.map(
          async payload =>
            await strapi
              .service('api::custom.rag-api')
              .postRAGApi(payload, '/manager/api/services', token)
        )
      );

      // Update containers with RAG metadata
      await Promise.all(
        containers.map((container, index) =>
          strapi.documents('api::container.container').update({
            documentId: container.id.toString(),
            data: {
              metaData: ragContainers[index].data,
            },
          })
        )
      );

      return createdAssistant;
    } catch (error) {
      // If any error occurs, cleanup any created resources
      if (createdAssistant?.data?.id) {
        await strapi
          .documents('api::assistant.assistant')
          .delete(createdAssistant.data.id);
      }

      console.error('Assistant creation error:', error);
      return ctx.badRequest(error.message || 'Failed to create assistant and containers');
    }
  },

  async delete(ctx) {
    const { id } = ctx.params;

    try {
      // Check if assistant exists
      const assistant = await strapi.documents('api::assistant.assistant').findOne({
        documentId: id,
      });

      if (!assistant) {
        return ctx.notFound('Assistant not found');
      }

      // Get associated containers before deletion
      const containers = await strapi.documents('api::container.container').findMany({
        filters: { assistantId: assistant.id },
      });

      // Get valid RAG token
      const token = await strapi.service('api::custom.rag-auth').getValidToken();

      // Track successfully deleted RAG services
      const successfulDeletions = [];

      // Delete each container's RAG service
      await Promise.all(
        containers.map(async container => {
          try {
            await strapi
              .service('api::custom.rag-api')
              .deleteRAGApi('/manager/api/services', container.name, token);
            // Add to successful deletions if RAG deletion succeeds
            successfulDeletions.push(container.documentId);
          } catch (error) {
            console.error(
              `Failed to delete RAG service for container ${container.name}:`,
              error
            );
          }
        })
      );

      // Delete containers from database that were successfully deleted from RAG
      if (successfulDeletions.length > 0) {
        const deleteResults = await Promise.all(
          successfulDeletions.map(documentId =>
            strapi
              .documents('api::container.container')
              .delete({ documentId: documentId })
          )
        );

        if (deleteResults.some(result => !result)) {
          throw new Error('Failed to delete one or more containers from database');
        }
      }

      // Only delete assistant if all containers were successfully deleted
      if (successfulDeletions.length === containers.length) {
        await strapi
          .documents('api::assistant.assistant')
          .delete({ documentId: assistant.documentId });
        return ctx.send({
          message: 'Assistant and associated resources deleted successfully',
          deletedContainers: successfulDeletions.length,
        });
      } else {
        return ctx.badRequest(
          `Partial deletion: ${successfulDeletions.length} of ${containers.length} containers deleted. Assistant not deleted.`
        );
      }
    } catch (error) {
      console.error('Assistant deletion error:', error);
      return ctx.badRequest(
        error.message || 'Failed to delete assistant and associated resources'
      );
    }
  },

  async getS3Settings() {
    const setting = await strapi.service('api::setting.setting').getSetting('S3_CONFIG');

    if (!setting) {
      throw new Error('S3 configuration not found in settings');
    }

    // Parse the value if it's a string
    const config = typeof setting === 'string' ? JSON.parse(setting) : setting;

    // Validate required fields
    const requiredFields = ['bucket_name', 'access_key', 'secret_key', 'url'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required S3 setting: ${field}`);
      }
    }

    return {
      s3BucketName: config.bucket_name,
      s3AccessKey: config.access_key,
      s3SecretKey: config.secret_key,
      s3Url: config.url,
    };
  },

  async list(ctx) {
    try {
      // Fetch all assistants with their related data
      const assistants = await strapi.documents('api::assistant.assistant').findMany({
        populate: {
          provinceId: true,
          serviceCategoryId: true,
          containerIds: {
            populate: '*', // Get all container fields
          },
        },
      });

      // Format the response
      const formattedAssistants = assistants.map(assistant => ({
        id: assistant.id,
        name: assistant.name,
        metaData: assistant.metaData,
        province: {
          id: assistant.provinceId?.id,
          code: assistant.provinceId?.code,
          name: assistant.provinceId?.name,
        },
        serviceCategory: {
          id: assistant.serviceCategoryId?.id,
          name: assistant.serviceCategoryId?.name,
        },
        containers: assistant.containerIds?.map(container => ({
          id: container.id,
          name: container.name,
          type: container.assistantType,
          configured: container.configured,
          metaData: container.metaData,
        })),
      }));

      return ctx.send({
        data: formattedAssistants,
        meta: {
          count: formattedAssistants.length,
        },
      });
    } catch (error) {
      console.error('Error fetching assistants:', error);
      return ctx.badRequest(error.message || 'Failed to fetch assistants');
    }
  },

  async updateAgents(ctx) {
    const { id } = ctx.params;
    const { instruction } = ctx.request.body;

    try {
      if (!instruction) {
        return ctx.badRequest('Instruction is required in request body');
      }

      // Check if assistant exists
      const assistant = await strapi.documents('api::assistant.assistant').findOne({
        documentId: id,
        populate: {
          containerIds: true,
        },
      });

      if (!assistant) {
        return ctx.notFound('Assistant not found');
      }

      // Update assistant metadata with new instruction
      await strapi.documents('api::assistant.assistant').update({
        documentId: id,
        data: {
          metaData: {
            ...assistant.metaData,
            instruction,
          },
        },
      });

      // Track successful and failed updates
      const results = {
        successful: [],
        failed: [],
      };

      // Update agents for each container
      await Promise.all(
        assistant.containerIds.map(async container => {
          try {
            // First get the agents for this container
            const agents = await strapi
              .service('api::custom.agent')
              .getAgents(container.name);

            if (agents.length === 0) {
              throw new Error('No agents found in the container');
            }

            // Update the first agent
            const agentUpdateResult = await strapi
              .service('api::custom.agent')
              .updateAgent(container.name, agents[0], instruction);

            results.successful.push({
              containerName: container.name,
              agentId: agents[0].agent_id,
              result: {
                status: agentUpdateResult.status,
                message: agentUpdateResult.message || 'Agent updated successfully',
              },
            });

            // Update container instruction
            await strapi.documents('api::container.container').update({
              documentId: container.documentId,
              data: {
                metaData: {
                  ...container.metaData,
                  instruction,
                },
              },
            });
          } catch (error) {
            console.error(
              `Failed to update agent for container ${container.name}:`,
              error
            );
            results.failed.push({
              containerName: container.name,
              error: error.message,
            });
          }
        })
      );

      // Return appropriate response based on results
      if (results.failed.length === 0) {
        return ctx.send({
          message: 'All agents updated successfully',
          results,
        });
      } else if (results.successful.length === 0) {
        return ctx.badRequest('Failed to update any agents', { results });
      } else {
        return ctx.badRequest('Some agent updates failed', { results });
      }
    } catch (error) {
      console.error('Agent update error:', error);
      return ctx.badRequest(error.message || 'Failed to update agents');
    }
  },
}));
