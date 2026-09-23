FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source
COPY app/ .

# Run application as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

# Application port
EXPOSE 3000

# Container health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]