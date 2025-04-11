"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::container.container",
  ({ strapi }) => ({
    async chat(ctx) {
      try {
        // Check if request body is defined
        if (!ctx.request.body) {
          return ctx.badRequest("Request body is missing");
        }

        const {
          messageHistory,
          currentQuestion,
          serviceCategoryId,
          provinceId,
        } = ctx.request.body;

        // Validate required fields
        if (!serviceCategoryId || !provinceId || !currentQuestion) {
          return ctx.badRequest("Missing required fields");
        }

        // Further validation for messageHistory items
        if (messageHistory) {
          for (const msg of messageHistory) {
            if (
              typeof msg.role !== "string" ||
              typeof msg.content !== "string"
            ) {
              return ctx.badRequest(
                "Each message must have a role and content as strings"
              );
            }
          }
        }

        // Get service category and province
        const serviceCategory = await strapi.db
          .query("api::service-category.service-category")
          .findOne({ where: { externalId: serviceCategoryId } });
        const province = await strapi.db
          .query("api::province.province")
          .findOne({ where: { externalId: provinceId } });

        console.log({ serviceCategory, province });

        if (!serviceCategory || !province) {
          return ctx.badRequest("Invalid service category or province");
        }

        // Get RAG URL and active provider from settings
        const ragUrl = await strapi
          .service("api::setting.setting")
          .getSetting("RAG_APP_URL");
        const activeProvider = await strapi
          .service("api::setting.setting")
          .getSetting("ACTIVE_MODEL_PROVIDER");

        if (!ragUrl || !activeProvider) {
          return ctx.badRequest("Missing configuration settings");
        }

        // Construct the container endpoint
        // Construct the container endpoint
        const containerEndpoint = `/a/${province.code.toLowerCase()}-${serviceCategory.name
          .toLowerCase()
          .replace(/\s+/g, "-")}-${activeProvider.toLowerCase()}/api/chat`;
        // const containerEndpoint = "/a/test/api/chat"; // TODO: Update this line as needed

        console.log({ containerEndpoint });
        // Format payload for OpenAI
        const formattedPayload = {
          messages: [
            ...(messageHistory || []).map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            {
              role: "user",
              content: currentQuestion,
            },
          ],
        };

        // Get valid token from RAG auth service
        const token = await strapi
          .service("api::custom.rag-auth")
          .getValidToken();

        // Make request to RAG API
        const response = await strapi
          .service("api::custom.rag-api")
          .postRAGApi(formattedPayload, containerEndpoint, token, true);
        console.log(response);

        // Set headers for streaming
        ctx.res.setHeader("Content-Type", "text/event-stream");
        ctx.res.setHeader("Cache-Control", "no-cache");
        ctx.res.setHeader("Connection", "keep-alive");

        // Stream the response to the client
        response.data.on("data", (chunk) => {
          console.log(chunk, "new data");
          ctx.res.write(`data: ${chunk}\n\n`); // Send the chunk as a stream
        });

        response.data.on("end", () => {
          console.log("Stream finished");
          ctx.res.end(); // End the response when streaming is complete
        });

        response.data.on("error", (err) => {
          console.error("Streaming error:", err);
          ctx.res.status(500).json({ error: "Streaming error occurred" });
        });

        // Do not return anything here; let the streaming handle the response
      } catch (error) {
        console.error("Error in container chat:", error);
        return ctx.internalServerError(
          "An error occurred while processing your request"
        );
      }
    },
  })
);
