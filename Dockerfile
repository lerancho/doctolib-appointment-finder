# First stage: Build
FROM node:16-alpine AS build

WORKDIR /usr/src/app

# Install Yarn
RUN apk add --no-cache yarn

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of your app's source code to the working directory
COPY . .

# TypeScript
RUN yarn global add typescript
RUN tsc

# Second stage: Run
FROM node:16-alpine

WORKDIR /usr/src/app

# Install Yarn
RUN apk add --no-cache yarn

# Copy from build stage
COPY --from=build /usr/src/app .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD [ "yarn", "start" ]