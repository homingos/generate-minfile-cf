# Base Image: Use a lean Alpine base for smaller image size
FROM node:lts-alpine 

# Environment Variable: Prevent Chromium download for faster builds   
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install dependencies 
WORKDIR /usr/src/app 
RUN apk add --no-cache \
      chromium \
      nss \
      ca-certificates
# Bundle your Node.js application
COPY package*.json ./
RUN npm install 

# Copy your application code
COPY . .

# Optimize for production (optional)
# If you have a production build step
# RUN npm run build

# Expose a port (adjust if you use a different port in your app)
EXPOSE 3000

# Command to run your application when the container starts
CMD [ "npm", "start" ] 
