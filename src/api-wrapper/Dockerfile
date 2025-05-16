FROM node:20-alpine
# Installing libvips-dev for sharp Compatibility
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev && rm -rf /var/cache/apk/* > /dev/null 2>&1

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /opt/app
COPY package*.json ./

# Install dependencies with specific flags for Strapi
RUN npm install --legacy-peer-deps

COPY . .
RUN chown -R node:node /opt/app
USER node

# Build Strapi admin panel
RUN npm run build

# Clear any existing cache
RUN rm -rf .strapi/cache

EXPOSE 1337

# Use start instead of develop for production-like environment
CMD ["npm", "run", "start"] 