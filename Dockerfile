 # Use Node.js for building the React app
FROM node:22-alpine AS build

# Install pnpm
RUN apk add --no-cache libssl1.1 && npm install -g pnpm

# Build from source
COPY . /src
WORKDIR /src

ENTRYPOINT ["./entrypoint.sh"]
