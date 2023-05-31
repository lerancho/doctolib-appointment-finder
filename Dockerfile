# Use official node image as the base image
FROM node:16

# Set /usr/src/app as the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app's source code to the working directory
COPY . .

# TypeScript
RUN npm install typescript -g
RUN tsc

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD [ "node", "dist/index.js" ]
