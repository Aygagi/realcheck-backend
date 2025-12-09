# Use the official Node.js image
FROM node:20-alpine
# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port (Render will handle mapping this)
EXPOSE 3000

# Define the command to run the app
CMD [ "node", "server.js" ]